#!/bin/bash
echo "Останавливаю Node.js сервер..."
pkill -f "node server.js"
lsof -ti:3000 | xargs kill -9 2>/dev/null
echo "Сервер остановлен"