@echo off
echo ==========================================
echo   SalesPrep AI - Git Push Script
echo ==========================================
echo.

cd /d "%~dp0"
echo Current directory: %CD%
echo.

echo [1/4] Checking git status...
git status
echo.

echo [2/4] Adding all changes...
git add -A
echo.

echo [3/4] Committing changes...
git commit -m "fix: resolve unclosed aiohttp session and usage tracking errors"
echo.

echo [4/4] Pushing to GitHub...
git push origin main
echo.

echo ==========================================
echo   DONE! Check above for any errors.
echo ==========================================
echo.
pause
