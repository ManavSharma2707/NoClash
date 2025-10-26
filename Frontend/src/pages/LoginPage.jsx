import React, { useState } from 'react';
import logo from '../../Utils/logo.png';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom'; // Import useNavigate

// --- Reusable Input Component ---
const InputField = ({ label, name, type = 'text', value, onChange, placeholder, required = true }) => (
    <div className="mb-4">
        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor={name}>
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        <input
            className="shadow-sm appearance-none border border-gray-300 rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-150 ease-in-out"
            id={name}
            name={name}
            type={type}
            placeholder={placeholder || label}
            value={value}
            onChange={onChange}
            required={required}
        />
    </div>
);

// --- Login Page Component ---
function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate(); // Hook for navigation

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const trimmedEmail = email.trim(); // Trim email before sending
        // Password is not trimmed here, backend handles comparison

        try {
            console.log('Attempting login with:', { email: trimmedEmail, password });
            // --- API Call ---
            const response = await axios.post('http://localhost:4000/api/login', {
                email: trimmedEmail,
                password: password, // Send non-trimmed password
            });

            console.log('Login response:', response.data);

            // --- Store Token and User Data ---
            localStorage.setItem('authToken', response.data.token);
            localStorage.setItem('userData', JSON.stringify(response.data.user));

            setLoading(false);

            // --- REDIRECT based on role ---
            // Optional: Show a brief success message before redirecting if desired
            // alert(`Login successful! Role: ${response.data.user.role}. Redirecting...`);

            if (response.data.user.role === 'Administrator') {
                console.log("Redirecting to Admin Dashboard...");
                navigate('/admin/dashboard'); // Redirect Admin
            } else if (response.data.user.role === 'Professor') {
                 console.log("Redirecting to Professor Dashboard...");
                navigate('/professor/dashboard'); // Redirect Professor (Add this route in App.jsx later)
            } else if (response.data.user.role === 'Student') {
                 console.log("Redirecting to Student Dashboard...");
                 navigate('/student/dashboard'); // Redirect Student (Add this route in App.jsx later)
            } else {
                 console.error("Unknown user role received:", response.data.user.role);
                 setError("Login successful, but role is unrecognized. Cannot redirect.");
                 // Fallback redirect? Maybe just stay here with the error.
                 // navigate('/');
            }

        } catch (err) {
            console.error('Login error:', err.response ? err.response.data : err.message);
            setError(err.response?.data?.message || 'Login failed. Please check your credentials or server status.');
            setLoading(false);
            // Clear stored token if login fails? Optional.
            // localStorage.removeItem('authToken');
            // localStorage.removeItem('userData');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-white to-purple-100 p-4">
            <div className="bg-white p-8 sm:p-10 rounded-xl shadow-lg w-full max-w-md border border-gray-200">
                                {/* Brand Logo */}
                                <div className="flex items-center justify-center mb-4">
                                    <div className="w-20 h-20 mr-3 rounded-md bg-white p-2 shadow-md flex items-center justify-center border border-gray-200">
                                        <img src={logo} alt="NoClash Logo" className="w-full h-full object-contain" />
                                    </div>
                                    <div className="text-center">
                                        <h1 className="text-2xl font-bold text-gray-800">NoClash</h1>
                                        <p className="text-sm text-indigo-600 font-medium">Timetable Conflict Checker</p>
                                    </div>
                                </div>
                <h2 className="text-xl font-semibold text-gray-700 mb-6 text-center">Login</h2>

                {error && <p className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm border border-red-300">{error}</p>}

                <form onSubmit={handleLogin} noValidate>
                    <InputField
                        label="Email Address"
                        name="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your.email@vit.edu"
                        required
                    />
                    <InputField
                        label="Password"
                        name="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                    />
                    <div className="mb-6">
                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full font-bold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition duration-150 ease-in-out shadow-md ${loading
                                ? 'bg-indigo-300 text-gray-500 cursor-not-allowed'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white focus:ring-indigo-500'
                                }`}
                        >
                            {loading ? (
                                <span className="flex items-center justify-center">
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Logging in...
                                </span>
                            ) : 'Login'}
                        </button>
                    </div>
                </form>
                <p className="text-center text-sm text-gray-600">
                    Don't have an account?{' '}
                    <Link to="/register" className="font-medium text-indigo-600 hover:text-indigo-500 hover:underline">
                        Register here
                    </Link>
                </p>
            </div>
        </div>
    );
}

export default LoginPage;

