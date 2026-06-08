@echo off
setlocal
echo === IBNApp Update (com.ibna.app) ===
echo.

set NATIVE_DIR=android\app\src\main\java\com\ibna\app
set OLD_NATIVE_DIR=android\app\src\main\java\com\ibna\ibnapp

echo [1/6] Git pull...
git pull
if errorlevel 1 (echo ERRORE: git pull fallito & pause & exit /b 1)

echo [2/6] npm install...
call npm install
if errorlevel 1 (echo ERRORE: npm install fallito & pause & exit /b 1)

echo [3/6] Copia plugin nativi in %NATIVE_DIR% ...
if not exist "%NATIVE_DIR%" mkdir "%NATIVE_DIR%"
copy /Y android-plugin\*.java "%NATIVE_DIR%\" >nul
if errorlevel 1 (echo ERRORE: copia file Java fallita & pause & exit /b 1)

echo [4/6] Build web...
call npm run build
if errorlevel 1 (echo ERRORE: build fallito & pause & exit /b 1)

echo [5/6] Capacitor sync android...
call npx cap sync android
if errorlevel 1 (echo ERRORE: cap sync fallito & pause & exit /b 1)

echo [6/6] Pulizia vecchio package com.ibna.ibnapp (se esiste)...
if exist "%OLD_NATIVE_DIR%" (
    echo   - Rimuovo %OLD_NATIVE_DIR%
    rmdir /S /Q "%OLD_NATIVE_DIR%"
)

echo.
echo === FATTO! ===
echo Package: com.ibna.app
echo File copiati in: %NATIVE_DIR%
echo.
echo Avvio Android Studio (npx cap open android)...
call npx cap open android
if errorlevel 1 (
    echo ERRORE: npx cap open android fallito.
    echo Apri manualmente la cartella: %CD%\android
)
echo.
echo In Android Studio: File ^> Sync Project with Gradle Files, poi Build ^> Clean Project, poi Run.
pause
endlocal
