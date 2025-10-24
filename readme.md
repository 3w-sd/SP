Smart Portal: Academic Management System (Django/React)

This is the core implementation of a web-based Academic Management System, providing distinct dashboards for Admin, Lecturer, and Student roles using a modern API architecture.

🛠️ Technology Stack

Backend: Python 3.10+, Django 5.x, Django REST Framework, Django Rest Framework SimpleJWT

Database: MySQL (Configured for local use)

Frontend: React (create-react-app), Tailwind CSS (via utility classes), Axios

🚀 Setup Instructions

1. Backend Setup (Django / Python)

Navigate to the backend directory:

cd backend


Create and activate a Python virtual environment:

python -m venv venv
.\venv\Scripts\activate  # Windows
# source venv/bin/activate # Linux/Mac


Install dependencies:

pip install -r requirements.txt


Configure MySQL:

Ensure your MySQL server is running on port 3306.

Create a database named smart_portal_db (or whatever you prefer).

Edit backend/smart_portal/settings.py and update the NAME, USER, and PASSWORD fields in the DATABASES section to match your MySQL credentials.

Run Migrations: Initialize the database structure.

python manage.py makemigrations api
python manage.py migrate


Create Superuser: Create your first admin account.

python manage.py createsuperuser


2. Frontend Setup (React / Node.js)

Navigate to the frontend directory:

cd frontend


Install Node dependencies:

npm install


3. Running the System

You must run the frontend and backend simultaneously in two separate terminal windows.

Terminal 1 (Backend):

cd backend
.\venv\Scripts\activate  # Activate environment
python manage.py runserver 8000


Terminal 2 (Frontend):

cd frontend
npm start


The application will open in your browser (usually http://localhost:3000). You can now log in using the superuser account or register a new account with the role of your choice.