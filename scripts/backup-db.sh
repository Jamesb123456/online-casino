#!/usr/bin/env bash
# Nightly mysqldump of the running MySQL Docker container.
# Writes to ./backups/platinum_casino_<UTC_DATE>.sql.gz.
# Keeps the last 30 dumps; older ones are deleted.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="$ROOT/backups"
CONTAINER="${BACKUP_CONTAINER:-online-casino-db-1}"
DB_USER="${BACKUP_DB_USER:-casino_user}"
DB_PASS="${BACKUP_DB_PASS:-casino_pass}"
DB_NAME="${BACKUP_DB_NAME:-platinum_casino}"
KEEP="${BACKUP_KEEP:-30}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$BACKUP_DIR/platinum_casino_${STAMP}.sql.gz"

echo "[backup] dumping $DB_NAME from $CONTAINER -> $OUT"
docker exec "$CONTAINER" mysqldump \
  -u"$DB_USER" -p"$DB_PASS" \
  --single-transaction --quick --routines --triggers --events --no-tablespaces \
  "$DB_NAME" 2>/dev/null | gzip > "$OUT"

SIZE=$(stat -c%s "$OUT" 2>/dev/null || stat -f%z "$OUT")
echo "[backup] wrote $OUT ($SIZE bytes)"

cd "$BACKUP_DIR"
ls -1t platinum_casino_*.sql.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -v
echo "[backup] retention: kept latest $KEEP"
