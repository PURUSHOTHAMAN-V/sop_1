#!/bin/bash

echo "Starting Retreivo Services..."

# Function to start backend
start_backend() {
    echo "Starting Backend Server..."
    cd sop/retreivo-backend
    npm run dev &
    BACKEND_PID=$!
    echo "Backend started with PID: $BACKEND_PID"
    cd ../..
}

# Function to start ML service
start_ml() {
    echo "Starting ML Service..."
    cd sop/ml-service
    # Activate virtual environment if it exists
    if [ -d "venv" ]; then
        source venv/bin/activate
    fi
    python app.py &
    ML_PID=$!
    echo "ML Service started with PID: $ML_PID"
    cd ../..
}

# Function to start frontend
start_frontend() {
    echo "Starting Frontend Server..."
    cd sop/retreivo-frontend
    npm run dev &
    FRONTEND_PID=$!
    echo "Frontend started with PID: $FRONTEND_PID"
    cd ../..
}

# Start all services
start_backend
sleep 3

start_ml
sleep 3

start_frontend

echo ""
echo "All services are starting..."
echo ""
echo "Access Points:"
echo "- Frontend: http://localhost:5173"
echo "- Backend API: http://localhost:5000"
echo "- ML Service: http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop all services"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Stopping all services..."
    kill $BACKEND_PID 2>/dev/null
    kill $ML_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "All services stopped."
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Wait for user to stop
wait