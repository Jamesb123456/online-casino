# Deploy Platinum Casino to a VPS

A one-page runbook for putting the production stack on a small Linux VPS,
with HTTPS via Let's Encrypt and nightly database backups.

The production stack is four containers: **MySQL**, the **Node.js server**,
the **nginx SPA**, and **Caddy** (TLS terminator + reverse proxy). Only
Caddy is exposed to the internet (80/443).

> Already have it deployed? Jump straight to [Updates](#9-updates).

---

## 1. Prereqs

- A VPS running Ubuntu 22.04+ or Debian 12+ (1 vCPU / 2 GB RAM is enough
  for a few dozen concurrent players; bump RAM if you turn on Redis later).
- Docker Engine and the Compose v2 plugin installed:
  ```bash
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker $USER
  # log out and back in so the group change takes effect
  ```
- A domain pointed at the VPS:
  - `A` record:     `mycasino.example.com -> 203.0.113.10`
  - `A` record:     `www.mycasino.example.com -> 203.0.113.10`
- Firewall: ports `80/tcp` and `443/tcp` (and `443/udp` for HTTP/3) open.
  On a fresh Ubuntu box with UFW:
  ```bash
  sudo ufw allow 80,443/tcp
  sudo ufw allow 443/udp
  sudo ufw enable
  ```
- Outbound port `443` open so Caddy can talk to Let's Encrypt.

---

## 2. Clone & configure

```bash
git clone https://github.com/<your-org>/online-casino.git
cd online-casino

cp .env.production.example .env.production
```

Open `.env.production` and fill in **every** blank value. The critical ones:

| Variable               | Notes                                                       |
|------------------------|-------------------------------------------------------------|
| `DOMAIN`               | Your apex domain, e.g. `mycasino.example.com`.              |
| `ADMIN_EMAIL`          | Used by Let's Encrypt for expiry warnings.                  |
| `MYSQL_ROOT_PASSWORD`  | Strong random string. Never reused.                         |
| `MYSQL_PASSWORD`       | Strong random string. Never reused.                         |
| `BETTER_AUTH_SECRET`   | Generate with `openssl rand -hex 32` - 32+ chars required.  |

Keep `.env.production` off the repo. The included `.gitignore` already
excludes it, but double-check before any `git add .`.

---

## 3. First boot

Build images and bring the stack up in the background:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Tail the logs while Caddy provisions a certificate (usually 5-30 seconds):

```bash
docker compose -f docker-compose.prod.yml logs -f caddy
```

You should see `certificate obtained successfully`. After that:

```bash
curl -I https://$DOMAIN
# HTTP/2 200
```

If Caddy can't reach Let's Encrypt, see [Troubleshooting](#10-troubleshooting).

---

## 4. Run migrations

Drizzle migrations are not auto-applied at server start. Run them once
after the database is up:

```bash
docker compose -f docker-compose.prod.yml exec server npm run db:migrate
```

(Re-run after every `git pull` that touches `server/drizzle/migrations/`.)

---

## 5. Seed default accounts

Creates the built-in `admin`, `player1`, `operator`, and `viewer` users:

```bash
docker compose -f docker-compose.prod.yml exec server npm run seed
```

**Then immediately log in as `admin` (default password `admin123`) at
`https://$DOMAIN/login` and change the password from the Profile page.**
Do not skip this. The default is documented in this repo and on the
internet. Treat the freshly-seeded admin as a one-shot bootstrap account.

---

## 6. Top up the house treasury

Casino games pay out from a "house" balance. After login as `admin`:

1. Navigate to `https://$DOMAIN/admin/house`.
2. Set the starting house balance (e.g. 1,000,000 credits).
3. Check the Dashboard - the house balance is visible at the top.

---

## 7. Schedule nightly backups

`scripts/backup-db.sh` dumps the MySQL data via `docker exec` and keeps the
last 30 dumps in `./backups/` as gzipped SQL. See `backups/README.md` for
detail.

> The script hard-codes the container name `online-casino-db-1` and the dev
> credentials. Override them for prod via env vars when you wire up cron.

Example crontab entry (run as the user that owns the repo):

```cron
5 3 * * *  BACKUP_CONTAINER=online-casino-db-1 \
           BACKUP_DB_USER=casino_user \
           BACKUP_DB_PASS='<your MYSQL_PASSWORD>' \
           BACKUP_DB_NAME=platinum_casino \
           /home/ubuntu/online-casino/scripts/backup-db.sh \
           >> /home/ubuntu/online-casino/backups/cron.log 2>&1
```

Tip: `docker ps --format '{{.Names}}'` shows the actual container name -
Compose v2 sometimes emits `online-casino-db-1` and sometimes
`online_casino-db-1`. Match exactly.

Off-box copies of `./backups/` (rsync, restic, S3, B2) are highly
recommended - the VPS disk is a single point of failure.

---

## 8. Restore from a backup

```bash
./scripts/restore-db.sh ./backups/platinum_casino_YYYYMMDDTHHMMSSZ.sql.gz
```

The script prompts for confirmation (you type the DB name) before
overwriting. Stop the server container first if active sessions are a
concern:

```bash
docker compose -f docker-compose.prod.yml stop server
./scripts/restore-db.sh ./backups/<file>.sql.gz
docker compose -f docker-compose.prod.yml start server
```

---

## 9. Updates

```bash
# 1. Always back up first.
./scripts/backup-db.sh

# 2. Pull and rebuild.
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# 3. Apply any new migrations.
docker compose -f docker-compose.prod.yml exec server npm run db:migrate
```

If the build fails part-way through, the previous containers keep running
- there is no downtime until the new image is healthy.

---

## 10. Troubleshooting

**Caddy stuck retrying TLS / `no such host`**
DNS isn't pointing at the box yet. Confirm with `dig +short $DOMAIN`.
Caddy keeps retrying with exponential backoff; you don't need to restart
it once DNS propagates.

**Want to test certificate issuance without burning the Let's Encrypt
rate limit?** Edit `Caddyfile` and uncomment the `acme_ca` line in the
global block:

```caddyfile
{
    email {$ADMIN_EMAIL}
    acme_ca https://acme-staging-v02.api.letsencrypt.org/directory
}
```

Then `docker compose -f docker-compose.prod.yml restart caddy`. Browsers
won't trust the staging cert - that's expected.

**MySQL won't start (`InnoDB: Operating system error`)**
Almost always a permission issue on `mysql_data_prod`. If you're
recovering from a manual `docker volume rm`, delete the volume and let
the container recreate it:

```bash
docker compose -f docker-compose.prod.yml down
docker volume rm online-casino_mysql_data_prod   # be sure - this is destructive
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

**Client returns 502 Bad Gateway**
The server container is still starting (healthcheck not yet green) or it
crashed. Check:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs server --tail=200
```

**Caddy logs show "permission denied" on `/data`**
Don't `chown` the volume contents; just remove the volume and let Caddy
recreate it on next boot.

**The seed script reports duplicate-key errors**
The default users already exist. That's fine - seeding is idempotent on
the "create users" step but will error on the second run. Ignore.

---

## File map

- `docker-compose.prod.yml` - the prod stack
- `Caddyfile`               - reverse proxy + TLS config (uses `$DOMAIN`, `$ADMIN_EMAIL`)
- `.env.production.example` - template; copy to `.env.production`
- `server/Dockerfile`       - server image (multi-stage, non-root)
- `client/Dockerfile`       - client image (nginx, non-root)
- `client/nginx.conf`       - SPA + API/Socket.IO proxy config
- `scripts/backup-db.sh`    - nightly dump
- `scripts/restore-db.sh`   - guided restore
- `backups/README.md`       - backup notes
