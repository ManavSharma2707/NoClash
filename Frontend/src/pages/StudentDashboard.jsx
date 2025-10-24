import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';

// --- API Base URL & Helpers ---
const API_BASE_URL = 'http://localhost:4000/api'; // Ensure this matches your backend

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

// --- Reusable UI Components (from AdminDashboard) ---

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


// --- Date Helper Functions (Copied from ProfessorDashboard) ---
const addDays = (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

const getStartOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
};

const formatDateShort = (date) => {
    return date.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
};

const formatTime = (date) => {
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};

const isSameDay = (date1, date2) => {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
};

// --- Custom Date Parsing for Backend Strings ---
const parseDateTimeString = (dateTimeStr) => {
    if (!dateTimeStr) return null;
    const parts = dateTimeStr.split(' ');
    if (parts.length !== 2) return new Date(dateTimeStr); 

    const dateParts = parts[0].split('-').map(Number);
    const timeParts = parts[1].split(':').map(Number);

    if (dateParts.length !== 3 || timeParts.length < 2) {
        return new Date(dateTimeStr);
    }
    
    // new Date(year, monthIndex, day, hour, minute, second)
    const seconds = timeParts.length === 3 ? timeParts[2] : 0;
    return new Date(dateParts[0], dateParts[1] - 1, dateParts[2], timeParts[0], timeParts[1], seconds);
};

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];


