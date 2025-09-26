#!/bin/bash

# Startup script for GameNight Bot with internal microservices
echo "🚀 Starting GameNight Bot with microservices..."

# Start services in background
echo "📡 Starting Weather Service..."
cd /app/services/weather-service && node server.js &
WEATHER_PID=$!

# Wait a moment for weather service to start
sleep 2

# Start main bot
echo "🤖 Starting Main Bot..."
cd /app/main-bot && node index.js &
MAIN_PID=$!

# Function to handle shutdown gracefully
shutdown() {
    echo "🛑 Shutting down services..."
    kill $WEATHER_PID $MAIN_PID
    wait $WEATHER_PID $MAIN_PID
    echo "✅ All services stopped"
    exit 0
}

# Trap shutdown signals
trap shutdown SIGTERM SIGINT

# Wait for all background processes
wait
