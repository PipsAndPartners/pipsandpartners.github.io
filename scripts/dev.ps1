# Starts the whole local dev system: static marketing site + A-function console.
# Run once: .\scripts\dev.ps1
# Stop both: close this window, or Ctrl+C then close the two windows it opens.

$root = Split-Path -Parent $PSScriptRoot

# 1) Postgres (needed by A-function)
& "$env:LOCALAPPDATA\Programs\pgsql17\pgsql\bin\pg_ctl.exe" -D "$env:LOCALAPPDATA\Programs\pgsql17\pgsql\data" -l "$env:LOCALAPPDATA\Programs\pgsql17\pgsql\data\logfile.txt" -o "-p 5432" start
& "$env:LOCALAPPDATA\Programs\pgsql17\pgsql\bin\pg_isready.exe" -h localhost -p 5432

# 2) Static site (docs/) on :4173
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\docs'; python -m http.server 4173"

# 3) A-function (Flask) on :5000 — must use its own venv, not system Python
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\a-function'; .\.venv\Scripts\python.exe web\app.py"

Start-Sleep -Seconds 2
Start-Process "http://127.0.0.1:4173/index.html"

Write-Output "Site:       http://127.0.0.1:4173/index.html"
Write-Output "A-function: http://127.0.0.1:5000"
