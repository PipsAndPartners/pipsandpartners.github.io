@echo off
rem Start the portable Postgres, then take today's backup (db\backup.py, skipped if one exists).
rem A .cmd so the Windows Startup shortcut runs it without touching PowerShell's execution policy.
set PGHOME=%LOCALAPPDATA%\Programs\pgsql17\pgsql
"%PGHOME%\bin\pg_ctl.exe" -D "%PGHOME%\data" -l "%PGHOME%\data\logfile.txt" -o "-p 5432" start
"%PGHOME%\bin\pg_isready.exe" -h localhost -p 5432
"%~dp0..\.venv\Scripts\python.exe" "%~dp0backup.py" --daily
