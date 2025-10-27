# Smart Portal: Academic Management System (Django/React)

This is a web-based Academic Management System, providing distinct dashboards for Admin, Lecturer, and Student roles using a modern API architecture.

**Current Modules Implemented:**
1.  **Core System** (Auth, Profile)
2.  **Course & Enrollment Management** (CRUD, Student Enrollment)
3.  **Smart Attendance System** (Lecture Scheduling, Geolocation/PIN check, Timezone aware reporting)

## 🛠️ Technology Stack

* **Backend:** Python 3.10+, Django 5.x, Django REST Framework, SimpleJWT, `django-filter`, `pytz`, `cryptography`
* **Database:** MySQL (Configured for local use)
* **Frontend:** React (create-react-app), Tailwind CSS, Axios, React Router

---

## 🚀 Setup & Launch Instructions

### 1. Backend Setup (Django / Python)

1.  **Navigate to the backend directory:**
    ```bash
    cd backend
    ```

2.  **Activate Virtual Environment:**
    ```bash
    .\venv\Scripts\activate  # Windows (PowerShell)
    # OR: source venv/bin/activate # Linux/Mac
    ```

3.  **Ensure Dependencies are Installed:**
    *(If you encountered the `cryptography` error, it's now fixed in the dependencies.)*
    ```bash
    pip install -r requirements.txt
    ```

4.  **Configure MySQL:**
    * Ensure your MySQL server is running on port 3306.
    * Confirm your `smart_portal_db` exists.
    * **Verify `backend/smart_portal/settings.py`** has the correct MySQL credentials.

5.  **Run Final Migrations (CRITICAL STEP):**
    ```bash
    python manage.py makemigrations api
    # (Provide necessary defaults for new fields if prompted)
    python manage.py migrate
    ```

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

1.  **Terminal 1 (Backend - Active `venv`):**
    ```bash
    python manage.py runserver
    ```

2.  **Terminal 2 (Frontend - New Terminal):**
    ```bash
    cd frontend
    npm start
    ```

The application will be live at `http://localhost:3000`.

---

## 📖 Attendance API Endpoints

Base URL: `http://127.0.0.1:8000/api/`

### Lectures (Scheduling and PINs)

| Endpoint | Method | Action | Permissions |
| :--- | :--- | :--- | :--- |
| `/lectures/` | `POST` | Create a new lecture schedule. | Admin, Instructor |
| `/lectures/<id>/generate_pin/` | `POST` | Generate or retrieve the active PIN for the lecture (valid for 10 minutes). | Admin, InstructorOwner |

### Attendance Marking

| Endpoint | Method | Action | Permissions |
| :--- | :--- | :--- | :--- |
| `/attendance/mark/` | `POST` | **Student Attendance:** Checks student location OR provided PIN against lecture time/location/PIN. | Student |
| `/attendance/manual-mark/` | `POST` | **Manual Override:** Instructor/Admin marks student status (Present/Absent/Late). | Admin, InstructorOwner |

### Attendance Reports

| Endpoint | Method | Action | Permissions |
| :--- | :--- | :--- | :--- |
| `/courses/<id>/attendance-report/` | `GET` | **Report Generation:** Generates statistical report (Present %, Total Sessions, etc.) for a specific course. | Admin, InstructorOwner |

## 💡 Example Attendance Workflow

1.  **Admin/Instructor** creates a new lecture via the frontend or Django Admin, setting a location (e.g., Lat: 34.0, Lon: -118.0) and a timezone (e.g., Africa/Cairo).
2.  **Instructor** goes to the **Schedule** page and clicks **Generate/Show PIN** for the lecture.
3.  **Student** views the course detail page, enters the PIN (or allows location access), and clicks **Mark Attendance**.
4.  The API validates the user's status (`status: PRESENT`).

---
