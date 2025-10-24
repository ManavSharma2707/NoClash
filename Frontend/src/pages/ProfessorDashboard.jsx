import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
// import DatePicker from 'react-datepicker'; // Removed: Incompatible with this environment
import { Toaster, toast } from 'react-hot-toast';
// import 'react-datepicker/dist/react-datepicker.css'; // Removed: Incompatible with this environment

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

const SelectField = ({ label, name, id, value, onChange, children, required = true, disabled = false, error = null }) => (
     <div className="mb-4">
        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor={id || name}>
            {label} {required && <span className="text-red-500">*</span>}
        </label>
         <select
            id={id || name} name={name}
            value={value} onChange={onChange} required={required} disabled={disabled}
            className={`shadow-sm appearance-none border ${error ? 'border-red-500' : 'border-gray-300'} rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 ${error ? 'focus:ring-red-500' : 'focus:ring-indigo-500'} focus:border-transparent transition duration-150 ease-in-out ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
        >
             {children}
         </select>
         {error && <p className="text-red-500 text-xs italic mt-1">{error}</p>}
    </div>
);

// --- NEW: Reusable InputField (for Date/Time) ---
const InputField = ({ label, name, id, type = 'text', value, onChange, required = true, disabled = false, min = null }) => (
    <div className="mb-4">
        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor={id || name}>
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        <input
            className={`shadow-sm appearance-none border border-gray-300 rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-150 ease-in-out ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            id={id || name}
            name={name}
            type={type}
            value={value}
            onChange={onChange}
            required={required}
            disabled={disabled}
            min={min}
        />
    </div>
);


const Button = ({ children, onClick, type = 'button', variant = 'primary', disabled = false, className = '', ...props }) => {
    const baseStyle = "font-bold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition duration-150 ease-in-out shadow-sm disabled:opacity-50 disabled:cursor-not-allowed";
    let variantStyle = '';
    switch (variant) {
        case 'primary':
            variantStyle = 'bg-indigo-600 hover:bg-indigo-700 text-white focus:ring-indigo-500';
            break;
        // ... other variants if needed
        case 'danger':
            variantStyle = 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500';
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

// --- Professor Dashboard Component ---
function ProfessorDashboard() {
    const navigate = useNavigate();
    const [userData, setUserData] = useState(null);
    const [activeTab, setActiveTab] = useState('book'); // 'book', 'my-schedule'

    // --- ** NEW: State to trigger schedule refresh ** ---
    const [refreshScheduleKey, setRefreshScheduleKey] = useState(0);

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
            if (parsedData.role !== 'Professor') {
                console.warn("Access Denied: Not a Professor.");
                // alert('Access Denied: This area is for Professors only.'); // Replaced with toast
                toast.error('Access Denied: This area is for Professors only.');
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

    // --- ** NEW: Function to trigger refresh ** ---
    const handleBookingSuccess = () => {
        // Incrementing the key will cause ViewMySchedule's useEffect to re-run
        setRefreshScheduleKey(prevKey => prevKey + 1);
        // Optionally, also switch to the schedule tab
        setActiveTab('my-schedule'); 
    };

    const renderTabContent = () => {
        switch (activeTab) {
            // --- ** MODIFIED: Pass handler to form ** ---
            case 'book': return <BookExtraClassForm onBookingSuccess={handleBookingSuccess} />;
            
            // --- ** MODIFIED: Pass key to schedule ** ---
            case 'my-schedule': return <ViewMySchedule refreshKey={refreshScheduleKey} />;
            
            default: return <BookExtraClassForm onBookingSuccess={handleBookingSuccess} />;
        }
    };

    const TabButton = ({ tabId, children }) => (
         <button
            onClick={() => setActiveTab(tabId)}
            className={`${activeTab === tabId
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-150 mr-4 sm:mr-8`}
            aria-current={activeTab === tabId ? 'page' : undefined}
        >
            {children}
        </button>
    );

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Toast container for notifications */}
            <Toaster position="top-right" toastOptions={{
                duration: 5000,
                style: {
                    background: '#333',
                    color: '#fff',
                },
                success: {
                    duration: 3000,
                    iconTheme: { primary: 'green', secondary: 'white' },
                },
                error: {
                    iconTheme: { primary: 'red', secondary: 'white' },
                },
            }}/>

            {/* Header */}
            <header className="bg-white shadow-md sticky top-0 z-10">
                 <div className="max-w-7xl mx-auto py-3 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                        <svg className="w-8 h-8 mr-2 text-indigo-600" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        <span className="text-indigo-600">NoClash</span> <span className="text-gray-500 font-medium ml-2">- Professor</span>
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
                {/* Tab Navigation */}
                <div className="mb-6 border-b border-gray-200 bg-white rounded-lg shadow px-4 sm:px-0 overflow-x-auto">
                    <nav className="-mb-px flex px-4 sm:px-6" aria-label="Tabs">
                        <TabButton tabId="book">Book Extra Class</TabButton>
                        <TabButton tabId="my-schedule">My Schedule</TabButton> {/* <-- ADD THIS */}
                    </nav>
                </div>

                {/* Tab Content */}
                <div className="mt-4">
                    {renderTabContent()}
                </div>
            </main>
        </div>
    );
}

// --- Book Extra Class Form Component ---

// --- ** MODIFIED: Accept onBookingSuccess prop ** ---
function BookExtraClassForm({ onBookingSuccess }) {
    // Dropdown data state
    const [courses, setCourses] = useState([]);
    const [classrooms, setClassrooms] = useState([]);
    const [academicStructure, setAcademicStructure] = useState([]); // Nested: Branch > Division > Batch
    
    // Form selection state
    const [selectedBranch, setSelectedBranch] = useState('');
    const [selectedDivision, setSelectedDivision] = useState('');
    
    // Form data state
    const [courseId, setCourseId] = useState('');
    const [batchId, setBatchId] = useState('');
    const [classroomId, setClassroomId] = useState('');
    const [classDate, setClassDate] = useState(''); // Changed from null to '' for <input type="date">
    const [startTime, setStartTime] = useState(''); // Changed from null to '' for <input type="time">
    const [endTime, setEndTime] = useState('');   // Changed from null to '' for <input type="time">

    // UI State
    const [loadingData, setLoadingData] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Fetch data for all dropdowns on component mount
    useEffect(() => {
        const fetchData = async () => {
            setLoadingData(true);
            setError('');
            try {
                const [coursesRes, classroomsRes, structureRes] = await Promise.all([
                    apiClient.get('/professor/courses'),
                    apiClient.get('/professor/classrooms'),
                    apiClient.get('/professor/batches') // This fetches the nested structure
                ]);
                setCourses(coursesRes.data || []);
                setClassrooms(classroomsRes.data || []);
                setAcademicStructure(structureRes.data || []);
            } catch (err) {
                console.error("Error fetching form data:", err);
                setError(err.response?.data?.message || "Failed to load necessary data. Please try again.");
                toast.error("Failed to load form data. Please refresh.");
            } finally {
                setLoadingData(false);
            }
        };
        fetchData();
    }, []);

    // Memoized derived lists for cascading dropdowns
    const divisions = useMemo(() => {
        if (!selectedBranch) return [];
        const branch = academicStructure.find(b => b.branch_id === parseInt(selectedBranch));
        return branch ? branch.divisions : [];
    }, [selectedBranch, academicStructure]);

    const batches = useMemo(() => {
        if (!selectedDivision) return [];
        const division = divisions.find(d => d.division_id === parseInt(selectedDivision));
        return division ? division.batches : [];
    }, [selectedDivision, divisions]);

    // Handle dropdown changes
    const handleBranchChange = (e) => {
        setSelectedBranch(e.target.value);
        setSelectedDivision('');
        setBatchId(''); // Reset subsequent selections
    };

    const handleDivisionChange = (e) => {
        setSelectedDivision(e.target.value);
        setBatchId(''); // Reset batch selection
    };

    // --- Helper to get today's date in YYYY-MM-DD format for min attribute ---
    const getTodayString = () => {
        return new Date().toISOString().split('T')[0];
    };

    // Handle Form Submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // --- Validation ---
        if (!courseId || !batchId || !classroomId || !classDate || !startTime || !endTime) {
            toast.error("Please fill out all fields.");
            return;
        }
        if (endTime <= startTime) {
            toast.error("End time must be after start time.");
            return;
        }

        const payload = {
            course_id: parseInt(courseId),
            batch_id: parseInt(batchId),
            classroom_id: parseInt(classroomId),
            class_date: classDate, // Already in YYYY-MM-DD format
            start_time: `${startTime}:00`, // Append seconds for HH:mm:ss format
            end_time: `${endTime}:00`,   // Append seconds for HH:mm:ss format
        };

        console.log("Booking payload:", payload);
        setSubmitting(true);
        const toastId = toast.loading('Checking for conflicts...');

        try {
            const response = await apiClient.post('/book-extra-class', payload);
            
            // Success
            toast.success(response.data.message || 'Extra class booked successfully!', { id: toastId });

            // --- ** NEW: Call the refresh handler ** ---
            if (onBookingSuccess) {
                onBookingSuccess();
            }
            
            // Reset form
            setCourseId('');
            setBatchId('');
            setClassroomId('');
            setClassDate('');
            setStartTime('');
            setEndTime('');
            setSelectedBranch('');
            setSelectedDivision('');

        } catch (err) {
            // Conflict (409) or other error
            console.error("Booking error:", err.response);
            const errorMessage = err.response?.data?.message || "An unexpected error occurred.";
            toast.error(errorMessage, { id: toastId, duration: 6000 }); // Show conflict message for longer
        } finally {
            setSubmitting(false);
        }
    };

    if (loadingData) return <LoadingSpinner />;
    if (error) return <ErrorMessage message={error} />;

    return (
        <div className="bg-white shadow-lg overflow-hidden sm:rounded-lg max-w-2xl mx-auto">
            <form onSubmit={handleSubmit}>
                <div className="p-4 sm:p-6">
                    <h2 className="text-xl font-semibold mb-5 text-gray-800 border-b pb-2">Book an Extra Class</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                        {/* --- Course --- */}
                        <SelectField label="Course" name="course" value={courseId} onChange={e => setCourseId(e.target.value)} disabled={submitting}>
                            <option value="" disabled>-- Select a Course --</option>
                            {courses.map(course => (
                                <option key={course.course_id} value={course.course_id}>
                                    {course.course_code} - {course.course_name}
                                </option>
                            ))}
                        </SelectField>

                        {/* --- Classroom --- */}
                        <SelectField label="Classroom" name="classroom" value={classroomId} onChange={e => setClassroomId(e.target.value)} disabled={submitting}>
                            <option value="" disabled>-- Select a Classroom --</option>
                            {classrooms.map(cr => (
                                <option key={cr.classroom_id} value={cr.classroom_id}>
                                    {cr.room_number} ({cr.building}) - {cr.type}
                                </option>
                            ))}
                        </SelectField>

                        {/* --- Branch --- */}
                        <SelectField label="Target Branch" name="branch" value={selectedBranch} onChange={handleBranchChange} disabled={submitting}>
                            <option value="" disabled>-- Select Branch --</option>
                            {academicStructure.map(branch => (
                                <option key={branch.branch_id} value={branch.branch_id}>
                                    {branch.branch_name}
                                </option>
                            ))}
                        </SelectField>

                        {/* --- Division --- */}
                        <SelectField label="Target Division" name="division" value={selectedDivision} onChange={handleDivisionChange} disabled={!selectedBranch || submitting}>
                            <option value="" disabled>-- Select Division --</option>
                            {divisions.map(div => (
                                <option key={div.division_id} value={div.division_id}>
                                    Division {div.division_name}
                                </option>
                            ))}
                        </SelectField>

                        {/* --- Batch --- */}
                        <SelectField label="Target Batch" name="batch" value={batchId} onChange={e => setBatchId(e.target.value)} disabled={!selectedDivision || submitting}>
                            <option value="" disabled>-- Select Batch --</option>
                            {batches.map(batch => (
                                <option key={batch.batch_id} value={batch.batch_id}>
                                    Batch {batch.batch_name}
                                </option>
                            ))}
                        </SelectField>

                        <div /> {/* Spacer */}

                        {/* --- Date Picker --- */}
                        <InputField
                            label="Class Date"
                            name="classDate"
                            type="date"
                            value={classDate}
                            onChange={(e) => setClassDate(e.target.value)}
                            min={getTodayString()} // Professor can only book for today or future
                            disabled={submitting}
                        />

                        <div /> {/* Spacer */}

                        {/* --- Start Time Picker --- */}
                         <InputField
                            label="Start Time"
                            name="startTime"
                            type="time"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            disabled={submitting}
                        />

                        {/* --- End Time Picker --- */}
                        <InputField
                            label="End Time"
                            name="endTime"
                            type="time"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            disabled={submitting}
                        />
                    </div>
                </div>
                {/* --- Submit Button --- */}
                <div className="bg-gray-50 px-4 py-4 sm:px-6 text-right">
                    <Button type="submit" variant="primary" disabled={submitting || loadingData}>
                        {submitting ? 'Booking...' : 'Book Class'}
                    </Button>
                </div>
            </form>
        </div>
    );
}


// --- ** NEW: View My Schedule Component ** ---

// --- Date Helper Functions ---
const addDays = (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

// Gets the date for the Monday of the week `date` is in
const getStartOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay(); // Sunday - 0, Monday - 1, ...
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    return new Date(d.setDate(diff));
};

const formatDateShort = (date) => {
    // e.g., "10/25"
    return date.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
};

const formatTime = (date) => {
    // e.g., "9:00 AM"
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};

// Checks if two dates are on the same day (ignoring time)
const isSameDay = (date1, date2) => {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
};

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];


