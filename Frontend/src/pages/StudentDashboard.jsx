import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'; // Added useRef
import logo from '../../Utils/logo.png';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';

// --- API Base URL & Helpers ---
const API_BASE_URL = 'https://noclash.onrender.com/api'; // Ensure this matches your backend

const getAuthToken = () => localStorage.getItem('authToken');

// Create an Axios instance for authenticated requests
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add Authorization header to every request if token exists
apiClient.interceptors.request.use((config) => {
    const token = getAuthToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

// --- Reusable UI Components ---

const LoadingSpinner = ({ size = 'h-8 w-8' }) => (
    <div className="flex justify-center items-center py-10">
        <svg className={`animate-spin ${size} text-indigo-600`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    </div>
);

const ErrorMessage = ({ message }) => (
    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative my-4" role="alert">
        <strong className="font-bold">Error: </strong>
        <span className="block sm:inline">{message || "An unexpected error occurred."}</span>
    </div>
);

const Button = ({ children, onClick, type = 'button', variant = 'primary', disabled = false, className = '', ...props }) => {
    const baseStyle = "font-bold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition duration-150 ease-in-out shadow-sm disabled:opacity-50 disabled:cursor-not-allowed";
    let variantStyle = '';
    switch (variant) {
        case 'primary':
            variantStyle = 'bg-indigo-600 hover:bg-indigo-700 text-white focus:ring-indigo-500';
            break;
        case 'danger':
            variantStyle = 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500';
            break;
        case 'secondary':
             variantStyle = 'bg-gray-200 hover:bg-gray-300 text-gray-700 focus:ring-gray-400';
             break;
        default:
             variantStyle = 'bg-indigo-600 hover:bg-indigo-700 text-white focus:ring-indigo-500';
    }
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={`${baseStyle} ${variantStyle} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
};

// --- Added InputField (needed for Modal) ---
const InputField = ({ label, name, id, type = 'text', value, onChange, placeholder, required = true, disabled = false, error = null }) => (
    <div className="mb-4">
        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor={id || name}>
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        <input
            className={`shadow-sm appearance-none border ${error ? 'border-red-500' : 'border-gray-300'} rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 ${error ? 'focus:ring-red-500' : 'focus:ring-indigo-500'} focus:border-transparent transition duration-150 ease-in-out ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            id={id || name}
            name={name}
            type={type}
            placeholder={placeholder || label}
            value={value}
            onChange={onChange}
            required={required}
            disabled={disabled}
        />
        {error && <p className="text-red-500 text-xs italic mt-1">{error}</p>}
    </div>
);


// --- Date Helper Functions ---
const addDays = (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

const getStartOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setHours(0, 0, 0, 0);
    return new Date(d.setDate(diff));
};

const formatDateShort = (date) => {
    return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
};

const formatTime = (date) => {
    if (!date || isNaN(date)) return 'Invalid Time';
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

// Compare LOCAL calendar day to avoid UTC offset issues (IST, etc.)
const isSameDay = (date1, date2) => {
    if (!date1 || !date2) return false;
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
};

// --- Custom Date Parsing (treat MySQL DATETIME as local) ---
const parseDateTimeString = (dateTimeStr) => {
    if (!dateTimeStr) return null;
    // Date only: interpret as local midnight
    if (dateTimeStr.length === 10 && dateTimeStr.includes('-')) {
        const dLocal = new Date(dateTimeStr + 'T00:00:00');
        return isNaN(dLocal) ? null : dLocal;
    }
    // Datetime: interpret as local clock time
    if (dateTimeStr.length === 19 && dateTimeStr.includes(' ') && dateTimeStr.includes(':')) {
        const dLocalDT = new Date(dateTimeStr.replace(' ', 'T'));
        return isNaN(dLocalDT) ? null : dLocalDT;
    }
    const d = new Date(dateTimeStr);
    return isNaN(d) ? null : d;
};

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];


// --- Student Schedule View Component ---
function ViewStudentSchedule({ currentWeekStart }) {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchSchedule = async () => {
            setLoading(true); setError('');
            try {
                const response = await apiClient.get('/student/my-schedule');
                const processedEvents = response.data.map(event => {
                    const startDate = parseDateTimeString(event.start_time);
                    const endDate = parseDateTimeString(event.end_time);
                    const classDateForExtra = event.class_type === 'Extra' ? parseDateTimeString(event.class_date) : null;
                    if (!startDate || !endDate || (event.class_type === 'Extra' && !classDateForExtra)) {
                        console.warn("Skipping invalid event data:", event); return null;
                    }
                    return {
                        id: event.schedule_id, title: `${event.course_code}: ${event.course_name}`,
                        details: `Professor: ${event.professor_name || 'N/A'}, Room: ${event.room_number}`,
                        start: startDate, end: endDate, type: event.class_type,
                        dayOfWeek: event.day_of_week, classDate: classDateForExtra
                    };
                }).filter(Boolean);
                setEvents(processedEvents);
            } catch (err) {
                setError(err.response?.data?.message || "Failed to load schedule.");
                toast.error("Failed to load schedule.");
            } finally {
                setLoading(false);
            }
        };
        fetchSchedule();
    }, [currentWeekStart]);

    const EventItem = ({ event }) => (
        <div className={`p-2 rounded-lg mb-2 ${event.type === 'Base' ? 'bg-indigo-50 border-indigo-300' : 'bg-yellow-50 border-yellow-400'} border shadow-sm`}>
            <p className="font-semibold text-sm text-gray-800">{formatTime(event.start)} - {formatTime(event.end)}</p>
            <p className="text-xs font-medium text-gray-700">{event.title}</p>
            <p className="text-xs text-gray-600">{event.details}</p>
            <span className={`mt-1 px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${event.type === 'Base' ? 'bg-indigo-100 text-indigo-800' : 'bg-yellow-100 text-yellow-800'}`}>
                {event.type}
            </span>
        </div>
    );

    if (loading) return <LoadingSpinner />;
    if (error) return <ErrorMessage message={error} />;

    return (
        <div className="bg-white shadow-lg overflow-hidden sm:rounded-lg p-4 sm:p-6">
            <div className="overflow-x-auto">
                <div className="grid grid-cols-7 min-w-[800px] border-t border-l border-gray-200">
                    {WEEK_DAYS.map((dayName, index) => {
                        const currentDayDateLocal = addDays(currentWeekStart, index);
                        const dayEvents = events.filter(event => {
                            if (event.type === 'Base') return event.dayOfWeek === dayName;
                            else return event.classDate && isSameDay(event.classDate, currentDayDateLocal);
                        }).sort((a, b) => a.start.getTime() - b.start.getTime());
                        const isToday = isSameDay(currentDayDateLocal, new Date());
                        return (
                            <div key={dayName} className="flex flex-col border-r border-b border-gray-200 min-h-[200px]">
                                <div className={`p-2 border-b border-gray-200 ${isToday ? 'bg-indigo-50' : 'bg-gray-50'}`}>
                                    <p className={`font-semibold text-center text-sm ${isToday ? 'text-indigo-600' : 'text-gray-700'}`}>{dayName}</p>
                                    <p className={`text-center text-xs ${isToday ? 'text-indigo-500' : 'text-gray-500'}`}>{formatDateShort(currentDayDateLocal)}</p>
                                </div>
                                <div className="p-2 flex-grow overflow-y-auto">
                                    {dayEvents.length > 0 ? dayEvents.map(event => <EventItem key={event.id} event={event} />) : <p className="text-xs text-gray-400 text-center pt-4">Free</p>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// --- Student Profile Component ---
const InfoItem = ({ label, value }) => (
    <div className="border-b border-gray-200 py-2 sm:py-3">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <p className="text-md font-semibold text-gray-900">{value || 'N/A'}</p>
    </div>
);

function StudentProfileCard({ details, isLoading }) {
    if (isLoading || !details) {
        return <div className="p-6 bg-white shadow-lg rounded-lg text-center mb-6"><LoadingSpinner size="h-6 w-6" /></div>;
    }
    return (
        <div className="bg-white shadow-lg overflow-hidden sm:rounded-lg p-6 mb-6">
            <h3 className="text-xl font-bold text-indigo-700 mb-4">My Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                <InfoItem label="Name" value={details.full_name} />
                <InfoItem label="Email" value={details.email} />
                <InfoItem label="Branch" value={details.branch_name ? `${details.branch_name} (${details.branch_code})` : 'N/A'} />
                <InfoItem label="Academic Group" value={`Division: ${details.division_name || 'N/A'} / Batch: ${details.batch_name || 'N/A'}`} />
            </div>
        </div>
    );
}

// --- NEW: Change Password Modal (Identical to Professor's) ---
function ChangePasswordModal({ isOpen, onClose, onSubmit }) {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (newPassword !== confirmPassword) { setError("New passwords do not match."); return; }
        if (newPassword.length < 6) { setError("New password must be at least 6 characters."); return; }

        setLoading(true);
        try {
            await onSubmit({ currentPassword, newPassword, confirmPassword });
            // Reset state after successful submission might be needed if modal isn't fully unmounted
            setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
        } catch (err) {
            setError(err.message || "Failed to change password.");
        } finally {
            setLoading(false);
        }
    };

    // Reset fields when modal opens/closes
     useEffect(() => {
        if (!isOpen) {
             setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setError(''); setLoading(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center p-4">
            <div className="relative bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
                <h2 className="text-xl font-bold mb-6 text-gray-800">Change Password</h2>
                {error && <ErrorMessage message={error} />}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <InputField label="Current Password" type="password" name="currentPassword" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
                    <InputField label="New Password" type="password" name="newPassword" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                    <InputField label="Confirm New Password" type="password" name="confirmPassword" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                    <div className="flex justify-end space-x-3 mt-6">
                        <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
                        <Button type="submit" variant="primary" disabled={loading}>{loading ? <LoadingSpinner size="h-5 w-5"/> : "Update Password"}</Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// --- NEW: Dropdown Menu Component (Identical to Professor's) ---
function DropdownMenu({ onLogout, onChangePassword }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [dropdownRef]);

    return (
        <div className="relative" ref={dropdownRef}>
            <button onClick={() => setIsOpen(!isOpen)} className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500" aria-label="User menu" aria-haspopup="true">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path></svg>
            </button>
            {isOpen && (
                <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-20" role="menu" aria-orientation="vertical" tabIndex="-1">
                    <button onClick={() => { onChangePassword(); setIsOpen(false); }} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left" role="menuitem" tabIndex="-1">Change Password</button>
                    <button onClick={() => { onLogout(); setIsOpen(false); }} className="block px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left" role="menuitem" tabIndex="-1">Logout</button>
                </div>
            )}
        </div>
    );
}


// --- Main App Component ---
function StudentDashboard() {
    const navigate = useNavigate();
    const [userData, setUserData] = useState(null);
    const [studentDetails, setStudentDetails] = useState(null);
    const [loadingDetails, setLoadingDetails] = useState(true);
    const [currentWeekStart, setCurrentWeekStart] = useState(getStartOfWeek(new Date()));
    const [isModalOpen, setIsModalOpen] = useState(false); // State for modal

    // --- Authentication & Authorization Check ---
    useEffect(() => {
        const token = getAuthToken();
        const storedUserData = localStorage.getItem('userData');
        if (!token || !storedUserData) {
            navigate('/login'); return;
        }
        try {
            const parsedData = JSON.parse(storedUserData);
            if (parsedData.role !== 'Student') {
                toast.error('Access Denied: Students only.');
                navigate('/login');
            } else {
                setUserData(parsedData);
            }
        } catch (error) {
            localStorage.clear(); navigate('/login');
        }
    }, [navigate]);

    // --- Fetch Student Profile Details ---
    useEffect(() => {
        if (userData) {
            const fetchStudentDetails = async () => {
                setLoadingDetails(true);
                try {
                    const response = await apiClient.get('/student/my-details');
                    setStudentDetails(response.data);
                } catch (err) {
                    toast.error("Could not load profile info.");
                } finally {
                    setLoadingDetails(false);
                }
            };
            fetchStudentDetails();
        }
    }, [userData]);

    const handleLogout = () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        navigate('/login');
    };

    // --- NEW: Handle Password Change Submission ---
    const handlePasswordChange = async (passwords) => {
        // Wrap the API call in a promise to handle errors in the modal
        return new Promise(async (resolve, reject) => {
            try {
                const response = await apiClient.put('/user/change-password', passwords);
                toast.success(response.data.message || 'Password changed successfully!');
                setIsModalOpen(false); // Close modal on success
                // Optionally force logout
                // handleLogout();
                resolve();
            } catch (err) {
                console.error("Password change error:", err);
                const message = err.response?.data?.message || 'Failed to change password.';
                reject(new Error(message));
            }
        });
    };

    // --- Week Navigation Handlers ---
    const goToPreviousWeek = () => { setCurrentWeekStart(addDays(currentWeekStart, -7)); };
    const goToNextWeek = () => { setCurrentWeekStart(addDays(currentWeekStart, 7)); };
    const goToToday = () => { setCurrentWeekStart(getStartOfWeek(new Date())); };

    // --- Calendar Header Component ---
    const CalendarHeader = () => {
        const endDate = addDays(currentWeekStart, 6);
        return (
            <div className="flex items-center justify-between mb-4 px-2">
                <h2 className="text-xl font-semibold text-gray-800">
                    {currentWeekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - {endDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </h2>
                <div className="flex space-x-2">
                    <Button variant="secondary" className="px-3 py-1.5 text-sm" onClick={goToPreviousWeek}>&larr; Prev</Button>
                    <Button variant="secondary" className="px-3 py-1.5 text-sm" onClick={goToToday}>Today</Button>
                    <Button variant="secondary" className="px-3 py-1.5 text-sm" onClick={goToNextWeek}>Next &rarr;</Button>
                </div>
            </div>
        );
    };


    if (!userData) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-100"><LoadingSpinner size="h-12 w-12"/></div>;
    }

    // --- Main Layout ---
    return (
        <div className="min-h-screen bg-gray-100">
            <Toaster position="top-right" />
            
            <header className="bg-white shadow-md sticky top-0 z-10">
                 <div className="max-w-7xl mx-auto py-3 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                        <div className="w-10 h-10 mr-2 rounded-md bg-white p-1 flex items-center justify-center border border-gray-200">
                            <img src={logo} alt="NoClash" className="w-full h-full object-contain" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-indigo-600">NoClash</span>
                            <span className="text-gray-500 font-medium text-sm">- Student</span>
                        </div>
                    </h1>
                    {/* --- UPDATED HEADER SECTION --- */}
                    <div className="flex items-center space-x-4">
                        <span className="text-sm text-gray-600 hidden sm:inline">Welcome, {userData.full_name}!</span>
                         {/* --- Dropdown Menu --- */}
                        <DropdownMenu
                            onLogout={handleLogout}
                            onChangePassword={() => setIsModalOpen(true)}
                        />
                    </div>
                 </div>
            </header>

            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                {/* --- Student Profile Card --- */}
                <StudentProfileCard details={studentDetails} isLoading={loadingDetails} />

                <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">My Weekly Timetable</h2>
                {/* --- Calendar Header --- */}
                <CalendarHeader /> 
                 {/* --- Schedule View --- */}
                <ViewStudentSchedule currentWeekStart={currentWeekStart} />
            </main>

             {/* --- Render Change Password Modal --- */}
            <ChangePasswordModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handlePasswordChange}
            />
        </div>
    );
}

export default StudentDashboard;

