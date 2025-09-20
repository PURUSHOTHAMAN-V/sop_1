# Retreivo - Start All Services

This guide will help you start all Retreivo services without Docker.

## Prerequisites

- Node.js 18+ 
- Python 3.10+
- PostgreSQL 13+ (already running with credentials: postgres/Vpcare@24x7)

## Quick Start

### Option 1: Use the Batch Script (Windows)
```bash
# Double-click or run:
start-all.bat
```

### Option 2: Manual Start (All Platforms)

#### 1. Start Backend Service
```bash
cd sop/retreivo-backend
npm run dev
```
Backend will run on http://localhost:5000

#### 2. Start ML Service
```bash
cd sop/ml-service
python app.py
```
ML service will run on http://localhost:8000

#### 3. Start Frontend Service
```bash
cd sop/retreivo-frontend
npm run dev
```
Frontend will run on http://localhost:5173

## Access Points

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000
- **ML Service**: http://localhost:8000
- **Database**: localhost:5432

## Features Implemented

### ✅ Real Image Search with ML Matching
- Upload images to search for similar items
- Uses OpenCV ORB features for image matching
- Combines image similarity with text matching
- Stores image features in SQLite database

### ✅ Claims Management with Fraud Detection
- Real-time fraud score calculation based on:
  - User claim history and success rate
  - Account age
  - Claim frequency
  - Item value estimation
- Fraud score slider filter (0-100)
- Approve/Reject/Partial Verification actions
- Hub messages for users

### ✅ Claim History System
- Users can view all their claims
- Real-time status updates from hub
- Hub messages displayed
- Status: Pending, Approved, Rejected, Partial Verification

### ✅ Rewards System
- Real rewards based on successful item returns
- Automatic reward calculation when claims are approved
- Level system (Bronze, Silver, Gold, Platinum)
- Transaction history

### ✅ Safe Search Results
- Only shows item name and category (no personal details)
- "Further details will be provided by hub if approved" message
- Items remain visible until hub approval

### ✅ Database Integration
- PostgreSQL for main data
- SQLite for ML features storage
- Real-time data synchronization

## API Endpoints

### Backend (http://localhost:5000)
- `GET /api/health` - Health check
- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login
- `GET /api/user/claim-history` - User claim history
- `GET /api/user/rewards` - User rewards
- `GET /api/hub/claims` - Hub claims with fraud scores
- `PUT /api/hub/claim/:id/approve` - Approve claim
- `PUT /api/hub/claim/:id/reject` - Reject claim
- `PUT /api/hub/claim/:id/partial` - Partial verification

### ML Service (http://localhost:8000)
- `GET /health` - Health check
- `POST /store-item` - Store item with ML features
- `POST /match-item` - Match items using ML
- `POST /detect-fraud` - Fraud detection

## Troubleshooting

1. **Port Conflicts**: Change ports in respective .env files
2. **Database Issues**: Ensure PostgreSQL is running
3. **Python Dependencies**: Run `pip install -r requirements.txt` in ml-service
4. **Node Dependencies**: Run `npm install` in backend and frontend

## Development Notes

- All mock data has been removed
- Real ML algorithms implemented
- Fraud detection based on user behavior patterns
- Image matching using OpenCV ORB features
- Real-time status updates
- Comprehensive error handling