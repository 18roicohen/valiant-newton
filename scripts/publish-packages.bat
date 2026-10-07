@echo off
setlocal enabledelayedexpansion

echo ====================================================================
echo           DYNEP MICRO-DAAS: PACKAGE PUBLISHING WIZARD
echo ====================================================================
echo.

:: 1. NPM Publishing
echo [1/2] Preparing npm publication for 'dynep-spot' CLI...
cd /d "%~dp0..\packages\cli"

call npm.cmd whoami >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [npm] You are not currently logged in to npm.
    echo [npm] Opening interactive npm login...
    call npm.cmd login
)

echo [npm] Publishing 'dynep-spot' to registry.npmjs.org...
call npm.cmd publish --access public
if %ERRORLEVEL% EQU 0 (
    echo [npm] SUCCESS: 'dynep-spot' is published!
) else (
    echo [npm] Publish failed or package version already exists.
)

echo.
:: 2. PyPI Publishing
echo [2/2] Preparing PyPI publication for 'dynep' Python SDK...
cd /d "%~dp0..\packages\python-sdk"

if "%TWINE_PASSWORD%"=="" (
    echo [PyPI] Enter your PyPI API Token (starts with pypi-...):
    set /p PYPI_TOKEN="Token: "
    set "TWINE_PASSWORD=!PYPI_TOKEN!"
)

set TWINE_USERNAME=__token__
python -m twine upload dist/*

echo.
echo ====================================================================
echo                       PUBLISHING COMPLETE
echo ====================================================================
pause
