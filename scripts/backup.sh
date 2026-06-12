#!/usr/bin/env bash
# Nightly backup of the SQLite database and uploaded documents.
# Cron (as the app user):  30 3 * * *  /srv/cuncWebsite/app/scripts/backup.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/srv/cuncWebsite/app}"
BACKUP_DIR="${BACKUP_DIR:-/srv/cuncWebsite/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="$BACKUP_DIR/$STAMP"

mkdir -p "$DEST"

sqlite3 "$APP_DIR/data/site.db" ".backup '$DEST/site.db'"
cp -r "$APP_DIR/public/uploads" "$DEST/uploads"

find "$BACKUP_DIR" -maxdepth 1 -mindepth 1 -type d -mtime "+$KEEP_DAYS" -exec rm -rf {} +

echo "backup written to $DEST"
