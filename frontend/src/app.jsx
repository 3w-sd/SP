// File: frontend/src/App.jsx
// This is the COMPLETE, FINALIZED file with the useParams fix.

import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, Link, useParams } from 'react-router-dom'; // <-- useParams IMPORTED HERE
import axios from 'axios';
import { jwtDecode } from 'jwt-decode'; 

// --- 1. API Setup (Axios) ---
const api = axios.create({
    baseURL: 'http://127.0.0.1:8000/api/',
});

// --- 2. Auth Context ---
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


    // This effect runs when authTokens change (on login/logout) and checks token expiry
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


// --- 5. Auth Page (Existing) ---
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

// --- 6. Profile Page (Existing) ---
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

const ProfileItem = ({ label, value }) => (
    <div className="flex justify-between items-center border-b pb-2">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        <span className="text-base text-gray-800 font-medium">{value}</span>
    </div>
);


// --- 7. Course & Enrollment Components ---

// --- Course List Page (Existing) ---
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

// --- Course Card (for List Page) ---
const CourseCard = ({ course }) => {
    const navigate = useNavigate();
    return (
        <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200 flex flex-col justify-between">
            <div>
                <span className="text-sm font-semibold text-indigo-600">{course.code}</span>
                <h2 className="text-xl font-bold text-gray-900 mt-1">{course.name}</h2>
                <p className="text-gray-600 text-sm mt-2">{course.description.substring(0, 100)}...</p>
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
    const { id } = useParams(); // <-- FIXED: CALLING useParams DIRECTLY
    const navigate = useNavigate();

    useEffect(() => {
        setLoading(true);
        api.get(`/courses/${id}/`)
            .then(res => setCourse(res.data))
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

    if (loading) return <p>Loading course details...</p>;
    if (!course) return <p>Course not found.</p>;

    const isInstructorOwner = user.role === 'LECTURER' && course.instructor?.id === user.user_id;
    const isAdmin = user.role === 'ADMIN';

    return (
        <div className="bg-white p-8 rounded-xl shadow-2xl">
            <span className="text-base font-semibold text-indigo-600">{course.code}</span>
            <h1 className="text-4xl font-extrabold text-gray-900 mt-1">{course.name}</h1>
            
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <InfoChip label="Department" value={course.department.name} />
                <InfoChip label="Credits" value={course.credits} />
                <InfoChip label="Instructor" value={course.instructor ? `${course.instructor.first_name} ${course.instructor.last_name}` : 'TBD'} />
            </div>
            
            <p className="text-gray-700 text-lg mt-6">{course.description}</p>
            
            <div className="mt-8 border-t pt-6 flex justify-between items-center">
                <div>
                    <p className="text-2xl font-bold text-gray-900">{course.seats_left} / {course.capacity}</p>
                    <p className="text-sm text-gray-500">Seats Remaining</p>
                </div>
                
                {/* --- Role-based Actions --- */}
                {user.role === 'STUDENT' && !course.is_full && (
                    <button 
                        onClick={handleEnroll}
                        disabled={loading}
                        className="px-6 py-3 bg-green-600 text-white rounded-lg shadow-lg text-lg font-semibold hover:bg-green-700 disabled:bg-gray-400"
                    >
                        {loading ? 'Enrolling...' : 'Enroll Now'}
                    </button>
                )}
                
                {(isAdmin || isInstructorOwner) && (
                    <div className="flex space-x-4">
                        <Link 
                            to={`/courses/${id}/manage`}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow-lg text-lg font-semibold hover:bg-blue-700"
                        >
                            Manage Enrollments
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
};

const InfoChip = ({ label, value }) => (
    <div className="bg-gray-100 p-4 rounded-lg">
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-lg font-semibold text-gray-900">{value}</p>
    </div>
);


// --- Student "My Enrollments" Page (Existing) ---
const MyEnrollmentsPage = () => {
    const { user, api, loading, setLoading } = useAuth();
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

// --- Instructor Manage Enrollments Page (Existing) ---
const ManageEnrollmentsPage = () => {
    const { api, loading, setLoading } = useAuth();
    const [enrollments, setEnrollments] = useState([]);
    const [course, setCourse] = useState(null);
    const { id } = useParams(); // <-- FIXED: CALLING useParams DIRECTLY

    useEffect(() => {
        setLoading(true);
        // Fetch enrollments (Instructors can use the 'students' custom action)
        api.get(`/courses/${id}/students/`)
            .then(res => setEnrollments(res.data))
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
            
        // Also fetch course info
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
                // FIX: Access the 'results' array if pagination is active, otherwise use the array directly
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

// --- Create/Edit Course Page (Finalized) ---
const CreateEditCoursePage = () => {
    const { user, api, loading, setLoading } = useAuth();
    const navigate = useNavigate();
    const [departments, setDepartments] = useState([]);
    const [instructors, setInstructors] = useState([]);
    const [formData, setFormData] = useState({
        name: '', code: '', description: '', credits: 3, capacity: 30,
        department: '', instructor: user.role === 'LECTURER' ? user.user_id : '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 months from now
    });
    
    // Function to fetch all required data
    const fetchData = useCallback(() => {
        setLoading(true);
        
        // 1. Fetch departments
        const deptPromise = api.get('/departments/').then(res => res.data.results || res.data);
        
        // 2. Fetch all users, then filter for lecturers
        // Note: Using a single GET request for all users is fine for a small project, 
        // but in production, we would use /users/?role=LECTURER
        const userPromise = api.get('/users/').then(res => {
            const lecturerList = (res.data.results || res.data).filter(u => u.role === 'LECTURER');
            return lecturerList;
        });

        Promise.all([deptPromise, userPromise])
            .then(([departmentData, userList]) => {
                setDepartments(departmentData);
                setInstructors(userList);
                
                // Set default department if none is selected
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

// Reusable Form Field Components
const InputField = ({ label, name, type = "text", value, onChange, required = false }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <input 
            type={type} 
            name={name} 
            value={value} 
            onChange={onChange} 
            required={required} 
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500" 
        />
    </div>
);

const TextAreaField = ({ label, name, value, onChange, rows, required = false }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <textarea 
            name={name} 
            value={value} 
            onChange={onChange} 
            rows={rows}
            required={required} 
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
                                    <Route 
                                        path="/courses" 
                                        element={<ProtectedRoute><CoursesListPage /></ProtectedRoute>} 
                                    />
                                    <Route 
                                        path="/courses/new" 
                                        element={<ProtectedRoute roles={['ADMIN', 'LECTURER']}><CreateEditCoursePage /></ProtectedRoute>} 
                                    />
                                    <Route 
                                        path="/courses/:id" 
                                        element={<ProtectedRoute><CourseDetailPage /></ProtectedRoute>} 
                                    />
                                    <Route 
                                        path="/courses/:id/manage" 
                                        element={<ProtectedRoute roles={['ADMIN', 'LECTURER']}><ManageEnrollmentsPage /></ProtectedRoute>} 
                                    />
                                    <Route 
                                        path="/my-enrollments" 
                                        element={<ProtectedRoute roles={['STUDENT']}><MyEnrollmentsPage /></ProtectedRoute>} 
                                    />
                                    <Route 
                                        path="/manage-departments" 
                                        element={<ProtectedRoute roles={['ADMIN']}><ManageDepartmentsPage /></ProtectedRoute>} 
                                    />
                                    
                                    {/* --- Original Core Routes --- */}
                                    <Route 
                                        path="/profile" 
                                        element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} 
                                    />

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

// Helper component to redirect logged-in users
const HomeRedirect = () => {
    const { user } = useAuth();
    if (!user) {
        return <Navigate to="/auth" replace />;
    }
    // All roles default to the courses page
    return <Navigate to="/courses" replace />;
};

export default App;