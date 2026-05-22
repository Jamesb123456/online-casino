#!/usr/bin/env bash
# Restore a mysqldump.gz file into the running MySQL Docker container.
# Usage: ./scripts/restore-db.sh ./backups/platinum_casino_YYYYMMDDTHHMMSSZ.sql.gz

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup-file.sql.gz>" >&2
  exit 1
fi

FILE="$1"
CONTAINER="${BACKUP_CONTAINER:-online-casino-db-1}"
DB_USER="${BACKUP_DB_USER:-casino_user}"
DB_PASS="${BACKUP_DB_PASS:-casino_pass}"
DB_NAME="${BACKUP_DB_NAME:-platinum_casino}"

if [ ! -f "$FILE" ]; then
  echo "[restore] file not found: $FILE" >&2
  exit 1
fi

echo "[restore] this will OVERWRITE $DB_NAME with the contents of $FILE."
read -r -p "Type the database name '$DB_NAME' to confirm: " CONFIRM
if [ "$CONFIRM" != "$DB_NAME" ]; then
  echo "[restore] aborted."
  exit 1
fi

echo "[restore] piping $FILE into $CONTAINER..."
gunzip -c "$FILE" | docker exec -i "$CONTAINER" mysql -u"$DB_USER" -p"$DB_PASS" "$DB_NAME"
echo "[restore] done."
