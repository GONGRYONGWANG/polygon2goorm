@echo off
setlocal
cd /d "%~dp0"

if exist "C:\Gradle\gradle-9.4.1\bin\gradle.bat" (
  set "PATH=C:\Gradle\gradle-9.4.1\bin;%PATH%"
)

gradle runGui
if errorlevel 1 (
  echo.
  echo Failed to start polygon2goorm GUI.
  echo Make sure Java 21 and Gradle are installed.
  pause
)
