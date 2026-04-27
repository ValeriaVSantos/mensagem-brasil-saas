#!/bin/bash
#
# backup.sh — daily PostgreSQL backup with 7-day retention
#
# Schedule via cron:
#   crontab -e
#   0 2 * * * /root/backup.sh >> /root/backups/backup.log 2>&1
#
# Restore from a backup:
#   gunzip backup_YYYYMMDD_HHMMSS.sql.gz
#   docker exec -i evolution-postgres psql -U evolution -d evolution < backup_YYYYMMDD_HHMMSS.sql

set -euo pipefail

BACKUP_DIR='/root/backups'
CONTAINER='evolution-postgres'
DB_USER='evolution'
DB_NAME='evolution'
RETENTION_DAYS=7

DATE=$(date +%Y%m%d_%H%M%S)
FILE="${BACKUP_DIR}/backup_${DATE}.sql.gz"

mkdir -p "${BACKUP_DIR}"

# Dump and compress in a single pipe to avoid intermediate files on disk.
docker exec "${CONTAINER}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" | gzip > "${FILE}"

# Rotate: remove backups older than RETENTION_DAYS days.
find "${BACKUP_DIR}" -name 'backup_*.sql.gz' -mtime "+${RETENTION_DAYS}" -delete

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup created: ${FILE} ($(du -sh "${FILE}" | cut -f1))"