// --- Student Schedule View Component (Read-Only) ---
function ViewStudentSchedule() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentWeekStart, setCurrentWeekStart] = useState(getStartOfWeek(new Date()));

    // Fetch and process schedule data
    useEffect(() => {
        const fetchSchedule = async () => {
            setLoading(true);
            setError('');
            try {
                // Fetch student schedule using the new endpoint
                const response = await apiClient.get('/student/my-schedule');
                
                const processedEvents = response.data.map(event => {
                    const startDate = parseDateTimeString(event.start_time);
                    const endDate = parseDateTimeString(event.end_time);

                    return {
                        id: event.schedule_id,
                        title: `${event.course_code}: ${event.course_name}`,
                        details: `Professor: ${event.professor_name || 'N/A'}, Room: ${event.room_number}`,
                        start: startDate,
                        end: endDate,
                        type: event.class_type, // 'Base' or 'Extra'
                        dayOfWeek: event.day_of_week, 
                        classDate: event.class_type === 'Extra' ? startDate : null
                    };
                });
                setEvents(processedEvents);
            } catch (err) {
                console.error("Error fetching student schedule:", err);
                setError(err.response?.data?.message || "Failed to load your class schedule.");
                toast.error("Failed to load your schedule.");
            } finally {
                setLoading(false);
            }
        };
        fetchSchedule();
    }, []); // Only runs on component mount

    // --- Navigation Functions ---
    const goToPreviousWeek = () => { setCurrentWeekStart(addDays(currentWeekStart, -7)); };
    const goToNextWeek = () => { setCurrentWeekStart(addDays(currentWeekStart, 7)); };
    const goToToday = () => { setCurrentWeekStart(getStartOfWeek(new Date())); };


    // --- Calendar Header (READ-ONLY) ---
    const CalendarHeader = () => {
        const endDate = addDays(currentWeekStart, 6);
        return (
            <div className="flex items-center justify-between mb-4 px-2">
                <h2 className="text-xl font-semibold text-gray-800">
                    {currentWeekStart.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
                    {' - '}
                    {endDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                </h2>
                <div className="flex space-x-2">
                    <Button variant="secondary" className="px-3 py-1.5 text-sm" onClick={goToPreviousWeek}>&larr; Prev</Button>
                    <Button variant="secondary" className="px-3 py-1.5 text-sm" onClick={goToToday}>Today</Button>
                    <Button variant="secondary" className="px-3 py-1.5 text-sm" onClick={goToNextWeek}>Next &rarr;</Button>
                </div>
            </div>
        );
    };

    // --- Event Component ---
    const EventItem = ({ event }) => (
        <div className={`p-2 rounded-lg mb-2 ${event.type === 'Base' ? 'bg-blue-100 border-blue-300' : 'bg-green-100 border-green-300'} border`}>
            <p className="font-semibold text-sm text-gray-800">{formatTime(event.start)} - {formatTime(event.end)}</p>
            <p className="text-xs font-medium text-gray-700">{event.title}</p>
            <p className="text-xs text-gray-600">{event.details}</p>
            <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${event.type === 'Base' ? 'bg-blue-200 text-blue-800' : 'bg-green-200 text-green-800'}`}>
                {event.type}
            </span>
        </div>
    );

    // --- Render Logic ---
    if (loading) return <LoadingSpinner />;
    if (error) return <ErrorMessage message={error} />;
    
    // Calendar Grid Rendering Logic (Copied from Professor's View)
    return (
        <div className="bg-white shadow-lg overflow-hidden sm:rounded-lg p-4 sm:p-6">
            <CalendarHeader />
            
            <div className="grid grid-cols-1 sm:grid-cols-7 border-t border-l border-gray-200">
                {WEEK_DAYS.map((dayName, index) => {
                    const currentDayDate = addDays(currentWeekStart, index);
                    
                    const dayEvents = events.filter(event => {
                        if (event.type === 'Base') {
                            return event.dayOfWeek === dayName;
                        } else {
                            return event.classDate && isSameDay(event.classDate, currentDayDate);
                        }
                    }).sort((a, b) => a.start - b.start);

                    const isToday = isSameDay(currentDayDate, new Date());

                    return (
                        <div key={dayName} className="flex flex-col border-r border-b border-gray-200 min-h-[200px]">
                            <div className={`p-2 border-b border-gray-200 ${isToday ? 'bg-indigo-50' : 'bg-gray-50'}`}>
                                <p className={`font-semibold text-center text-sm ${isToday ? 'text-indigo-600' : 'text-gray-700'}`}>
                                    {dayName}
                                </p>
                                <p className={`text-center text-xs ${isToday ? 'text-indigo-500' : 'text-gray-500'}`}>
                                    {formatDateShort(currentDayDate)}
                                </p>
                            </div>
                            
                            <div className="p-2 flex-grow overflow-y-auto">
                                {dayEvents.length > 0 ? (
                                    dayEvents.map(event => <EventItem key={event.id} event={event} />)
                                ) : (
                                    <p className="text-xs text-gray-400 text-center pt-4">No classes</p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// --- Main App Component ---
function StudentDashboard() {
    const navigate = useNavigate();
    const [userData, setUserData] = useState(null);

    // --- Authentication & Authorization Check ---
    useEffect(() => {
        const token = getAuthToken();
        const storedUserData = localStorage.getItem('userData');
        if (!token || !storedUserData) {
            console.log("No token or user data, redirecting to login.");
            navigate('/login'); return;
        }
        try {
            const parsedData = JSON.parse(storedUserData);
            if (parsedData.role !== 'Student') {
                console.warn("Access Denied: Not a Student.");
                toast.error('Access Denied: This area is for Students only.');
                navigate('/login');
            } else {
                setUserData(parsedData);
            }
        } catch (error) {
            console.error("Error parsing user data:", error);
            localStorage.clear(); navigate('/login');
        }
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        navigate('/login');
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
                        <svg className="w-8 h-8 mr-2 text-indigo-600" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        <span className="text-indigo-600">NoClash</span> <span className="text-gray-500 font-medium ml-2">- Student</span>
                    </h1>
                    <div className="flex items-center space-x-4">
                        <span className="text-sm text-gray-600 hidden sm:inline">Welcome, {userData.full_name}!</span>
                        <Button onClick={handleLogout} variant="danger" className="text-xs px-3 py-1.5">
                            Logout
                        </Button>
                    </div>
                 </div>
            </header>

            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-2">My Weekly Timetable</h2>
                <ViewStudentSchedule />
            </main>
        </div>
    );
}

export default StudentDashboard;
