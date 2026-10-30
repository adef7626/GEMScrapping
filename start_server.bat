@echo off
title GeM Bid Analyzer Backend Launcher
echo =======================================================
echo     Starting GeM Bid Analyzer Backend Server...
echo =======================================================
echo.
echo Running server silently in the background...
start /B "" "C:\Users\PC\.local\bin\uv.exe" run --with fastapi,uvicorn,pandas,openpyxl,playwright,pypdf,python-multipart "C:\Users\PC\.gemini\antigravity\scratch\gem-bid-analyzer\app.py"
echo.
echo Server successfully launched on http://localhost:8000/
echo You can close this window now.
echo =======================================================
timeout /t 5
