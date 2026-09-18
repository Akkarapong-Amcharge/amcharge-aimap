@echo off
rem เปิดเดโม Amcharge AI Roof Planner - ดับเบิลคลิกไฟล์นี้
rem เริ่มเว็บเซิร์ฟเวอร์แล้วเปิดเบราว์เซอร์ที่ http://localhost:8765/
start "Amcharge Roof Planner Server" powershell -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
timeout /t 2 >nul
start "" http://localhost:8765/
exit