// --- ** MODIFIED: Accept refreshKey prop ** ---
function ViewMySchedule({ refreshKey }) {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    // State to manage which week is being viewed, storing the Monday of that week
    const [currentWeekStart, setCurrentWeekStart] = useState(getStartOfWeek(new Date()));

    // Fetch and process schedule data
    useEffect(() => {
        const fetchSchedule = async () => {
            setLoading(true);
            setError('');
            try {
                const response = await apiClient.get('/professor/my-schedule');
                
                // --- ** NEW: Bulletproof Date Parsing Function ** ---
                // Parses 'YYYY-MM-DD HH:mm:ss' string as local time reliably
                const parseDateTimeString = (dateTimeStr) => {
                    if (!dateTimeStr) return null;
                    const parts = dateTimeStr.split(' ');
                    if (parts.length !== 2) return new Date(dateTimeStr); // Fallback

                    const dateParts = parts[0].split('-').map(Number);
                    const timeParts = parts[1].split(':').map(Number);

                    if (dateParts.length !== 3 || timeParts.length !== 3) {
                         // Fallback for different formats, e.g., if it includes 'T'
                        return new Date(dateTimeStr);
                    }
                    
                    // new Date(year, monthIndex, day, hour, minute, second)
                    return new Date(dateParts[0], dateParts[1] - 1, dateParts[2], timeParts[0], timeParts[1], timeParts[2]);
                };
                
                // Process backend data into a more usable format for the calendar
                const processedEvents = response.data.map(event => {
                    // --- ** MODIFIED: Use new parsing function ** ---
                    const startDate = parseDateTimeString(event.start_time);
                    const endDate = parseDateTimeString(event.end_time);

                    return {
                        id: event.schedule_id,
                        title: `${event.course_code}: ${event.course_name}`,
                        details: `Batch: ${event.batch_details}, Room: ${event.room_number}`,
                        start: startDate,
                        end: endDate,
                        type: event.class_type, // 'Base' or 'Extra'
                        // For Base classes, day_of_week is key.
                        dayOfWeek: event.day_of_week, 
                        // For Extra classes, the specific date is key.
                        // We parse it from the start_time string
                        // --- ** MODIFIED: Use startDate object ** ---
                        classDate: event.class_type === 'Extra' ? startDate : null
                    };
                });
                setEvents(processedEvents);
            } catch (err) {
                console.error("Error fetching schedule:", err);
                setError(err.response?.data?.message || "Failed to load schedule.");
                toast.error("Failed to load schedule.");
            } finally {
                setLoading(false);
            }
        };
        fetchSchedule();
    // --- ** MODIFIED: Add refreshKey to dependency array ** ---
    }, [refreshKey]); // This component will now refetch when refreshKey changes

    // --- Navigation Functions ---
    const goToPreviousWeek = () => {
        setCurrentWeekStart(addDays(currentWeekStart, -7));
    };

    const goToNextWeek = () => {
        setCurrentWeekStart(addDays(currentWeekStart, 7));
    };

    const goToToday = () => {
        setCurrentWeekStart(getStartOfWeek(new Date()));
    };

    // --- Calendar Header ---
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

    return (
        <div className="bg-white shadow-lg overflow-hidden sm:rounded-lg p-4 sm:p-6">
            <CalendarHeader />
            
            {/* Grid for the calendar days */}
            <div className="grid grid-cols-1 sm:grid-cols-7 border-t border-l border-gray-200">
                {WEEK_DAYS.map((dayName, index) => {
                    // Get the specific date for this day in the current week
                    const currentDayDate = addDays(currentWeekStart, index);
                    
                    // Filter events that belong to this day
                    const dayEvents = events.filter(event => {
                        if (event.type === 'Base') {
                            // Match 'Base' classes by the day of the week
                            return event.dayOfWeek === dayName;
                        } else {
                            // Match 'Extra' classes by the exact date
                            return event.classDate && isSameDay(event.classDate, currentDayDate);
                        }
                    }).sort((a, b) => a.start - b.start); // Sort events by start time

                    const isToday = isSameDay(currentDayDate, new Date());

                    return (
                        <div key={dayName} className="flex flex-col border-r border-b border-gray-200 min-h-[200px]">
                            {/* Day Header */}
                            <div className={`p-2 border-b border-gray-200 ${isToday ? 'bg-indigo-50' : 'bg-gray-50'}`}>
                                <p className={`font-semibold text-center text-sm ${isToday ? 'text-indigo-600' : 'text-gray-700'}`}>
                                    {dayName}
                                </p>
                                <p className={`text-center text-xs ${isToday ? 'text-indigo-500' : 'text-gray-500'}`}>
                                    {formatDateShort(currentDayDate)}
                                </p>
                            </div>
                            
                            {/* Events List for the day */}
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


export default ProfessorDashboard;



