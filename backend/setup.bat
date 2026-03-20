@echo off
REM Run before the app: install deps, init DB, optionally seed tasks.
cd /d "%~dp0"
echo on

echo [setup] Installing dependencies...
pip install -r requirements.txt
if errorlevel 1 exit /b 1

echo [setup] DB init (create DB if needed, create_all)...
python db_create.py --init
if errorlevel 1 exit /b 1

if "%SEED_TASKS%"=="1" (
  echo [setup] Seeding tasks...
  python db_create.py --seed-tasks
  if errorlevel 1 exit /b 1
) else (
  echo [setup] Skipping seed (set SEED_TASKS=1 to seed).
)

echo [setup] Done.
