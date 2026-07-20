#!/usr/bin/env bash
# Nightly Postgres backup. Keeps the last 14 days.
# Install on the VM with:  crontab -e  →  0 2 * * * /home/<you>/ExpenseDiaryFresh/backend/deploy/backup.sh
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p backups
docker compose exec -T db pg_dump -U postgres expensediary | gzip > "backups/expensediary-$(date +%F).sql.gz"
ls -1t backups/expensediary-*.sql.gz | tail -n +15 | xargs -r rm --
echo "backup done: backups/expensediary-$(date +%F).sql.gz"
