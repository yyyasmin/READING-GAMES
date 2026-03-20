#!/usr/bin/env bash
# Run before the app: install deps, init DB, optionally seed tasks.
set -e
cd "$(dirname "$0")"

echo "[setup] Installing dependencies..."
pip install -r requirements.txt

echo "[setup] DB init (create DB if needed, create_all)..."
python db_create.py --init

if [ "${SEED_TASKS}" = "1" ]; then
  echo "[setup] Seeding tasks..."
  python db_create.py --seed-tasks
else
  echo "[setup] Skipping seed (set SEED_TASKS=1 to seed)."
fi

echo "[setup] Done."
