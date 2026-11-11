@echo off
rem GTM Bukowski - instalacja programu do wylaczania komputera przyciskiem w aplikacji.
rem Kopiuje wylacz-komputer.ps1 do %LOCALAPPDATA%\GTM-wylaczanie i uruchamia go przy kazdym logowaniu do Windows.
setlocal
set "DIR=%LOCALAPPDATA%\GTM-wylaczanie"
set "PS1=%DIR%\wylacz-komputer.ps1"
if not exist "%DIR%" mkdir "%DIR%"
if exist "%~dp0wylacz-komputer.ps1" (
  copy /Y "%~dp0wylacz-komputer.ps1" "%PS1%" >nul
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -UseBasicParsing -Uri 'https://gtm-bukowski.vercel.app/kiosk/wylacz-komputer.ps1' -OutFile '%PS1%'"
)
if not exist "%PS1%" (
  echo Nie udalo sie pobrac programu. Sprawdz internet i sprobuj ponownie.
  pause
  exit /b 1
)
set "VBS=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\GTM-wylaczanie.vbs"
> "%VBS%" echo CreateObject("WScript.Shell").Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""%PS1%""", 0, False
start "" wscript.exe "%VBS%"
echo.
echo Gotowe. Program do wylaczania dziala i bedzie sie uruchamial przy kazdym logowaniu do Windows.
echo Wroc do przegladarki i nacisnij "Sprawdz program" na stronie /kiosk.
echo.
pause
