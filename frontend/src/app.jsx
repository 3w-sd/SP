import React, { createContext, useState, useContext, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode'; // Fixed: Use the standard named import

// --- 1. API Setup (Axios) ---

// Create an Axios instance for making API requests
const api = axios.create({
    baseURL: 'http://127.0.0.1:8000/api/',
});

// --- 2. Auth Context ---
// This context will hold auth state (user, tokens) and functions (login, logout)

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    // Load auth tokens from localStorage on initial render
    const [authTokens, setAuthTokens] = useState(() =>
        localStorage.getItem('authTokens')
            ? JSON.parse(localStorage.getItem('authTokens'))
            : null
    );

    // Load user info from localStorage
    const [user, setUser] = useState(() =>
        localStorage.getItem('authTokens')
            ? jwtDecode(JSON.parse(localStorage.getItem('authTokens')).access)
            : null
    );

    const navigate = useNavigate();

    /**
     * Handles user login.
     * @param {string} email
     * @param {string} password
     */
    const loginUser = async (email, password) => {
        try {
            const response = await api.post('/login/', { email, password });
            if (response.status === 200) {
                const data = response.data;
                // Set tokens and user in state and localStorage
                setAuthTokens(data);
                
                const decodedUser = jwtDecode(data.access); // Use standard jwtDecode
                setUser(decodedUser);
                localStorage.setItem('authTokens', JSON.stringify(data));
                
                // Navigate to the correct dashboard based on role
                const userRole = decodedUser.role; 
                redirectToDashboard(userRole);
            }
        } catch (error) {
            console.error('Login failed:', error);
            // You should add error handling here (e.g., set an error message state)
            // NOTE: Custom modal/message box should be used instead of alert() in production.
            alert('Login failed. Please check your credentials.'); 
        }
    };

    /**
     * Handles user logout.
     */
    const logoutUser = () => {
        // Clear state and localStorage
        setAuthTokens(null);
        setUser(null);
        localStorage.removeItem('authTokens');
        // Redirect to login page
        navigate('/auth');
    };

    /**
     * Redirects user to their dashboard based on role.
     * @param {string} role - User's role (ADMIN, LECTURER, STUDENT)
     */
    const redirectToDashboard = (role) => {
        switch (role) {
            case 'ADMIN':
                navigate('/admin');
                break;
            case 'LECTURER':
                navigate('/lecturer');
                break;
            case 'STUDENT':
                navigate('/student');
                break;
            default:
                navigate('/profile'); // Fallback
        }
    };

    // Context value
    const contextData = {
        user,
        authTokens,
        loginUser,
        logoutUser,
    };

    // This effect runs when authTokens change to update the Axios header
    useEffect(() => {
        if (authTokens) {
            api.defaults.headers.common['Authorization'] = 'Bearer ' + authTokens.access;
        } else {
            delete api.defaults.headers.common['Authorization'];
        }
    }, [authTokens]);


    return (
        <AuthContext.Provider value={contextData}>
            {children}
        </AuthContext.Provider>
    );
};

// Custom hook to use the AuthContext
export const useAuth = () => useContext(AuthContext);

// --- 3. Protected Route Component ---

/**
 * A wrapper for routes that require authentication.
 * @param {{ children: React.ReactNode, roles: string[] }} props
 */
const ProtectedRoute = ({ children, roles }) => {
    const { user } = useAuth();

    if (!user) {
        // Not logged in, redirect to login page
        return <Navigate to="/auth" replace />;
    }

    if (roles && !roles.includes(user.role)) {
        // Logged in, but does not have the required role
        // Redirect to their profile or a "Not Authorized" page
        return <Navigate to="/profile" replace />;
    }

    // User is authenticated and has the correct role
    return children;
};

// --- 4. Page Components ---

/**
 * Main Layout with Navigation
 */
