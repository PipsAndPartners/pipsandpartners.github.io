$pgHome = "$env:LOCALAPPDATA\Programs\pgsql17\pgsql"
& "$pgHome\bin\pg_ctl.exe" -D "$pgHome\data" -l "$pgHome\data\logfile.txt" -o "-p 5432" start
& "$pgHome\bin\pg_isready.exe" -h localhost -p 5432
