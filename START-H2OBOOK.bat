@echo off
cd /d %~dp0
echo H2OBOOK V3.5 Production Suite - V1 + V2 + V3 + Production Integrated
if not exist node_modules (
  echo Dang cai thu vien...
  call npm install
  if errorlevel 1 goto error
)
call npm run validate
if errorlevel 1 goto error
call npm run dev
pause
exit /b 0
:error
echo Khong the khoi dong H2OBOOK. Kiem tra Node.js va ket noi npm.
pause
exit /b 1
