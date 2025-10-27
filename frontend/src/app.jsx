// File: frontend/src/App.jsx
// This is the COMPLETE, FINALIZED file with all modules and fixes.

import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

// --- 1. API Setup (Axios) ---
const api = axios.create({
    baseURL: 'http://127.0.0.1:8000/api/',
});

// --- 2. Auth Context & Hooks ---
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [authTokens, setAuthTokens] = useState(() =>
        localStorage.getItem('authTokens')
            ? JSON.parse(localStorage.getItem('authTokens'))
            : null
    );
    const [user, setUser] = useState(() =>
        localStorage.getItem('authTokens')
            ? jwtDecode(JSON.parse(localStorage.getItem('authTokens')).access)
            : null
    );
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();

    // Use useCallback for stable functions passed to useEffect
    const logoutUser = useCallback(() => {
        setAuthTokens(null);
        setUser(null);
        localStorage.removeItem('authTokens');
        navigate('/auth');
    }, [navigate]);

    const loginUser = async (email, password) => {
        setLoading(true);
        try {
            const response = await api.post('/login/', { email, password });
            if (response.status === 200) {
                const data = response.data;
                setAuthTokens(data);
                const decodedUser = jwtDecode(data.access);
                setUser(decodedUser);
                localStorage.setItem('authTokens', JSON.stringify(data));
                navigate('/courses'); // Redirect to main module after login
            }
        } catch (error) {
            console.error('Login failed:', error);
            const errorMessage = error.response?.data?.detail || 'Login failed. Please check your credentials.';
            alert(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const registerUser = async (userData) => {
        setLoading(true);
        try {
            await api.post('/register/', userData);
            await loginUser(userData.email, userData.password);
        } catch (err) {
            console.error('Registration failed:', err);
            const errorData = err.response?.data;
            let errorMessage = 'Registration failed.';
            if (errorData) {
                errorMessage = errorData.email?.[0] || errorData.detail || errorMessage;
            }
            alert(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (authTokens) {
            api.defaults.headers.common['Authorization'] = 'Bearer ' + authTokens.access;
        } else {
            delete api.defaults.headers.common['Authorization'];
        }

        const checkTokenExpiry = () => {
            if (authTokens) {
                const decodedToken = jwtDecode(authTokens.access);
                if (decodedToken.exp * 1000 < Date.now()) {
                    logoutUser();
                }
            }
        };
        checkTokenExpiry();

    }, [authTokens, logoutUser]);


    const contextData = {
        user,
        authTokens,
        loginUser,
        registerUser,
        logoutUser,
        api,
        loading,
        setLoading,
    };

    return (
        <AuthContext.Provider value={contextData}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);

// --- 3. Protected Route Component ---
const ProtectedRoute = ({ children, roles }) => {
    const { user } = useAuth();
    if (!user) return <Navigate to="/auth" replace />;
    if (roles && !roles.includes(user.role)) {
        return <Navigate to="/courses" replace />;
    }
    return children;
};

// --- 4. Main Layout ---
const MainLayout = ({ children }) => {
    const { user, logoutUser } = useAuth();

    return (
        <div className="min-h-screen bg-gray-100 font-inter">
            {user && (
                <nav className="bg-white shadow-md">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between h-16">
                            <div className="flex">
                                <Link to="/courses" className="flex-shrink-0 flex items-center font-bold text-indigo-600 rounded-lg p-2 transition duration-150 ease-in-out hover:bg-indigo-50">
                                    Smart Portal
                                </Link>
                                <div className="hidden sm:ml-6 sm:flex sm:space-x-4">
                                    <NavLink to="/courses">Courses</NavLink>
                                    {user.role === 'STUDENT' && (
                                        <NavLink to="/my-enrollments">My Enrollments</NavLink>
                                    )}
                                    {user.role === 'ADMIN' && (
                                        <NavLink to="/manage-departments">Departments</NavLink>
                                    )}
                                    {/* Link for Instructors/Admins to schedule lectures */}
                                    {(user.role === 'ADMIN' || user.role === 'LECTURER') && (
                                        <NavLink to="/schedule-lectures">Schedule</NavLink>
                                    )}
                                    <NavLink to="/profile">Profile</NavLink>
                                </div>
                            </div>
                            <div className="flex items-center">
                                <span className="text-sm text-gray-700 mr-4 hidden sm:inline">
                                    Welcome, **{user.first_name || user.email}** ({user.role})
                                </span>
                                <button
                                    onClick={logoutUser}
                                    className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition duration-150 shadow-md"
                                >
                                    Logout
                                </button>
                            </div>
                        </div>
                    </div>
                </nav>
            )}
            <main className="py-10">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
                    {children}
                </div>
            </main>
        </div>
    );
};

const NavLink = ({ to, children }) => (
    <Link
        to={to}
        className="inline-flex items-center px-3 pt-1 border-b-2 border-transparent text-sm font-medium text-gray-600 hover:border-indigo-500 hover:text-indigo-600 transition duration-150"
    >
        {children}
    </Link>
);

// --- 5. Reusable Form Field Components ---
const InputField = ({ label, name, type = "text", value, onChange, required = false, step, placeholder }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <input
            type={type}
            name={name}
            value={value}
            onChange={onChange}
            required={required}
            step={step}
            placeholder={placeholder}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
        />
    </div>
);

const TextAreaField = ({ label, name, value, onChange, rows, required = false, placeholder }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <textarea
            name={name}
            value={value}
            onChange={onChange}
            rows={rows}
            required={required}
            placeholder={placeholder}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
        />
    </div>
);

const SelectField = ({ label, name, value, onChange, options, isUser = false, required = false, disabled = false }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <select
            name={name}
            value={value}
            onChange={onChange}
            required={required}
            disabled={disabled}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white disabled:bg-gray-200"
        >
            <option value="">--- Select ---</option>
            {options.map(opt => (
                <option key={opt.id} value={opt.id}>
                    {isUser ? `${opt.first_name} ${opt.last_name} (${opt.email})` : `${opt.name} (${opt.code})`}
                </option>
            ))}
        </select>
    </div>
);

const InfoChip = ({ label, value }) => (
    <div className="bg-gray-100 p-4 rounded-lg">
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-lg font-semibold text-gray-900">{value}</p>
    </div>
);

const ProfileItem = ({ label, value }) => (
    <div className="flex justify-between items-center border-b pb-2">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        <span className="text-base text-gray-800 font-medium">{value}</span>
    </div>
);


// --- 6. Core Pages / Functional Components (Defined before App) ---

// --- Auth Page ---
const AuthPage = () => {
    const [isLogin, setIsLogin] = useState(true);
    const { loginUser, registerUser, loading } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [role, setRole] = useState('STUDENT');

    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (loading) return;

        if (isLogin) {
            await loginUser(email, password);
        } else {
            const userData = { email, password, first_name: firstName, last_name: lastName, role };
            await registerUser(userData);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
            <div className="p-8 bg-white rounded-xl shadow-2xl w-full max-w-md">
                <h2 className="text-3xl font-extrabold text-center text-gray-900 mb-8">
                    {isLogin ? 'Sign In' : 'Create Account'}
                </h2>
                {error && <p className="text-red-600 bg-red-100 p-3 rounded-lg text-center mb-4 border border-red-300">{error}</p>}
                <form onSubmit={handleSubmit} className="space-y-6">
                    {!isLogin && (
                        <>
                            <div className="flex space-x-4">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700">First Name</label>
                                    <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500" />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700">Last Name</label>
                                    <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Role</label>
                                <select value={role} onChange={(e) => setRole(e.target.value)} className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white">
                                    <option value="STUDENT">Student</option>
                                    <option value="LECTURER">Lecturer</option>
                                    <option value="ADMIN">Admin</option>
                                </select>
                            </div>
                        </>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Email</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Password</label>
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500" />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 px-4 border border-transparent rounded-lg shadow-lg text-lg font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
                    >
                        {loading ? 'Submitting...' : (isLogin ? 'Login' : 'Register')}
                    </button>
                    <p className="text-sm text-center text-gray-600">
                        {isLogin ? "Need an account? " : "Back to login? "}
                        <button type="button" onClick={() => setIsLogin(!isLogin)} className="font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none">
                            {isLogin ? 'Register Here' : 'Sign In'}
                        </button>
                    </p>
                </form>
            </div>
        </div>
    );
};

// --- Profile Page ---
const ProfilePage = () => {
    const { user, api, setLoading, loading } = useAuth();
    const [profile, setProfile] = useState(null);

    useEffect(() => {
        const fetchProfile = async () => {
            if (!user) return;
            setLoading(true);
            try {
                const response = await api.get('/profile/');
                setProfile(response.data);
            } catch (error) {
                console.error('Failed to fetch profile:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, [user, api, setLoading]);

    const displayUser = profile || user;

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <h1 className="text-3xl font-bold mb-6 text-indigo-700">Your Profile</h1>
            {loading ? (
                <p className="text-gray-600">Loading profile...</p>
            ) : displayUser ? (
                <div className="space-y-4">
                    <ProfileItem label="Email" value={displayUser.email} />
                    <ProfileItem label="First Name" value={displayUser.first_name} />
                    <ProfileItem label="Last Name" value={displayUser.last_name} />
                    <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                        <span className="text-sm font-semibold text-gray-600">Role</span>
                        <span className={`px-3 py-1 rounded-full text-sm font-bold shadow-sm ${
                            displayUser.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' :
                            displayUser.role === 'LECTURER' ? 'bg-green-100 text-green-800' :
                            'bg-blue-100 text-blue-800'
                        }`}>
                            {displayUser.role}
                        </span>
                    </div>
                </div>
            ) : (
                <p className="text-red-500">Could not load profile information.</p>
            )}
        </div>
    );
};


// --- Course List Page ---
const CoursesListPage = () => {
    const { user, api, loading, setLoading } = useAuth();
    const [courses, setCourses] = useState([]);
    const [search, setSearch] = useState('');

    useEffect(() => {
        setLoading(true);
        api.get('/courses/', { params: { search } })
            .then(res => setCourses(res.data.results || res.data))
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, [search, api, setLoading]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900">Available Courses</h1>
                {(user.role === 'ADMIN' || user.role === 'LECTURER') && (
                    <Link to="/courses/new" className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700">
                        Create Course
                    </Link>
                )}
            </div>
            <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by course name or code..."
                className="w-full p-3 border border-gray-300 rounded-lg"
            />
            {loading ? <p>Loading courses...</p> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {courses.map(course => <CourseCard key={course.id} course={course} />)}
                </div>
            )}
        </div>
    );
};

// --- Course Card ---
const CourseCard = ({ course }) => {
    const navigate = useNavigate();
    return (
        <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200 flex flex-col justify-between">
            <div>
                <span className="text-sm font-semibold text-indigo-600">{course.code}</span>
                <h2 className="text-xl font-bold text-gray-900 mt-1">{course.name}</h2>
                <p className="text-gray-600 text-sm mt-2">{course.description ? course.description.substring(0, 100) : ''}...</p>
                <p className="text-sm text-gray-800 mt-4">
                    Instructor: {course.instructor ? `${course.instructor.first_name} ${course.instructor.last_name}` : 'TBD'}
                </p>
            </div>
            <div className="mt-6 flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-800">
                    {course.seats_left} <span className="text-sm font-normal text-gray-500">seats left</span>
                </span>
                <button
                    onClick={() => navigate(`/courses/${course.id}`)}
                    className="px-4 py-2 bg-gray-800 text-white rounded-lg shadow hover:bg-gray-900"
                >
                    View Details
                </button>
            </div>
        </div>
    );
};

// --- Course Detail Page ---
const CourseDetailPage = () => {
    const { user, api, loading, setLoading } = useAuth();
    const [course, setCourse] = useState(null);
    const [lectures, setLectures] = useState([]);
    const [attendancePin, setAttendancePin] = useState('');
    const { id } = useParams();
    const navigate = useNavigate();

    useEffect(() => {
        setLoading(true);
        const coursePromise = api.get(`/courses/${id}/`);
        const lecturePromise = api.get(`/lectures/?course=${id}`);

        Promise.all([coursePromise, lecturePromise])
            .then(([courseRes, lectureRes]) => {
                setCourse(courseRes.data);
                setLectures(lectureRes.data.results || lectureRes.data);
            })
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, [id, api, setLoading]);

    const handleEnroll = async () => {
        if (loading) return;
        setLoading(true);
        try {
            await api.post('/enrollments/', { course: course.id });
            alert('Successfully enrolled!');
            navigate('/my-enrollments');
        } catch (err) {
            alert(err.response?.data?.course?.[0] || 'Enrollment failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleMarkAttendance = async (lectureId) => {
        if (loading) return;

        const isPinMode = !!attendancePin || (user.role === 'ADMIN' && user.master_pin);
        setLoading(true);

        const markAttendanceRequest = async (latitude = null, longitude = null) => {
             try {
                const payload = {
                    lecture: lectureId,
                    latitude: latitude,
                    longitude: longitude,
                    attendance_pin: attendancePin || (user.role === 'ADMIN' ? user.master_pin : null)
                };
                if (isPinMode) {
                    delete payload.latitude;
                    delete payload.longitude;
                }

                await api.post('/attendance/mark/', payload);
                alert('Attendance marked successfully! You are Present.');
            } catch (err) {
                const message = err.response?.data?.detail || 'Attendance failed due to network or server error.';
                alert(message);
            } finally {
                // setLoading(false) is handled in the Promise Race's finally block
                setAttendancePin(''); // Always clear pin
            }
        };

        if (isPinMode) {
            await markAttendanceRequest();
            setLoading(false); // Manually set loading false here for PIN mode
        } else {
             if (!navigator.geolocation) {
                setLoading(false);
                return alert("Geolocation is not supported by your browser for attendance.");
             }

            const geoPromise = new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                });
            });

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('TIMEOUT')), 15000)
            );

            try {
                console.log("Starting Geolocation Race...");
                const position = await Promise.race([geoPromise, timeoutPromise]);
                console.log("Geolocation Success:", position.coords);
                await markAttendanceRequest(position.coords.latitude, position.coords.longitude);
            } catch (error) {
                console.error("Geolocation Error:", error);
                if (error.message === 'TIMEOUT') {
                    alert("Location acquisition timed out (15s). Please check signal or try again.");
                } else if (error.code === 1) { // PERMISSION_DENIED
                    alert("Location permission denied. Attendance failed.");
                } else {
                    alert("Could not get your location. Attendance failed.");
                }
            } finally {
                 setLoading(false); // Ensure loading is false after race completes
            }
        }
    };

    if (loading && !course) return <p>Loading course details...</p>;
    if (!course) return <p>Course not found.</p>;

    const isInstructorOwner = user.role === 'LECTURER' && course.instructor?.id === user.user_id;
    const isAdmin = user.role === 'ADMIN';
    const isStudent = user.role === 'STUDENT';
    const isEnrolled = isStudent // Simplified check

    return (
        <div className="bg-white p-8 rounded-xl shadow-2xl space-y-8">
            {/* Course Header */}
            <div>
                <span className="text-base font-semibold text-indigo-600">{course.code}</span>
                <h1 className="text-4xl font-extrabold text-gray-900 mt-1">{course.name}</h1>
                <p className="text-gray-700 text-lg mt-4">{course.description}</p>
            </div>

            {/* Course Info Chips */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <InfoChip label="Department" value={course.department.name} />
                <InfoChip label="Credits" value={course.credits} />
                <InfoChip label="Instructor" value={course.instructor ? `${course.instructor.first_name} ${course.instructor.last_name}` : 'TBD'} />
            </div>

            {/* Enroll/Schedule Actions */}
            <div className="border-t pt-6 flex justify-between items-center">
                <div>
                    <p className="text-2xl font-bold text-gray-900">{course.seats_left} / {course.capacity}</p>
                    <p className="text-sm text-gray-500">Seats Remaining</p>
                </div>
                {isStudent && !course.is_full && (
                    <button
                        onClick={handleEnroll}
                        disabled={loading}
                        className="px-6 py-3 bg-green-600 text-white rounded-lg shadow-lg text-lg font-semibold hover:bg-green-700 disabled:bg-gray-400"
                    >
                        {loading ? 'Processing...' : 'Enroll Now'}
                    </button>
                )}
                 {(isAdmin || isInstructorOwner) && (
                    <Link
                        to={`/courses/${id}/schedule`}
                        className="px-6 py-3 bg-purple-600 text-white rounded-lg shadow-lg text-lg font-semibold hover:bg-purple-700"
                    >
                        Schedule Lectures
                    </Link>
                )}
            </div>

            {/* Lecture List and Attendance Marking (for Students) */}
            {isStudent && (
                 <div className="border-t pt-6 space-y-4">
                     <h2 className="text-2xl font-bold text-gray-800">Upcoming Lectures</h2>
                     {lectures.length === 0 && <p>No lectures scheduled yet.</p>}

                     <div className="space-y-3">
                        <input
                            type="text"
                            value={attendancePin}
                            onChange={(e) => setAttendancePin(e.target.value)}
                            placeholder="Enter Attendance PIN (or use location)"
                            className="w-full md:w-1/2 p-2 border border-gray-300 rounded-lg mr-2"
                        />
                         {lectures.map(lecture => (
                             <div key={lecture.id} className="p-4 border rounded-lg bg-gray-50 flex justify-between items-center">
                                 <div>
                                     <p className="font-semibold">{lecture.scheduled_date} | {lecture.start_time.substring(0, 5)} - {lecture.end_time.substring(0, 5)}</p>
                                     <p className="text-sm text-gray-600">Location: Lat {lecture.location_lat}, Lon {lecture.location_lon}</p>
                                 </div>
                                 <button
                                    onClick={() => handleMarkAttendance(lecture.id)}
                                    disabled={loading}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 disabled:bg-gray-400"
                                >
                                    {loading ? 'Processing...' : 'Mark Attendance'}
                                </button>
                             </div>
                         ))}
                     </div>
                 </div>
             )}

             {/* Admin/Instructor Links */}
             {(isAdmin || isInstructorOwner) && (
                 <div className="border-t pt-6 flex space-x-4">
                     <Link
                        to={`/courses/${id}/manage`}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow-lg text-lg font-semibold hover:bg-blue-700"
                    >
                        Manage Enrollments
                    </Link>
                     <Link
                        to={`/courses/${id}/attendance-report`}
                        className="px-6 py-3 bg-teal-600 text-white rounded-lg shadow-lg text-lg font-semibold hover:bg-teal-700"
                    >
                        View Attendance Report
                    </Link>
                 </div>
             )}
        </div>
    );
};


// --- Student "My Enrollments" Page ---
const MyEnrollmentsPage = () => {
    const { api, loading, setLoading } = useAuth();
    const [enrollments, setEnrollments] = useState([]);

    const fetchEnrollments = useCallback(() => {
        setLoading(true);
        api.get('/enrollments/my-courses/')
            .then(res => setEnrollments(res.data))
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, [api, setLoading]);

    useEffect(() => {
        fetchEnrollments();
    }, [fetchEnrollments]);

    const handleDrop = async (enrollmentId) => {
        if (loading || !window.confirm('Are you sure you want to drop this course?')) return;
        setLoading(true);
        try {
            await api.delete(`/enrollments/${enrollmentId}/`);
            alert('Course dropped successfully.');
            fetchEnrollments();
        } catch (err) {
            alert('Failed to drop course.');
        } finally {
            setLoading(false);
        }
    };

    if (loading && enrollments.length === 0) return <p>Loading your courses...</p>;

    return (
        <div className="bg-white p-8 rounded-xl shadow-2xl">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">My Enrollments</h1>
            <div className="space-y-4">
                {enrollments.length === 0 && <p>You are not enrolled in any courses.</p>}
                {enrollments.map(enr => (
                    <div key={enr.id} className="p-4 border border-gray-200 rounded-lg flex justify-between items-center">
                        <div>
                            <p className="text-xl font-bold">{enr.course.name} ({enr.course.code})</p>
                            <p className="text-sm text-gray-600">Instructor: {enr.course.instructor?.first_name || 'TBD'}</p>
                            <p className="text-sm text-gray-600">Grade: {enr.grade || 'N/A'}</p>
                        </div>
                        <div className="flex items-center space-x-4">
                            <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                                enr.status === 'ENROLLED' ? 'bg-green-100 text-green-800' :
                                enr.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800' :
                                'bg-red-100 text-red-800'
                            }`}>
                                {enr.status}
                            </span>
                            {enr.status === 'ENROLLED' && (
                                <button
                                    onClick={() => handleDrop(enr.id)}
                                    disabled={loading}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg shadow hover:bg-red-700 disabled:bg-gray-400"
                                >
                                    Drop
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- Instructor Manage Enrollments Page ---
const ManageEnrollmentsPage = () => {
    const { api, loading, setLoading } = useAuth();
    const [enrollments, setEnrollments] = useState([]);
    const [course, setCourse] = useState(null);
    const { id } = useParams();

    useEffect(() => {
        setLoading(true);
        api.get(`/courses/${id}/students/`)
            .then(res => setEnrollments(res.data))
            .catch(err => console.error(err))
            .finally(() => setLoading(false));

        api.get(`/courses/${id}/`).then(res => setCourse(res.data));
    }, [id, api, setLoading]);

    if (loading) return <p>Loading student list...</p>;

    return (
        <div className="bg-white p-8 rounded-xl shadow-2xl">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Manage Enrollments</h1>
            <h2 className="text-xl font-semibold text-indigo-600 mb-6">{course?.name} ({course?.code})</h2>
            <div className="space-y-4">
                {enrollments.length === 0 && <p>No students are currently enrolled.</p>}
                {enrollments.map(enr => (
                    <div key={enr.id} className="p-4 border border-gray-200 rounded-lg flex justify-between items-center">
                        <div>
                            <p className="text-lg font-bold">{enr.student.first_name} {enr.student.last_name}</p>
                            <p className="text-sm text-gray-600">{enr.student.email}</p>
                        </div>
                        <p className="text-lg font-semibold">Grade: {enr.grade || 'N/A'}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- Admin Manage Departments Page (CRUD) ---
const ManageDepartmentsPage = () => {
    const { api, loading, setLoading } = useAuth();
    const [departments, setDepartments] = useState([]);
    const [isAdding, setIsAdding] = useState(false);
    const [formData, setFormData] = useState({ name: '', code: '', description: '' });

    const fetchDepartments = useCallback(() => {
        setLoading(true);
        api.get('/departments/')
            .then(res => {
                const departmentData = res.data.results || res.data;
                setDepartments(departmentData);
            })
            .catch(err => alert('Failed to fetch departments.'))
            .finally(() => setLoading(false));
    }, [api, setLoading]);

    useEffect(() => {
        fetchDepartments();
    }, [fetchDepartments]);

    const handleFormChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleCreateUpdate = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (formData.id) {
                await api.patch(`/departments/${formData.id}/`, formData);
                alert('Department updated successfully.');
            } else {
                await api.post('/departments/', formData);
                alert('Department created successfully.');
            }
            fetchDepartments();
            setIsAdding(false);
            setFormData({ name: '', code: '', description: '' });
        } catch (err) {
            alert(err.response?.data?.code?.[0] || err.response?.data?.name?.[0] || 'Operation failed. Check if code/name is unique.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this department? All associated courses will be removed.')) return;
        setLoading(true);
        try {
            await api.delete(`/departments/${id}/`);
            alert('Department deleted successfully.');
            fetchDepartments();
        } catch (err) {
            alert('Deletion failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleEditClick = (dept) => {
        setFormData(dept);
        setIsAdding(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900">Manage Departments</h1>
                <button
                    onClick={() => {setIsAdding(true); setFormData({ name: '', code: '', description: '' });}}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700"
                >
                    Add New Department
                </button>
            </div>

            {isAdding && (
                <div className="bg-white p-6 rounded-xl shadow-lg border border-indigo-200">
                    <h2 className="text-xl font-bold mb-4">{formData.id ? 'Edit Department' : 'Create New Department'}</h2>
                    <form onSubmit={handleCreateUpdate} className="space-y-4">
                        <InputField label="Department Name" name="name" value={formData.name} onChange={handleFormChange} placeholder="Department Name" required />
                        <InputField label="Code (e.g., CS)" name="code" value={formData.code} onChange={handleFormChange} placeholder="Code (e.g., CS)" required />
                        <TextAreaField name="description" value={formData.description} onChange={handleFormChange} placeholder="Description" rows="3" />
                        <div className="flex space-x-4">
                            <button type="submit" disabled={loading} className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400">
                                {loading ? 'Saving...' : formData.id ? 'Update Department' : 'Create Department'}
                            </button>
                            <button type="button" onClick={() => setIsAdding(false)} className="flex-1 py-2 bg-gray-400 text-gray-800 rounded-lg hover:bg-gray-500">
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-white p-6 rounded-xl shadow-lg">
                <h2 className="text-xl font-bold mb-4">Department List</h2>
                {loading && departments.length === 0 ? <p>Loading...</p> : (
                    <div className="space-y-3">
                        {departments.map(dept => (
                            <div key={dept.id} className="p-4 border border-gray-100 rounded-lg flex justify-between items-center bg-gray-50">
                                <div>
                                    <p className="text-lg font-bold">{dept.name} ({dept.code})</p>
                                    <p className="text-sm text-gray-500">{dept.description}</p>
                                </div>
                                <div className="space-x-2">
                                    <button onClick={() => handleEditClick(dept)} className="px-3 py-1 text-sm bg-yellow-500 text-white rounded-lg hover:bg-yellow-600">Edit</button>
                                    <button onClick={() => handleDelete(dept.id)} className="px-3 py-1 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Create/Edit Course Page ---
const CreateEditCoursePage = () => {
    const { user, api, loading, setLoading } = useAuth();
    const navigate = useNavigate();
    const [departments, setDepartments] = useState([]);
    const [instructors, setInstructors] = useState([]);
    const [formData, setFormData] = useState({
        name: '', code: '', description: '', credits: 3, capacity: 30,
        department: '', instructor: user.role === 'LECTURER' ? user.user_id : '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });

    const fetchData = useCallback(() => {
        setLoading(true);

        const deptPromise = api.get('/departments/').then(res => res.data.results || res.data);

        const userPromise = api.get('/users/').then(res => {
            const lecturerList = (res.data.results || res.data).filter(u => u.role === 'LECTURER');
            return lecturerList;
        });

        Promise.all([deptPromise, userPromise])
            .then(([departmentData, userList]) => {
                setDepartments(departmentData);
                setInstructors(userList);

                if (!formData.department && departmentData.length > 0) {
                     setFormData(prev => ({...prev, department: departmentData[0].id}));
                }
            })
            .catch(err => {
                console.error("Failed to load course form data:", err);
                alert("Failed to load data for form. Check if users/departments exist.");
            })
            .finally(() => setLoading(false));
    }, [api, setLoading, formData.department]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleFormChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const payload = {
            ...formData,
            department: parseInt(formData.department),
            instructor: formData.instructor ? parseInt(formData.instructor) : null,
            credits: parseInt(formData.credits),
            capacity: parseInt(formData.capacity),
        };

        try {
            await api.post('/courses/', payload);
            alert('Course created successfully!');
            navigate('/courses');
        } catch (err) {
            console.error(err.response?.data);
            alert(err.response?.data?.code?.[0] || 'Failed to create course.');
        } finally {
            setLoading(false);
        }
    };

    if (loading && departments.length === 0) return <p>Loading necessary data...</p>;

    const isInstructor = user.role === 'LECTURER';

    return (
        <div className="bg-white p-8 rounded-xl shadow-2xl">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Create New Course</h1>
            <form onSubmit={handleSubmit} className="space-y-6">

                {/* Basic Course Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputField label="Course Name" name="name" value={formData.name} onChange={handleFormChange} required />
                    <InputField label="Course Code (Unique)" name="code" value={formData.code} onChange={handleFormChange} required />
                </div>

                <TextAreaField label="Description" name="description" value={formData.description} onChange={handleFormChange} rows="3" />

                {/* Credits & Capacity */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <InputField label="Credits" name="credits" type="number" value={formData.credits} onChange={handleFormChange} required />
                    <InputField label="Capacity" name="capacity" type="number" value={formData.capacity} onChange={handleFormChange} required />
                    <SelectField label="Department" name="department" value={formData.department} onChange={handleFormChange} options={departments} required disabled={loading} />
                </div>

                {/* Instructor & Dates */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <SelectField
                        label="Instructor"
                        name="instructor"
                        value={formData.instructor}
                        onChange={handleFormChange}
                        options={instructors}
                        isUser={true}
                        required={!isInstructor}
                        disabled={loading || isInstructor}
                    />
                    <InputField label="Start Date" name="start_date" type="date" value={formData.start_date} onChange={handleFormChange} required />
                    <InputField label="End Date" name="end_date" type="date" value={formData.end_date} onChange={handleFormChange} required />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-indigo-600 text-white rounded-lg text-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400"
                >
                    {loading ? 'Submitting...' : 'Create Course'}
                </button>
            </form>
        </div>
    );
};

// --- NEW: Lecture Schedule Page ---
const LectureSchedulePage = () => {
    const { user, api, loading, setLoading } = useAuth();
    const [courses, setCourses] = useState([]);
    const [selectedCourseId, setSelectedCourseId] = useState('');
    const [lectures, setLectures] = useState([]);
    const [formData, setFormData] = useState({
        course: '', scheduled_date: new Date().toISOString().split('T')[0], start_time: '', end_time: '',
        location_lat: '', location_lon: '', attendance_radius: 100, timezone: 'Africa/Cairo' // Default Cairo
    });
    const [currentPin, setCurrentPin] = useState(null);

    // Fetch courses based on role
    useEffect(() => {
        setLoading(true);
        const url = user.role === 'ADMIN' ? '/courses/' : '/courses/?instructor=' + user.user_id;
        api.get(url)
            .then(res => {
                const courseData = res.data.results || res.data;
                setCourses(courseData);
                if (courseData.length > 0) {
                    setSelectedCourseId(courseData[0].id);
                }
            })
            .catch(err => alert("Failed to load courses."))
            .finally(() => setLoading(false));
    }, [api, setLoading, user]);

    // Fetch lectures when selected course changes
    useEffect(() => {
        if (!selectedCourseId) return;
        setLoading(true);
        api.get(`/lectures/?course=${selectedCourseId}`)
            .then(res => setLectures(res.data.results || res.data))
            .catch(err => alert("Failed to load lectures for this course."))
            .finally(() => setLoading(false));
    }, [selectedCourseId, api, setLoading]);

    const handleFormChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    // Handle lecture creation
    const handleCreateLecture = async (e) => {
        e.preventDefault();
        setLoading(true);
        const payload = { ...formData, course: selectedCourseId };
        try {
            await api.post('/lectures/', payload);
            alert('Lecture scheduled successfully!');
            // Refresh lectures for the selected course
            const res = await api.get(`/lectures/?course=${selectedCourseId}`);
            setLectures(res.data.results || res.data);
            // Reset form
            setFormData(prev => ({
                ...prev, scheduled_date: new Date().toISOString().split('T')[0], start_time: '', end_time: '',
                location_lat: '', location_lon: '', attendance_radius: 100
            }));
        } catch (err) {
            console.error(err.response?.data);
            let errorMessage = "Failed to schedule lecture.";
            if (err.response?.data) {
                 const errors = err.response.data;
                 const firstErrorField = Object.keys(errors)[0];
                 if(firstErrorField && Array.isArray(errors[firstErrorField]) && errors[firstErrorField].length > 0) {
                      errorMessage = `${firstErrorField}: ${errors[firstErrorField][0]}`;
                 } else if (errors.detail) {
                     errorMessage = errors.detail;
                 } else if (errors.non_field_errors && errors.non_field_errors.length > 0) {
                    errorMessage = errors.non_field_errors[0];
                 }
            }
            alert(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    // Generate PIN for a specific lecture
    const handleGeneratePin = async (lectureId) => {
         setLoading(true);
         setCurrentPin('Generating...');
         try {
             const res = await api.post(`/lectures/${lectureId}/generate_pin/`);
             setCurrentPin(`${res.data.pin}-${lectureId}`);
         } catch (err) {
             setCurrentPin('Error');
             alert("Failed to generate PIN.");
         } finally {
            setLoading(false);
         }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-900">Schedule Lectures</h1>

            {/* Course Selection Dropdown */}
            <div className="bg-white p-4 rounded-lg shadow">
                 <label className="block text-sm font-medium text-gray-700 mb-1">Select Course to Manage</label>
                 <select
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg bg-white"
                    disabled={loading}
                 >
                     <option value="">-- Select Course --</option>
                     {courses.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                 </select>
            </div>

            {/* Create Lecture Form */}
            {selectedCourseId && (
                <div className="bg-white p-6 rounded-xl shadow-lg border border-indigo-200">
                    <h2 className="text-xl font-bold mb-4">Add New Lecture</h2>
                    <form onSubmit={handleCreateLecture} className="space-y-4">
                        {/* Date and Time */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <InputField label="Date" name="scheduled_date" type="date" value={formData.scheduled_date} onChange={handleFormChange} required />
                            <InputField label="Start Time" name="start_time" type="time" value={formData.start_time} onChange={handleFormChange} required />
                            <InputField label="End Time" name="end_time" type="time" value={formData.end_time} onChange={handleFormChange} required />
                            {/* Timezone Selection */}
                             <div>
                                <label className="block text-sm font-medium text-gray-700">Timezone</label>
                                <select
                                    name="timezone"
                                    value={formData.timezone}
                                    onChange={handleFormChange}
                                    required
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                                >
                                    <option value="Africa/Cairo">Cairo</option>
                                    <option value="Africa/Khartoum">Khartoum</option>
                                    <option value="UTC">UTC</option>
                                </select>
                             </div>
                        </div>
                        {/* Location */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <InputField label="Latitude" name="location_lat" type="number" step="any" value={formData.location_lat} onChange={handleFormChange} placeholder="e.g., 34.0522" required/>
                            <InputField label="Longitude" name="location_lon" type="number" step="any" value={formData.location_lon} onChange={handleFormChange} placeholder="e.g., -118.2437" required/>
                            <InputField label="Radius (Meters)" name="attendance_radius" type="number" value={formData.attendance_radius} onChange={handleFormChange} required />
                        </div>
                        <button type="submit" disabled={loading} className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400">
                            {loading ? 'Scheduling...' : 'Schedule Lecture'}
                        </button>
                    </form>
                </div>
            )}

             {/* List of Scheduled Lectures */}
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <h2 className="text-xl font-bold mb-4">Scheduled Lectures for Selected Course</h2>
                 {loading && lectures.length === 0 && <p>Loading lectures...</p>}
                 {!loading && lectures.length === 0 && <p>No lectures scheduled for this course yet.</p>}
                 <div className="space-y-3">
                     {lectures.map(lec => (
                         <div key={lec.id} className="p-4 border rounded-lg bg-gray-50 flex justify-between items-center">
                             <div>
                                 <p className="font-semibold">{lec.scheduled_date} | {lec.start_time.substring(0,5)} - {lec.end_time.substring(0,5)} ({lec.timezone})</p>
                                 <p className="text-sm text-gray-600">PIN: {lec.attendance_pin || 'Not Generated'} ({lec.is_pin_active ? 'Active' : 'Expired'})</p>
                             </div>
                             <div>
                                 {/* Display current PIN if generated */}
                                 {currentPin && lec.id === parseInt(currentPin.split('-')[1]) && ( // Simple check
                                    <span className="font-mono text-lg font-bold mr-4">{currentPin.split('-')[0]}</span>
                                 )}
                                 <button
                                     onClick={() => handleGeneratePin(lec.id)}
                                     className="px-3 py-1 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                                     disabled={loading}
                                 >
                                     Generate/Show PIN
                                 </button>
                             </div>
                         </div>
                     ))}
                 </div>
            </div>
        </div>
    );
};


// --- Attendance Report Page ---
const AttendanceReportPage = () => {
    const { api, loading, setLoading } = useAuth();
    const [report, setReport] = useState(null);
    const { id } = useParams(); // Course ID from URL

    useEffect(() => {
        setLoading(true);
        // FIX: Updated URL to match the one in CourseViewSet
        api.get(`/courses/${id}/attendance-report/`) 
            .then(res => setReport(res.data))
            .catch(err => alert("Failed to fetch attendance report."))
            .finally(() => setLoading(false));
    }, [id, api, setLoading]);

    if (loading || !report) return <p>Generating attendance report...</p>;

    return (
        <div className="bg-white p-8 rounded-xl shadow-2xl">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Attendance Report: {report.course_code}</h1>
            <p className="text-xl font-semibold text-indigo-600 mb-6">Total Sessions Tracked: {report.total_sessions_tracked}</p>

            <table className="min-w-full divide-y divide-gray-200">
                <thead>
                    <tr>
                        <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student Name</th>
                        <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Present</th>
                        <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Absent</th>
                        <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Late</th>
                        <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attendance %</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {report.student_summary.map((stat, index) => (
                        <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowJrap text-sm font-medium text-gray-900">{stat.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-semibold">{stat.present}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-semibold">{stat.absent}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600 font-semibold">{stat.late}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-indigo-700">{stat.attendance_percentage}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};


// --- Helper component to redirect logged-in users ---
const HomeRedirect = () => {
    const { user } = useAuth();
    if (!user) {
        return <Navigate to="/auth" replace />;
    }
    // All roles default to the courses page
    return <Navigate to="/courses" replace />;
};

// --- 8. Main App Component (Routing) ---
function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    {/* Public Route */}
                    <Route path="/auth" element={<AuthPage />} />

                    {/* Routes inside MainLayout */}
                    <Route
                        path="/*"
                        element={
                            <MainLayout>
                                <Routes>
                                    {/* --- Course & Enrollment Routes --- */}
                                    <Route path="/courses" element={<ProtectedRoute><CoursesListPage /></ProtectedRoute>} />
                                    <Route path="/courses/new" element={<ProtectedRoute roles={['ADMIN', 'LECTURER']}><CreateEditCoursePage /></ProtectedRoute>} />
                                    <Route path="/courses/:id" element={<ProtectedRoute><CourseDetailPage /></ProtectedRoute>} />
                                    <Route path="/courses/:id/manage" element={<ProtectedRoute roles={['ADMIN', 'LECTURER']}><ManageEnrollmentsPage /></ProtectedRoute>} />
                                    <Route path="/my-enrollments" element={<ProtectedRoute roles={['STUDENT']}><MyEnrollmentsPage /></ProtectedRoute>} />
                                    <Route path="/manage-departments" element={<ProtectedRoute roles={['ADMIN']}><ManageDepartmentsPage /></ProtectedRoute>} />

                                    {/* --- Lecture & Attendance Routes --- */}
                                    <Route
                                        path="/courses/:id/schedule"
                                        element={<ProtectedRoute roles={['ADMIN', 'LECTURER']}><LectureSchedulePage /></ProtectedRoute>}
                                    />
                                     <Route
                                        path="/schedule-lectures"
                                        element={<ProtectedRoute roles={['ADMIN', 'LECTURER']}><LectureSchedulePage /></ProtectedRoute>}
                                    />
                                    {/* FIX: Corrected route for attendance report */}
                                    <Route
                                        path="/courses/:id/attendance-report"
                                        element={<ProtectedRoute roles={['ADMIN', 'LECTURER']}><AttendanceReportPage /></ProtectedRoute>}
                                    />

                                    {/* --- Original Core Routes --- */}
                                    <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

                                    {/* Root path redirect */}
                                    <Route path="/" element={<HomeRedirect />} />
                                    {/* 404 Fallback */}
                                    <Route path="*" element={<Navigate to="/courses" replace />} />
                                </Routes>
                            </MainLayout>
                        }
                    />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;