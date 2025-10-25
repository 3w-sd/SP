# Smart Portal: Academic Management System (Django/React)

This is a web-based Academic Management System, providing distinct dashboards for Admin, Lecturer, and Student roles using a modern API architecture.

This repository contains the core system plus a complete **Course and Enrollment Module**.

## 🛠️ Technology Stack

* **Backend:** Python 3.10+, Django 5.x, Django REST Framework, Django Rest Framework SimpleJWT, `django-filter`
* **Database:** MySQL (Configured for local use)
* **Frontend:** React (create-react-app), Tailwind CSS (via utility classes), Axios, React Router

---

## 🚀 Setup Instructions

### 1. Backend Setup (Django / Python)

1.  **Navigate to the backend directory:**
    ```bash
    cd backend
    ```

2.  **Create and activate a Python virtual environment:**
    ```bash
    python -m venv venv
    .\venv\Scripts\activate  # Windows
    # source venv/bin/activate # Linux/Mac
    ```

3.  **Install dependencies:**
    *Ensure you have `mysqlclient` (or `PyMySQL` as used here) dependencies installed on your system.*
    ```bash
    pip install -r requirements.txt
    ```

4.  **Configure MySQL:**
    * Ensure your MySQL server is running on port 3306.
    * Create a database named `smart_portal_db`.
    * **Edit `backend/smart_portal/settings.py`** and update the `NAME`, `USER`, and `PASSWORD` in the `DATABASES` section.

5.  **Run Migrations:**
    ```bash
    python manage.py makemigrations api
    python manage.py migrate
    ```

6.  **Create Users for Testing:**
    * **Admin:** `python manage.py createsuperuser`
    * **Instructor/Student:** Use the frontend registration form.

### 2. Frontend Setup (React / Node.js)

1.  **Navigate to the frontend directory:**
    ```bash
    cd frontend
    ```

2.  **Install Node dependencies:**
    ```bash
    npm install
    ```

### 3. Running the System

You must run the frontend and backend simultaneously in two separate terminal windows.

1.  **Terminal 1 (Backend):**
    ```bash
    cd backend
    .\venv\Scripts\activate  # Activate environment
    python manage.py runserver
    ```

2.  **Terminal 2 (Frontend):**
    ```bash
    cd frontend
    npm start
    ```

The application will open at `http://localhost:3000`.

---

## 📖 API Endpoint Documentation

Base URL: `http://127.0.0.1:8000/api/`

### Authentication

| Endpoint | Method | Action | Permissions |
| :--- | :--- | :--- | :--- |
| `/register/` | `POST` | Create a new user (Admin, Lecturer, or Student). | AllowAny |
| `/login/` | `POST` | Obtain JWT access and refresh tokens. | AllowAny |
| `/token/refresh/` | `POST` | Refresh an expired access token. | AllowAny |
| `/profile/` | `GET` | Get the profile of the logged-in user. | IsAuthenticated |

### Departments (Admin Only)

| Endpoint | Method | Action |
| :--- | :--- | :--- |
| `/departments/` | `GET` | List all departments. | IsAuthenticated |
| `/departments/` | `POST` | Create a new department. | IsAdmin |
| `/departments/<id>/` | `GET` | Retrieve a single department. | IsAuthenticated |
| `/departments/<id>/` | `PUT/PATCH` | Update a department. | IsAdmin |
| `/departments/<id>/` | `DELETE` | Delete a department. | IsAdmin |

### Courses

| Endpoint | Method | Action | Permissions |
| :--- | :--- | :--- | :--- |
| `/courses/` | `GET` | List/search/filter all courses. | IsAuthenticated |
| `/courses/` | `POST` | Create a new course. | IsAdmin or IsInstructor |
| `/courses/<id>/` | `GET` | Retrieve a single course. | IsAuthenticated |
| `/courses/<id>/` | `PUT/PATCH` | Update a course. | IsAdmin or IsInstructorOfCourse |
| `/courses/<id>/` | `DELETE` | Delete a course. | IsAdmin or IsInstructorOfCourse |
| `/courses/<id>/students/` | `GET` | List students enrolled in a course. | IsAdmin or IsInstructorOfCourse |

### Enrollments

| Endpoint | Method | Action | Permissions |
| :--- | :--- | :--- | :--- |
| `/enrollments/` | `GET` | List enrollments based on role. | IsAuthenticated |
| `/enrollments/` | `POST` | Enroll in a course. | IsStudent |
| `/enrollments/<id>/` | `DELETE` | Drop a course (delete enrollment). | IsStudentOwnerOfEnrollment |
| `/enrollments/my-courses/` | `GET` | List enrollments for the logged-in student. | IsStudent |

---

## 💡 Example API Usage (cURL)

*First, log in as a user (Admin, Student) to get an access token.*
`export ADMIN_TOKEN="...your_admin_access_token..."`
`export STUDENT_TOKEN="...your_student_access_token..."`

### 1. Create a Department (Admin Only)
```bash
curl -X POST [http://127.0.0.1:8000/api/departments/](http://127.0.0.1:8000/api/departments/) \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Computer Science", "code": "CS", "description": "Study of computing."}'