@echo off
setlocal EnableExtensions DisableDelayedExpansion
title DZOFT - Safe Local Recovery Check

rem This is a Windows helper for the existing DZOFT recovery lab.
rem It never connects to the production Supabase database.
rem The Python restore tool hard-pins the target to 127.0.0.1:55439.

set "REPO=%USERPROFILE%\DZOFT-Backup-Runner"
set "ARCHIVE=%USERPROFILE%\DZOFT-Backups\dzoft-20261115-145839Z-b191cd.dzoftbak"
set "LAB=%USERPROFILE%\DZOFT-Recovery-Lab\pgdata\PG_VERSION"
set "PG_BIN=C:\Program Files\PostgreSQL\18\bin"

echo.
echo ===================================================
echo     DZOFT - SAFE LOCAL RECOVERY CHECK
echo ===================================================
echo.
echo This checks a LOCAL test database only.
echo Your live DZOFT website and Supabase stay unchanged.
echo.
echo You will be asked for two PRIVATE passwords:
echo   1. Recovery Lab PostgreSQL password
echo   2. Encrypted database backup passphrase
echo.
echo Do not share either password with anyone.
echo.

if not exist "%REPO%\.git" goto NO_REPO
if not exist "%ARCHIVE%" goto NO_ARCHIVE
if not exist "%LAB%" goto NO_LAB
if not exist "%PG_BIN%\pg_restore.exe" goto NO_POSTGRES

where git >nul 2>&1
if errorlevel 1 goto NO_GIT
where python >nul 2>&1
if errorlevel 1 goto NO_PYTHON

for /f "delims=" %%B in ('git -C "%REPO%" branch --show-current 2^>nul') do set "DZOFT_BRANCH=%%B"
if /i not "%DZOFT_BRANCH%"=="main" goto NO_MAIN

echo [1/2] Updating the local DZOFT tools from the official GitHub repository...
git -C "%REPO%" pull --ff-only https://github.com/rdzoagbe/dzoft.git main
if errorlevel 1 goto PULL_FAILED

if not exist "%REPO%\tools\restore_dzoft_lab_schema.py" goto NO_RESTORE

echo.
echo [2/2] Checking and restoring table DEFINITIONS in your local Recovery Lab...
echo This does NOT import client records or recover user logins.
echo.

pushd "%REPO%"
python "tools\restore_dzoft_lab_schema.py" --archive "%ARCHIVE%" --pg-bin "%PG_BIN%"
set "DZOFT_RESULT=%ERRORLEVEL%"
popd

echo.
if not "%DZOFT_RESULT%"=="0" goto NEEDS_REVIEW

echo ===================================================
echo Local table DEFINITIONS stage finished successfully.
echo Client data, permissions and account recovery are NOT tested yet.
echo ===================================================
goto FINISH

:NO_REPO
echo STOP: DZOFT-Backup-Runner was not found under your Windows profile.
goto FINISH
:NO_ARCHIVE
echo STOP: The original encrypted database backup was not found.
goto FINISH
:NO_LAB
echo STOP: The local Recovery Lab data directory was not found.
goto FINISH
:NO_POSTGRES
echo STOP: PostgreSQL 18 tools were not found.
goto FINISH
:NO_GIT
echo STOP: Git is not available.
goto FINISH
:NO_PYTHON
echo STOP: Python is not available.
goto FINISH
:NO_MAIN
echo STOP: DZOFT-Backup-Runner is not on the main branch.
echo No database operations were attempted.
goto FINISH
:PULL_FAILED
echo STOP: Could not safely update local DZOFT tools.
echo No database operations were attempted.
goto FINISH
:NO_RESTORE
echo STOP: Recovery tool was not found after the update.
goto FINISH
:NEEDS_REVIEW
echo ===================================================
echo Recovery test STOPPED or needs further work.
echo This does NOT mean the live DZOFT website is broken.
echo No client rows were imported.
echo Share the output above, but NEVER share passwords.
echo ===================================================
goto FINISH

:FINISH
echo.
echo You can close this window after reading the message.
pause
endlocal