const MainLayout = ({ children }) => {
    const { user, logoutUser } = useAuth();

    return (
        <div className="min-h-screen bg-gray-100">
            {user && (
                <nav className="bg-white shadow-md">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between h-16">
                            <div className="flex">
                                <Link to="/profile" className="flex-shrink-0 flex items-center font-bold text-indigo-600">
                                    Smart Portal
                                </Link>
                                <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                                    {/* Role-based navigation */}
                                    {user.role === 'ADMIN' && (
                                        <Link to="/admin" className="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700">Admin Dashboard</Link>
                                    )}
                                    {user.role === 'LECTURER' && (
                                        <Link to="/lecturer" className="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700">Lecturer Dashboard</Link>
                                    )}
                                    {user.role === 'STUDENT' && (
                                        <Link to="/student" className="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700">Student Dashboard</Link>
                                    )}
                                    <Link to="/profile" className="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700">Profile</Link>
                                </div>
                            </div>
                            <div className="flex items-center">
                                <span className="text-sm text-gray-700 mr-4">Welcome, {user.first_name || user.email}</span>
                                <button
                                    onClick={logoutUser}
                                    className="px-3 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
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

/**
 * Page for Login and Registration
 */
const AuthPage = () => {
    const [isLogin, setIsLogin] = useState(true);
    const { loginUser } = useAuth();
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [role, setRole] = useState('STUDENT');
    
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (isLogin) {
            // Handle Login
            await loginUser(email, password);
        } else {
            // Handle Register
            try {
                const response = await api.post('/register/', {
                    email,
                    password,
                    first_name: firstName,
                    last_name: lastName,
                    role,
                });
                if (response.status === 201) {
                    // Automatically log in the user after successful registration
                    await loginUser(email, password);
                }
            } catch (err) {
                console.error('Registration failed:', err);
                setError(err.response?.data?.email?.[0] || 'Registration failed.');
            }
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <div className="p-8 bg-white rounded-lg shadow-md w-full max-w-md">
                <h2 className="text-2xl font-bold text-center text-gray-900 mb-6">
                    {isLogin ? 'Login to Smart Portal' : 'Create an Account'}
                </h2>
                {error && <p className="text-red-500 text-center mb-4">{error}</p>}
                <form onSubmit={handleSubmit} className="space-y-6">
                    {!isLogin && (
                        <>
                            <div className="flex space-x-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">First Name</label>
                                    <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Last Name</label>
                                    <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Role</label>
                                <select value={role} onChange={(e) => setRole(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white">
                                    <option value="STUDENT">Student</option>
                                    <option value="LECTURER">Lecturer</option>
                                    <option value="ADMIN">Admin</option>
                                </select>
                            </div>
                        </>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Email</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Password</label>
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                    </div>
                    <button type="submit" className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                        {isLogin ? 'Login' : 'Register'}
                    </button>
                    <p className="text-sm text-center">
                        {isLogin ? "Don't have an account? " : "Already have an account? "}
                        <button type="button" onClick={() => setIsLogin(!isLogin)} className="font-medium text-indigo-600 hover:text-indigo-500">
                            {isLogin ? 'Register' : 'Login'}
                        </button>
                    </p>
                </form>
            </div>
        </div>
    );
};

/**
 * Profile Page (Fallback for all roles)
 */
const ProfilePage = () => {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth(); // Get user from context to show fallback info

    useEffect(() => {
        const fetchProfile = async () => {
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
    }, []);

    const displayUser = profile || user; // Use fetched profile, or fallback to JWT user

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h1 className="text-2xl font-bold mb-4">Your Profile</h1>
            {loading ? (
                <p>Loading profile...</p>
            ) : displayUser ? (
                <ul className="space-y-2">
                    <li><strong>Email:</strong> {displayUser.email}</li>
                    <li><strong>First Name:</strong> {displayUser.first_name}</li>
                    <li><strong>Last Name:</strong> {displayUser.last_name}</li>
                    <li><strong>Role:</strong> <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-sm font-medium">{displayUser.role}</span></li>
                </ul>
            ) : (
                <p>Could not load profile information.</p>
            )}
        </div>
    );
};

/**
 * Role-specific Dashboards
 */
const AdminDashboard = () => (
    <div className="bg-white p-6 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
        <p>Welcome, Admin. Here you can manage users, departments, and courses.</p>
        {/* Admin-specific components would go here */}
    </div>
);

const LecturerDashboard = () => (
    <div className="bg-white p-6 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-4">Lecturer Dashboard</h1>
        <p>Welcome, Lecturer. Here you can manage your courses, view enrolled students, and manage grades.</p>
        {/* Lecturer-specific components would go here */}
    </div>
);

const StudentDashboard = () => (
    <div className="bg-white p-6 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-4">Student Dashboard</h1>
        <p>Welcome, Student. Here you can view your enrolled courses, grades, and register for new courses.</p>
        {/* Student-specific components would go here */}
    </div>
);

// --- 5. Main App Component (Routing) ---

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                {/* AuthProvider needs access to navigate, so it's inside BrowserRouter */}
                {/* We wrap routes in MainLayout to provide nav/header */}
                <Routes>
                    {/* Public Routes */}
                    <Route path="/auth" element={<AuthPage />} />
                    
                    {/* Routes inside MainLayout */}
                    <Route
                        path="/*"
                        element={
                            <MainLayout>
                                <Routes>
                                    {/* Protected Routes */}
                                    <Route path="/admin" element={<ProtectedRoute roles={['ADMIN']}><AdminDashboard /></ProtectedRoute>} />
                                    <Route path="/lecturer" element={<ProtectedRoute roles={['LECTURER']}><LecturerDashboard /></ProtectedRoute>} />
                                    <Route path="/student" element={<ProtectedRoute roles={['STUDENT']}><StudentDashboard /></ProtectedRoute>} />
                                    
                                    {/* Profile page accessible to all authenticated users */}
                                    <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

                                    {/* Root path redirect */}
                                    <Route path="/" element={<HomeRedirect />} />

                                    {/* 404 Fallback */}
                                    <Route path="*" element={<Navigate to="/profile" replace />} />
                                </Routes>
                            </MainLayout>
                        }
                    />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}

// Helper component to redirect logged-in users from "/" to their dashboard
const HomeRedirect = () => {
    const { user } = useAuth();
    if (!user) {
        return <Navigate to="/auth" replace />;
    }
    switch (user.role) {
        case 'ADMIN':
            return <Navigate to="/admin" replace />;
        case 'LECTURER':
            return <Navigate to="/lecturer" replace />;
        case 'STUDENT':
            return <Navigate to="/student" replace />;
        default:
            return <Navigate to="/profile" replace />;
    }
};

export default App;
