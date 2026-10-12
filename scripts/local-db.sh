#!/usr/bin/env bash
# Crée une base Postgres locale « remis_test » avec le stub Supabase + toutes les migrations.
# Usage : DATABASE_URL=postgres://postgres@localhost:5432/postgres bash scripts/local-db.sh
set -euo pipefail
ADMIN_URL="${DATABASE_URL:-postgres://postgres@localhost:5432/postgres}"
DB="${REMIS_TEST_DB:-remis_test}"
TEST_URL="${ADMIN_URL%/*}/${DB}"
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -qc "drop database if exists ${DB} with (force)" -c "create database ${DB}"
psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f tests/db/supabase-stub.sql
for f in supabase/migrations/*.sql; do
  psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done
echo "TEST_DATABASE_URL=${TEST_URL}"
