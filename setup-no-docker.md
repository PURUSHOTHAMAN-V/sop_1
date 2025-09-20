# Retreivo Setup Without Docker

This guide will help you run the Retreivo project directly on your system without Docker.

## Prerequisites

- Node.js 18+ 
- Python 3.10+
- PostgreSQL 13+ (standalone installation)
- Git

## Database Setup

1. **Install PostgreSQL** (if not already installed):
   - Windows: Download from https://www.postgresql.org/download/windows/
   - macOS: `brew install postgresql@13`
   - Linux: `sudo apt-get install postgresql-13`

2. **Create Database and User**:
   ```sql
   -- Connect to PostgreSQL as superuser
   psql -U postgres

   -- Create database
   CREATE DATABASE retreivo;

   -- Create user (optional, or use existing postgres user)
   CREATE USER retreivo_user WITH PASSWORD 'Vpcare@24x7';
   GRANT ALL PRIVILEGES ON DATABASE retreivo TO retreivo_user;

   -- Exit psql
   \q
   ```

3. **Run Database Migrations**:
   ```bash
   # Navigate to backend directory
   cd sop/retreivo-backend

   # Run the migration script
   psql -U postgres -d retreivo -f migrations/0001_init.sql
   ```

## Backend Setup

1. **Navigate to backend directory**:
   ```bash
   cd sop/retreivo-backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Create environment file**:
   ```bash
   # Create .env file
   echo "DATABASE_URL=postgresql://postgres:Vpcare@24x7@localhost:5432/retreivo" > .env
   echo "JWT_SECRET=your-super-secret-jwt-key-change-this-in-production" >> .env
   echo "PORT=5000" >> .env
   echo "ML_SERVICE_URL=http://localhost:8000" >> .env
   ```

4. **Start backend server**:
   ```bash
   npm run dev
   ```
   Backend will run on http://localhost:5000

## ML Service Setup

1. **Navigate to ML service directory**:
   ```bash
   cd sop/ml-service
   ```

2. **Create Python virtual environment**:
   ```bash
   python -m venv venv
   
   # Windows
   venv\Scripts\activate
   
   # macOS/Linux
   source venv/bin/activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Start ML service**:
   ```bash
   python app.py
   ```
   ML service will run on http://localhost:8000

## Frontend Setup

1. **Navigate to frontend directory**:
   ```bash
   cd sop/retreivo-frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Create environment file**:
   ```bash
   # Create .env file
   echo "VITE_API_URL=http://localhost:5000" > .env
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```
   Frontend will run on http://localhost:5173

## Running All Services

You'll need to run each service in separate terminal windows:

### Terminal 1 - Backend:
```bash
cd sop/retreivo-backend
npm run dev
```

### Terminal 2 - ML Service:
```bash
cd sop/ml-service
source venv/bin/activate  # On Windows: venv\Scripts\activate
python app.py
```

### Terminal 3 - Frontend:
```bash
cd sop/retreivo-frontend
npm run dev
```

## Access Points

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000
- **ML Service**: http://localhost:8000
- **Database**: localhost:5432

## Troubleshooting

1. **Database Connection Issues**:
   - Ensure PostgreSQL is running
   - Check database credentials in .env file
   - Verify database exists and migrations are applied

2. **Port Conflicts**:
   - Backend: Change PORT in backend/.env
   - Frontend: Change port in package.json scripts
   - ML Service: Change port in app.py

3. **Python Dependencies**:
   - Ensure you're using Python 3.10+
   - Try upgrading pip: `pip install --upgrade pip`
   - For OpenCV issues: `pip install opencv-python-headless`

4. **Node.js Issues**:
   - Clear node_modules and reinstall: `rm -rf node_modules && npm install`
   - Check Node.js version: `node --version`

## Production Notes

- Change JWT_SECRET to a secure random string
- Use environment variables for all sensitive data
- Consider using PM2 for process management
- Set up proper logging and monitoring
- Configure reverse proxy (nginx) for production