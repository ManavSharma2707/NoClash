import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios'; // For API calls

// --- Import Page Components ---
// Assuming your page components are in src/pages/
// Make sure these paths are correct relative to your App.jsx file
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AdminDashboard from './pages/AdminDashboard'; // Import AdminDashboard
import ProfessorDashboard from './pages/ProfessorDashboard'; // <-- IMPORT NEW DASHBOARD
import StudentDashboard from './pages/StudentDashboard'; // <-- IMPORT NEW DASHBOARD

// --- API Base URL ---
// You might move this to a .env file later
const API_BASE_URL = 'https://noclash.onrender.com/api'; // Make sure this matches your backend port

// --- Reusable Input Component ---
// (Keep the InputField component definition as you have it)
const InputField = ({ label, type = "text", value, onChange, placeholder, required = true, name, id }) => (
  <div className="mb-4">
    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor={id || name || label}>
      {label}
    </label>
    <input
      className="shadow-sm appearance-none border border-gray-300 rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
      id={id || name || label}
      name={name || label.toLowerCase().replace(' ', '')}
      type={type}
      placeholder={placeholder || label}
      value={value}
      onChange={onChange}
      required={required}
    />
  </div>
);

// --- Reusable Select Component ---
// (Keep the SelectField component definition as you have it)
const SelectField = ({ label, value, onChange, options, required = true, disabled = false, name, id }) => (
    <div className="mb-4">
        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor={id || name || label}>
            {label}
        </label>
        <select
            className={`shadow-sm appearance-none border border-gray-300 rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            id={id || name || label}
            name={name || label.toLowerCase().replace(' ', '')}
            value={value}
            onChange={onChange}
            required={required}
            disabled={disabled}
        >
            <option value="" disabled>Select {label}</option>
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    </div>
);

// --- Simple SVG Placeholder Icon ---
// (Keep the LogoIcon component definition as you have it)
const LogoIcon = () => (
  <img
    src="C:\Users\manav\OneDrive\Desktop\dbms_cp\Frontend\Utils\logo.png"
    alt="Stylized blue circular logo with a white interlocking M in the center; flat minimal design on transparent background; conveys a modern, professional tone; no readable text"
    className="h-12 w-12 mb-4"
  />
);


// --- Login Page Component ---
// (This component should exist in './pages/LoginPage.jsx')
/*
function LoginPage() { ... }
*/

// --- Register Page Component ---
// (This component should exist in './pages/RegisterPage.jsx')
/*
function RegisterPage() { ... }
*/


// --- Main App Component ---
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected Routes (Add proper protection later) */}
        {/* --- THIS LINE IS NOW ACTIVE --- */}
        <Route path="/admin/dashboard" element={<AdminDashboard />} />

        {/* Placeholder routes for other dashboards */}
        <Route path="/professor/dashboard" element={<ProfessorDashboard />} /> 
        <Route path="/student/dashboard" element={<StudentDashboard />} /> 


        {/* Redirect base path to login */}
        <Route path="/" element={<Navigate to="/login" replace />} />

         {/* Optional: Catch-all 404 Not Found Route */}
        <Route path="*" element={
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
                <h1 className="text-4xl font-bold text-red-600 mb-4">404 - Not Found</h1>
                <p className="text-gray-600 mb-6">The page you are looking for does not exist.</p>
                <Link to="/login" className="text-indigo-600 hover:underline">
                    Go back to Login
                </Link>
            </div>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

