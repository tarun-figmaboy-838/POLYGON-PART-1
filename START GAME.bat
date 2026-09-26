@echo off
rem Double-click this to play the whole Polygon Adventure with sound.
rem
rem It starts a small local server (serve.ps1, no installs needed) and opens the game.
rem Part 1 (the Swiftee lesson) plays first, and carries on into Part 2 (Frozen Rush)
rem when it is finished. index.html also opens straight off the disk, but then the lesson uses the
rem browser's voice instead of the recorded one and Frozen Rush plays without music.

title Polygon Adventure - local server
echo.
echo   Starting local server...
echo.

rem Open in Microsoft Edge specifically, rather than whatever the default browser is.
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"

if exist "%EDGE%" (
  echo   Opening Microsoft Edge...
  start "" "%EDGE%" "http://127.0.0.1:8080/"
) else (
  echo   Edge not found, using your default browser...
  start "" "http://127.0.0.1:8080/"
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" -Port 8080

echo.
echo   Server stopped. Press any key to close.
pause > nul
