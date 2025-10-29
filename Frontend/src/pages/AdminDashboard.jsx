import React, { useState, useEffect, useCallback, useMemo } from 'react';
import logo from '../../Utils/logo.png';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

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

// Enhanced Modal Component
const Modal = ({ isOpen, onClose, title, children }) => {
    useEffect(() => {
        const handleEsc = (event) => {
            if (event.keyCode === 27) onClose(); // Close on Escape key
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full z-50 flex justify-center items-start pt-16 md:items-center p-4 transition-opacity duration-300 ease-in-out"
            onClick={onClose} // Close when clicking backdrop
        >
            <div
                className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative transform transition-all duration-300 ease-in-out scale-95 opacity-0 animate-modal-scale-in"
                onClick={e => e.stopPropagation()} // Prevent closing when clicking inside modal
                style={{ animationFillMode: 'forwards' }} // Keep final state of animation
            >
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-2xl leading-none font-semibold focus:outline-none"
                    aria-label="Close modal"
                >
                    &times;
                </button>
                <h3 className="text-xl font-semibold text-gray-800 mb-4">{title}</h3>
                <div>{children}</div>
            </div>
            {/* Simple CSS animation */}
            <style>{`
                @keyframes modal-scale-in {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                .animate-modal-scale-in {
                    animation: modal-scale-in 0.2s ease-out;
                }
            `}</style>
        </div>
    );
};

// Reusable Input Field
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

// Reusable Select Field
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

// Reusable Button
const Button = ({ children, onClick, type = 'button', variant = 'primary', disabled = false, className = '', ...props }) => {
    const baseStyle = "font-bold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition duration-150 ease-in-out shadow-sm disabled:opacity-50 disabled:cursor-not-allowed";
    let variantStyle = '';
    switch (variant) {
        case 'primary':
            variantStyle = 'bg-indigo-600 hover:bg-indigo-700 text-white focus:ring-indigo-500';
            break;
        case 'secondary':
             variantStyle = 'bg-gray-200 hover:bg-gray-300 text-gray-700 focus:ring-gray-400';
             break;
        case 'danger':
            variantStyle = 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500';
            break;
        case 'success':
            variantStyle = 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-500';
            break;
        case 'link':
             variantStyle = 'text-indigo-600 hover:text-indigo-900 px-1 py-1 rounded bg-transparent shadow-none hover:bg-indigo-50 focus:ring-indigo-500';
             break;
        case 'danger-link':
             variantStyle = 'text-red-600 hover:text-red-900 px-1 py-1 rounded bg-transparent shadow-none hover:bg-red-50 focus:ring-red-500';
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

// --- Admin Dashboard Component ---
function AdminDashboard() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('pending'); // 'pending', 'all', 'classrooms', 'courses', 'structure'
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
            if (parsedData.role !== 'Administrator') {
                console.warn("Access Denied: Not an admin.");
                alert('Access Denied: This area is for Administrators only.');
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

    const renderTabContent = () => {
        switch (activeTab) {
            case 'pending': return <PendingApprovals />;
            case 'all': return <ManageAllUsers />;
            case 'classrooms': return <ManageClassrooms />;
            case 'courses': return <ManageCourses />;
            case 'structure': return <ManageAcademicStructure />;
            default: return <PendingApprovals />;
        }
    };

    const TabButton = ({ tabId, children }) => (
         <button
            onClick={() => setActiveTab(tabId)}
            className={`${activeTab === tabId
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-150 mr-4 sm:mr-8`} // Added margin-right
            aria-current={activeTab === tabId ? 'page' : undefined}
        >
            {children}
        </button>
    );

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-white shadow-md sticky top-0 z-10">
                 <div className="max-w-7xl mx-auto py-3 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                        <div className="w-10 h-10 mr-2 rounded-md bg-white p-1 flex items-center justify-center border border-gray-200">
                            <img src={logo} alt="NoClash" className="w-full h-full object-contain" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-indigo-600">NoClash</span>
                            <span className="text-gray-500 font-medium text-sm">- Admin</span>
                        </div>
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
                        <TabButton tabId="pending">Pending Approvals</TabButton>
                        <TabButton tabId="all">Manage Users</TabButton>
                        <TabButton tabId="classrooms">Classrooms</TabButton>
                        <TabButton tabId="courses">Courses</TabButton>
                        <TabButton tabId="structure">Academic Structure</TabButton>
                    </nav>
                </div>

                {/* Tab Content */}
                <div className="mt-4">
                    {renderTabContent()}
                </div>
            </main>

                {/* Footer */}
                <footer className="bg-white mt-10 shadow-inner">
                      <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex items-center justify-center space-x-3 text-gray-500 text-sm">
                          <img src={logo} alt="NoClash" className="w-6 h-6 rounded-full" />
                          <div>&copy; {new Date().getFullYear()} <span className="font-medium text-indigo-600">NoClash</span>. All rights reserved.</div>
                      </div>
                </footer>
        </div>
    );
}

// --- User Management Components (Keep previous versions or update if needed) ---
// function PendingApprovals() { ... existing component ... }
// function ManageAllUsers() { ... existing component ... }
// function EditUserForm({ user, onSave, onCancel }) { ... existing component ... }

// --- (Re-insert PendingApprovals, ManageAllUsers, EditUserForm from previous response here) ---
// --- Pending Approvals Tab Component ---
function PendingApprovals() {
    const [pendingUsers, setPendingUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchPendingUsers = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const response = await apiClient.get('/pending-users');
            setPendingUsers(Array.isArray(response.data) ? response.data : []);
        } catch (err) {
            console.error("Error fetching pending users:", err);
            setError(err.response?.data?.message || err.message || "Failed to load pending users.");
             if (err.response?.status === 401 || err.response?.status === 403) {
                 setError("Authentication error. Please log in again.");
             }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPendingUsers();
    }, [fetchPendingUsers]);

    const handleApprove = async (userId) => {
        // Use a standard confirm dialog for simplicity
        // A custom modal would be better for UX but adds complexity
        if (!window.confirm(`Approve user ID ${userId}?`)) return; 
        try {
            await apiClient.put(`/approve-user/${userId}`);
            alert('User approved successfully!');
            fetchPendingUsers(); // Refresh list
        } catch (err) {
            console.error(`Error approving user ${userId}:`, err);
            alert(`Failed to approve user: ${err.response?.data?.message || err.message || 'Server error'}`);
        }
    };

    const handleReject = async (userId) => {
         // Needs backend endpoint: DELETE /api/admin/users/:userId
         if (!window.confirm(`REJECT and DELETE user ID ${userId}? This action cannot be undone.`)) return;
        try {
             // Using the actual delete endpoint now
             await apiClient.delete(`/admin/users/${userId}`); 
             alert(`User ${userId} rejected and deleted.`);
             setPendingUsers(prev => prev.filter(user => user.user_id !== userId));
             fetchPendingUsers(); // Refresh list
        } catch (err) {
            console.error(`Error rejecting user ${userId}:`, err);
            alert(`Failed to reject user: ${err.response?.data?.message || err.message || 'Server error'}`);
        }
    };


    if (loading) return <LoadingSpinner />;
    if (error && pendingUsers.length === 0) return <ErrorMessage message={error} />;
    if (error) { console.warn("Displaying table with potentially stale data due to fetch error:", error); }


    return (
        <div className="bg-white shadow-lg overflow-hidden sm:rounded-lg p-4 sm:p-6">
            <h2 className="text-xl font-semibold mb-5 text-gray-800 border-b pb-2">Pending User Approvals</h2>
             {error && <ErrorMessage message={`Could not refresh list: ${error}`} />}
            {pendingUsers.length === 0 && !loading ? (
                <p className="text-gray-500 italic text-center py-4">No users are currently pending approval.</p>
            ) : (
                <div className="overflow-x-auto relative">
                    <table className="min-w-full divide-y divide-gray-200 border">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Details (Student)</th>
                                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {pendingUsers.map((user) => (
                                <tr key={user.user_id} className="hover:bg-gray-50 transition-colors duration-150">
                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.full_name}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{user.email}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                            user.role === 'Student' ? 'bg-blue-100 text-blue-800' :
                                            user.role === 'Professor' ? 'bg-purple-100 text-purple-800' :
                                            'bg-gray-100 text-gray-800'
                                        }`}>
                                          {user.role}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 hidden md:table-cell">
                                        {user.role === 'Student' ? `Br: ${user.branch_code || 'N/A'}, Div: ${user.division_name || 'N/A'}, Ba: ${user.batch_name || 'N/A'}` : 'N/A'}
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                        <Button variant="success" onClick={() => handleApprove(user.user_id)} className="text-xs px-2 py-1">Approve</Button>
                                        <Button variant="danger" onClick={() => handleReject(user.user_id)} className="text-xs px-2 py-1">Reject</Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// --- Manage All Users Tab Component (Placeholder) ---
function ManageAllUsers() {
    const [allUsers, setAllUsers] = useState([]);
    const [loading, setLoading] = useState(true); // Set to true to load on mount
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [usersPerPage] = useState(10); // Example pagination limit
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);

    // --- MODIFICATION: Fetch All Users from API ---
    const fetchAllUsers = useCallback(async () => {
        setLoading(true); setError('');
        try {
            // --- REAL API CALL ---
            console.log("ManageAllUsers: Fetching users from /api/admin/users...");
            const response = await apiClient.get('/admin/users'); // <-- REMOVED /api FROM HERE
            // --- END REAL API CALL ---

            // Filter logic (can be moved to backend later for performance)
            const filteredUsers = (Array.isArray(response.data) ? response.data : []).filter(user =>
                user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.role.toLowerCase().includes(searchTerm.toLowerCase())
            );
            
            setAllUsers(filteredUsers);
            
        } catch (err) {
           console.error("Error fetching all users:", err);
           setError(err.response?.data?.message || err.message || "Failed to load users.");
        } finally { setLoading(false); }
    }, [searchTerm]); // Re-fetch when searchTerm changes

    useEffect(() => {
        fetchAllUsers();
    }, [fetchAllUsers, currentPage]); // Removed usersPerPage, add back if paginating
    // --- END MODIFICATION ---


    const handleEdit = (user) => { setSelectedUser(user); setIsModalOpen(true); };

    const handleDelete = async (userId) => {
        // Uses backend endpoint: DELETE /api/admin/users/:userId
        if (!window.confirm(`DELETE user ID ${userId}? This cannot be undone.`)) return;
        try {
             await apiClient.delete(`/api/admin/users/${userId}`); // Actual API Call
             alert(`User ${userId} deleted successfully.`);
             fetchAllUsers(); // Refresh the list
        } catch (err) {
             console.error(`Error deleting user ${userId}:`, err);
             alert(`Failed to delete user: ${err.response?.data?.message || err.message || 'Server error'}`);
        }
    };

     const handleUpdateUser = async (updatedUserData) => {
         // Uses backend endpoint: PUT /api/admin/users/:userId
         console.log("Updating user:", selectedUser.user_id, updatedUserData);
         try {
             setLoading(true); // Maybe use a separate loading state for modal
             await apiClient.put(`/api/admin/users/${selectedUser.user_id}`, updatedUserData); // Actual API Call
             alert(`User ${selectedUser.user_id} updated successfully.`);
             setIsModalOpen(false); setSelectedUser(null);
             fetchAllUsers(); // Refresh the list
         } catch (err) {
              console.error(`Error updating user ${selectedUser.user_id}:`, err);
              // Show error in modal instead of alert?
              alert(`Failed to update user: ${err.response?.data?.message || err.message || 'Server error'}`);
         } finally { setLoading(false); }
     };

    return (
         <div className="bg-white shadow-lg overflow-hidden sm:rounded-lg p-4 sm:p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">Manage All Users</h2>
            <div className="mb-4">
                 <InputField
                     type="text" label="Search Users" required={false}
                     placeholder="Search by name, email, role..."
                     value={searchTerm}
                     onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                 />
            </div>

             {loading && <LoadingSpinner />}
             {error && !loading && <ErrorMessage message={error} />}
             {!loading && !error && allUsers.length === 0 && (
                <p className="text-gray-500 italic text-center py-4">No users found.</p>
             )}

            {!loading && !error && allUsers.length > 0 && (
                 <>
                    <div className="overflow-x-auto relative border rounded-md">
                         <table className="min-w-full divide-y divide-gray-200">
                            {/* ... table thead ... */}
                            <thead className="bg-gray-50">
                                 <tr>
                                     <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                     <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                     <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                                     <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                     <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Details (Student)</th>
                                     <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                 </tr>
                             </thead>
                             <tbody className="bg-white divide-y divide-gray-200">
                                 {allUsers.map((user) => (
                                     <tr key={user.user_id} className="hover:bg-gray-50 transition-colors duration-150">
                                         <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.full_name}</td>
                                         <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{user.email}</td>
                                         <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{user.role}</td>
                                         <td className="px-4 py-4 whitespace-nowrap text-sm">
                                             <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                user.approval_status === 'Approved' ? 'bg-green-100 text-green-800' :
                                                user.approval_status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-gray-100 text-gray-800'
                                             }`}>
                                                {user.approval_status}
                                             </span>
                                         </td>
                                         <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 hidden md:table-cell">
                                             {user.role === 'Student' ? `Br: ${user.branch_code || 'N/A'}, Div: ${user.division_name || 'N/A'}, Ba: ${user.batch_name || 'N/A'}` : 'N/A'}
                                         </td>
                                         <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                             <Button variant="link" onClick={() => handleEdit(user)} className="text-xs px-2 py-1">Edit</Button>
                                             <Button variant="danger-link" onClick={() => handleDelete(user.user_id)} className="text-xs px-2 py-1" disabled={user.role === 'Administrator'}>Delete</Button>
                                         </td>
                                     </tr>
                                 ))}
                             </tbody>
                         </table>
                    </div>
                    {/* TODO: Add Pagination Controls */}
                 </>
            )}
             <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`Edit User: ${selectedUser?.full_name}`}>
                {selectedUser && (
                    <EditUserForm user={selectedUser} onSave={handleUpdateUser} onCancel={() => setIsModalOpen(false)} />
                )}
             </Modal>
         </div>
    );
}

// --- Edit User Form Component ---
function EditUserForm({ user, onSave, onCancel }) {
    const [formData, setFormData] = useState({
        full_name: user.full_name || '',
        email: user.email || '',
        role: user.role || '',
        // TODO: Fetch and allow changing division/batch if student? Requires API calls.
        // For now, backend only updates name, email, role.
    });
     const [error, setError] = useState('');
     const [loading, setLoading] = useState(false); // Add loading state for save

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
         if (!formData.full_name.trim() || !formData.email.trim()) {
             setError("Name and Email cannot be empty."); return;
         }
        setLoading(true);
        // We only pass the fields the backend expects
        const dataToSave = {
            full_name: formData.full_name,
            email: formData.email,
            role: formData.role,
        };
        await onSave(dataToSave); // Call parent handler which contains API logic
        setLoading(false); // Parent handler should set loading state too
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
             {error && <p className="bg-red-100 text-red-700 p-3 rounded text-sm border border-red-300">{error}</p>}
            <InputField label="Full Name" name="full_name" id={`edit-name-${user.user_id}`} value={formData.full_name} onChange={handleChange} />
            <InputField label="Email" name="email" type="email" id={`edit-email-${user.user_id}`} value={formData.email} onChange={handleChange} />
             <SelectField label="Role" name="role" id={`edit-role-${user.user_id}`} value={formData.role} onChange={handleChange} disabled={user.role === 'Administrator'}>
                 <option value="Student">Student</option>
                 <option value="Professor">Professor</option>
                 <option value="Administrator">Administrator</option>
             </SelectField>
             {/* Add Branch/Division/Batch fields conditionally if user.role === 'Student' */}
             {/* This would require fetching branches/divisions/batches similar to RegisterPage */}
             {user.role === 'Student' && (
                <div className="p-3 bg-gray-100 rounded-md border text-sm text-gray-600">
                    <p><strong>Student Details:</strong></p>
                    <p>Br: {user.branch_code || 'N/A'}, Div: {user.division_name || 'N/A'}, Ba: {user.batch_name || 'N/A'}</p>
                    <p className="italic mt-1">Note: Editing student academic details is not yet supported in this form.</p>
                </div>
             )}
             <div className="flex justify-end space-x-3 pt-3 border-t mt-6">
                 <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>Cancel</Button>
                 <Button type="submit" variant="primary" disabled={loading}>
                    {loading ? 'Saving...' : 'Save Changes'}
                 </Button>
             </div>
        </form>
    );
}
// --- END User Management Components ---


// --- Resource Management: Classrooms ---

function ManageClassrooms() {
    const [classrooms, setClassrooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClassroom, setEditingClassroom] = useState(null); // null for 'Add', object for 'Edit'

    const fetchClassrooms = useCallback(async () => {
        setLoading(true); setError('');
        try {
            // This endpoint needs to be created in server.js
            // Assuming GET /api/admin/classrooms
            const response = await apiClient.get('/admin/classrooms'); 
            setClassrooms(Array.isArray(response.data) ? response.data : []);
        } catch (err) {
            console.error("Error fetching classrooms:", err);
            setError(err.response?.data?.message || err.message || "Failed to load classrooms.");
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchClassrooms(); }, [fetchClassrooms]);

    const handleOpenAddModal = () => {
        setEditingClassroom(null); // Clear editing state for 'Add'
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (classroom) => {
        setEditingClassroom(classroom);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingClassroom(null); // Clear editing state on close
    };

    const handleSaveClassroom = async (classroomData) => {
        // This state should probably be local to the modal
        // setLoading(true); 
        try {
            if (editingClassroom) { // Update existing
                // Assuming PUT /api/admin/classrooms/:id
                await apiClient.put(`/admin/classrooms/${editingClassroom.classroom_id}`, classroomData);
                alert('Classroom updated successfully!');
            } else { // Create new
                // Assuming POST /api/admin/classrooms
                await apiClient.post('/admin/classrooms', classroomData);
                alert('Classroom added successfully!');
            }
            handleCloseModal();
            fetchClassrooms(); // Refresh the list
        } catch (err) {
            console.error("Error saving classroom:", err);
            // Display error within the modal?
            alert(`Error saving classroom: ${err.response?.data?.message || err.message}`);
        } finally {
            // setLoading(false);
        }
    };

    const handleDeleteClassroom = async (classroomId, roomNumber) => {
        if (!window.confirm(`DELETE classroom ${roomNumber} (ID: ${classroomId})? This cannot be undone.`)) return;
        try {
            // Assuming DELETE /api/admin/classrooms/:id
            await apiClient.delete(`/admin/classrooms/${classroomId}`);
            alert('Classroom deleted successfully!');
            fetchClassrooms(); // Refresh the list
        } catch (err) {
            console.error(`Error deleting classroom ${classroomId}:`, err);
            alert(`Failed to delete classroom: ${err.response?.data?.message || err.message || 'Server error'}`);
            // Specifically handle 409 Conflict error from backend
            if (err.response?.status === 409) {
                alert("Cannot delete: Classroom is currently in use in the schedule.");
            }
        }
    };

     return (
        <div className="bg-white shadow-lg overflow-hidden sm:rounded-lg p-4 sm:p-6">
            <div className="flex justify-between items-center mb-5 border-b pb-2">
                <h2 className="text-xl font-semibold text-gray-800">Manage Classrooms & Labs</h2>
                <Button variant="primary" onClick={handleOpenAddModal}>
                    + Add New Classroom
                </Button>
            </div>

            {loading && <LoadingSpinner />}
            {error && !loading && <ErrorMessage message={error} />}

            {!loading && !error && classrooms.length === 0 && (
                <p className="text-gray-500 italic text-center py-4">No classrooms found. Add one to get started.</p>
            )}

            {!loading && !error && classrooms.length > 0 && (
                <div className="overflow-x-auto relative border rounded-md">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Room No.</th>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Building</th>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Floor</th>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Capacity</th>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                         <tbody className="bg-white divide-y divide-gray-200">
                             {classrooms.map((cr) => (
                                <tr key={cr.classroom_id} className="hover:bg-gray-50 transition-colors duration-150">
                                     <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{cr.room_number}</td>
                                     <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{cr.building}</td>
                                     <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{cr.floor}</td>
                                     <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{cr.capacity ?? 'N/A'}</td>
                                     <td className="px-4 py-4 whitespace-nowrap text-sm">
                                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${cr.type === 'Lab' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                                            {cr.type}
                                          </span>
                                     </td>
                                     <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                        <Button variant="link" onClick={() => handleOpenEditModal(cr)} className="text-xs px-2 py-1">Edit</Button>
                                        <Button variant="danger-link" onClick={() => handleDeleteClassroom(cr.classroom_id, cr.room_number)} className="text-xs px-2 py-1">Delete</Button>
                                     </td>
                                 </tr>
                            ))}
                         </tbody>
                    </table>
                </div>
            )}

            <ClassroomFormModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSaveClassroom}
                classroom={editingClassroom} // Pass null for 'Add', classroom object for 'Edit'
            />
        </div>
    );
}

// Modal Form for Adding/Editing Classrooms
function ClassroomFormModal({ isOpen, onClose, onSave, classroom }) {
    const isEditing = classroom != null;
    const [formData, setFormData] = useState({
        room_number: '', building: '', floor: '', capacity: '', type: 'Theory'
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Pre-fill form if editing
        if (isEditing) {
            setFormData({
                room_number: classroom.room_number || '',
                building: classroom.building || '',
                floor: classroom.floor || '',
                capacity: classroom.capacity || '',
                type: classroom.type || 'Theory'
            });
        } else {
             // Reset form if adding
             setFormData({ room_number: '', building: '', floor: '', capacity: '', type: 'Theory' });
        }
        setError(''); // Clear errors when modal opens or classroom changes
    }, [classroom, isEditing, isOpen]); // Rerun effect when these change

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        // Simple Validation
        if (!formData.room_number.trim() || !formData.building.trim() || !formData.floor.trim() || !formData.type.trim()) {
            setError("Room Number, Building, Floor, and Type are required."); return;
        }
        if (formData.capacity && isNaN(parseInt(formData.capacity))) {
             setError("Capacity must be a number."); return;
        }

        const dataToSave = {
            ...formData,
            capacity: formData.capacity ? parseInt(formData.capacity) : 0, // Ensure capacity is a number
        };

        setLoading(true);
        try {
            await onSave(dataToSave); // Call the parent handler (ManageClassrooms)
        } catch (apiError) {
             setError(apiError.message || "Failed to save classroom.");
        } finally {
            setLoading(false);
        }
        // Parent handler will close modal on success
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Classroom' : 'Add New Classroom'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                 {error && <p className="bg-red-100 text-red-700 p-3 rounded text-sm border border-red-300">{error}</p>}
                <InputField label="Room Number" name="room_number" value={formData.room_number} onChange={handleChange} placeholder="e.g., 1201" />
                <InputField label="Building" name="building" value={formData.building} onChange={handleChange} placeholder="e.g., Building 1" />
                <InputField label="Floor" name="floor" value={formData.floor} onChange={handleChange} placeholder="e.g., 2" />
                <InputField label="Capacity" name="capacity" type="number" value={formData.capacity} onChange={handleChange} required={false} placeholder="e.g., 60"/>
                <SelectField label="Type" name="type" value={formData.type} onChange={handleChange}>
                    <option value="Theory">Theory</option>
                    <option value="Lab">Lab</option>
                </SelectField>

                 <div className="flex justify-end space-x-3 pt-3 border-t mt-6">
                     <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
                     <Button type="submit" variant="primary" disabled={loading}>
                        {loading ? 'Saving...' : (isEditing ? 'Update Classroom' : 'Add Classroom')}
                     </Button>
                 </div>
            </form>
        </Modal>
    );
}

// --- Resource Management: Courses ---

function ManageCourses() {
    const [courses, setCourses] = useState([]);
    const [branches, setBranches] = useState([]); // Need branches for the form dropdown
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCourse, setEditingCourse] = useState(null); // null for 'Add', object for 'Edit'

    const fetchCoursesAndBranches = useCallback(async () => {
        setLoading(true); setError('');
        try {
            // Fetch both in parallel
            const [coursesRes, branchesRes] = await Promise.all([
                apiClient.get('/admin/courses'), // Assuming GET /api/admin/courses
                apiClient.get('/branches') // Use the public branches endpoint
            ]);
            setCourses(Array.isArray(coursesRes.data) ? coursesRes.data : []);
            setBranches(Array.isArray(branchesRes.data) ? branchesRes.data : []);
        } catch (err) {
            console.error("Error fetching courses or branches:", err);
            setError(err.response?.data?.message || err.message || "Failed to load data.");
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchCoursesAndBranches(); }, [fetchCoursesAndBranches]);

    const handleOpenAddModal = () => { setEditingCourse(null); setIsModalOpen(true); };
    const handleOpenEditModal = (course) => { setEditingCourse(course); setIsModalOpen(true); };
    const handleCloseModal = () => { setIsModalOpen(false); setEditingCourse(null); };

    const handleSaveCourse = async (courseData) => {
        // setLoading(true); // Handled in modal
        try {
             // Convert branch_id and credits back to numbers
             const dataToSave = {
                 ...courseData,
                 branch_id: parseInt(courseData.branch_id),
                 credits: parseInt(courseData.credits),
             };
            if (editingCourse) {
                // Assuming PUT /api/admin/courses/:id
                await apiClient.put(`/admin/courses/${editingCourse.course_id}`, dataToSave);
                alert('Course updated successfully!');
            } else {
                // Assuming POST /api/admin/courses
                await apiClient.post('/admin/courses', dataToSave);
                alert('Course added successfully!');
            }
            handleCloseModal();
            fetchCoursesAndBranches(); // Refresh list
        } catch (err) {
            console.error("Error saving course:", err);
            alert(`Error saving course: ${err.response?.data?.message || err.message}`);
            // Re-throw to be caught by modal
            throw new Error(err.response?.data?.message || "Failed to save course.");
        } finally {
            // setLoading(false); // Handled in modal
        }
    };

    const handleDeleteCourse = async (courseId, courseCode) => {
        if (!window.confirm(`DELETE course ${courseCode} (ID: ${courseId})? This cannot be undone.`)) return;
        try {
            // Assuming DELETE /api/admin/courses/:id
            await apiClient.delete(`/admin/courses/${courseId}`);
            alert('Course deleted successfully!');
            fetchCoursesAndBranches(); // Refresh list
        } catch (err) {
            console.error(`Error deleting course ${courseId}:`, err);
            alert(`Failed to delete course: ${err.response?.data?.message || err.message || 'Server error'}`);
             if (err.response?.status === 409) {
                alert("Cannot delete: Course is currently in use in the schedule.");
            }
        }
    };

     return (
        <div className="bg-white shadow-lg overflow-hidden sm:rounded-lg p-4 sm:p-6">
            <div className="flex justify-between items-center mb-5 border-b pb-2">
                <h2 className="text-xl font-semibold text-gray-800">Manage Courses</h2>
                <Button variant="primary" onClick={handleOpenAddModal}>
                    + Add New Course
                </Button>
            </div>

            {loading && <LoadingSpinner />}
            {error && !loading && <ErrorMessage message={error} />}

            {!loading && !error && courses.length === 0 && (
                 <p className="text-gray-500 italic text-center py-4">No courses found. Add one to get started.</p>
            )}

            {!loading && !error && courses.length > 0 && (
                 <div className="overflow-x-auto relative border rounded-md">
                     <table className="min-w-full divide-y divide-gray-200">
                         <thead className="bg-gray-50">
                             <tr>
                                 <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                                 <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                 <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Branch</th>
                                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Credits</th>
                                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                 <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                             </tr>
                         </thead>
                         <tbody className="bg-white divide-y divide-gray-200">
                             {courses.map((c) => (
                                 <tr key={c.course_id} className="hover:bg-gray-50 transition-colors duration-150">
                                     <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{c.course_code}</td>
                                     <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{c.course_name}</td>
                                     <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{c.branch_code || 'N/A'}</td>
                                     <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{c.credits ?? 'N/A'}</td>
                                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                                         <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${c.type === 'Lab' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                                             {c.type}
                                         </span>
                                     </td>
                                     <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                         <Button variant="link" onClick={() => handleOpenEditModal(c)} className="text-xs px-2 py-1">Edit</Button>
                                         <Button variant="danger-link" onClick={() => handleDeleteCourse(c.course_id, c.course_code)} className="text-xs px-2 py-1">Delete</Button>
                                     </td>
                                 </tr>
                            ))}
                         </tbody>
                     </table>
                 </div>
            )}

            <CourseFormModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSaveCourse}
                course={editingCourse}
                branches={branches} // Pass branches data to the modal
            />
        </div>
    );
}

// Modal Form for Adding/Editing Courses
function CourseFormModal({ isOpen, onClose, onSave, course, branches }) {
    const isEditing = course != null;
    const initialFormData = useMemo(() => ({
        course_code: '', course_name: '', branch_id: '', credits: '', type: 'Theory'
    }), []); // Memoize initial state

    const [formData, setFormData] = useState(initialFormData);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);


    useEffect(() => {
        if (isOpen) {
            if (isEditing) {
                setFormData({
                    course_code: course.course_code || '',
                    course_name: course.course_name || '',
                    branch_id: course.branch_id || '',
                    credits: course.credits || '',
                    type: course.type || 'Theory'
                });
            } else {
                 setFormData(initialFormData); // Reset form if adding
            }
             setError(''); // Clear errors when modal opens or course changes
        }
    }, [course, isEditing, isOpen, initialFormData]);


    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        // Validation
        if (!formData.course_code.trim() || !formData.course_name.trim() || !formData.branch_id || !formData.credits || !formData.type) {
            setError("All fields are required."); return;
        }
        if (isNaN(parseInt(formData.credits))) {
            setError("Credits must be a number."); return;
        }

        setLoading(true);
        try {
            await onSave(formData);
        } catch (apiError) {
             setError(apiError.message || "Failed to save course.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Course' : 'Add New Course'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                 {error && <p className="bg-red-100 text-red-700 p-3 rounded text-sm border border-red-300">{error}</p>}
                <InputField label="Course Code" name="course_code" value={formData.course_code} onChange={handleChange} placeholder="e.g., CS201" />
                <InputField label="Course Name" name="course_name" value={formData.course_name} onChange={handleChange} placeholder="e.g., Data Structures" />
                 <SelectField label="Branch" name="branch_id" value={formData.branch_id} onChange={handleChange}>
                     <option value="" disabled>-- Select Branch --</option>
                     {branches.map(branch => (
                         <option key={branch.branch_id} value={branch.branch_id}>
                             {branch.branch_name} ({branch.branch_code})
                         </option>
                     ))}
                 </SelectField>
                <InputField label="Credits" name="credits" type="number" value={formData.credits} onChange={handleChange} placeholder="e.g., 4" />
                <SelectField label="Type" name="type" value={formData.type} onChange={handleChange}>
                    <option value="Theory">Theory</option>
                    <option value="Lab">Lab</option>
                </SelectField>

                 <div className="flex justify-end space-x-3 pt-3 border-t mt-6">
                     <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
                     <Button type="submit" variant="primary" disabled={loading}>
                         {loading ? 'Saving...' : (isEditing ? 'Update Course' : 'Add Course')}
                     </Button>
                 </div>
            </form>
        </Modal>
    );
}


// --- Academic Structure Management ---

function ManageAcademicStructure() {
    const [structure, setStructure] = useState([]); // Changed from 'branches' to 'structure'
    // TODO: Add state for divisions and batches, likely grouped
    // const [divisions, setDivisions] = useState({}); // Example: { branchId: [...] }
    // const [batches, setBatches] = useState({}); // Example: { divisionId: [...] }
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // --- MODIFICATION: Fetch Full Nested Structure ---
    // Needs backend endpoints: GET /api/branches, GET /api/divisions, GET /api/batches
    const fetchData = useCallback(async () => {
         setLoading(true); setError('');
         try {
             // Fetch the new single, nested endpoint
             const response = await apiClient.get('/admin/structure'); // <-- CHANGED ENDPOINT
             setStructure(Array.isArray(response.data) ? response.data : []); // <-- SET FULL STRUCTURE
             console.log("Fetched structure:", response.data);

         } catch (err) {
            console.error("Error fetching academic structure:", err);
            setError(err.response?.data?.message || err.message || "Failed to load academic structure.");
         } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    if (loading) return <LoadingSpinner />;
    if (error) return <ErrorMessage message={error} />;

    // Basic Card structure for display
    return (
        <div className="bg-white shadow-lg overflow-hidden sm:rounded-lg p-4 sm:p-6">
            <div className="flex justify-between items-center mb-5 border-b pb-2">
                 <h2 className="text-xl font-semibold text-gray-800">Manage Academic Structure</h2>
                 {/* TODO: Add 'Add Branch/Division/Batch' buttons triggering modals */}
                 <div className="space-x-2">
                    <Button variant="primary" onClick={() => alert('Add Branch: Not implemented')} disabled>+ Add Branch</Button>
                    <Button variant="primary" onClick={() => alert('Add Division: Not implemented')} disabled>+ Add Division</Button>
                    <Button variant="primary" onClick={() => alert('Add Batch: Not implemented')} disabled>+ Add Batch</Button>
                 </div>
            </div>

            {structure.length === 0 ? ( // <-- CHANGED from branches.length
                <p className="text-gray-500 italic text-center py-4">No academic structure found.</p>
            ) : (
                <div className="space-y-6">
                    {structure.map(branch => ( // <-- CHANGED from branches.map
                        <div key={branch.branch_id} className="border rounded-lg p-4 shadow-sm bg-gray-50">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-lg font-semibold text-indigo-700">{branch.branch_name} ({branch.branch_code})</h3>
                                {/* TODO: Add Edit/Delete buttons for Branch */}
                                <div className="space-x-1">
                                    <Button variant="link" className="text-xs" onClick={() => alert('Edit Branch: Not implemented')} disabled>Edit</Button>
                                    <Button variant="danger-link" className="text-xs" onClick={() => alert('Delete Branch: Not implemented')} disabled>Delete</Button>
                                </div>
                            </div>

                            {/* --- MODIFICATION: Render Divisions and Batches --- */}
                            {branch.divisions && branch.divisions.length > 0 ? (
                                <div className="ml-4 space-y-3">
                                    {branch.divisions.map(div => (
                                        <div key={div.division_id} className="border-l-2 pl-3 border-indigo-200 py-1">
                                             <div className="flex justify-between items-center">
                                                <p className="font-medium text-gray-700">Division: {div.division_name}</p>
                                                {/* TODO: Edit/Delete buttons for Division */}
                                                <div className="space-x-1">
                                                    <Button variant="link" className="text-xs" onClick={() => alert('Edit Division: Not implemented')} disabled>Edit</Button>
                                                    <Button variant="danger-link" className="text-xs" onClick={() => alert('Delete Division: Not implemented')} disabled>Delete</Button>
                                                </div>
                                             </div>
                                            
                                            {/* Render Batches */}
                                            {div.batches && div.batches.length > 0 ? (
                                                <div className="ml-4 space-x-2 space-y-1 mt-2 flex flex-wrap">
                                                     {div.batches.map(batch => (
                                                         <div key={batch.batch_id} className="border-l pl-2 border-gray-300 py-1 px-2 bg-white rounded shadow-sm flex items-center">
                                                              <p className="text-sm text-gray-600">Batch: {batch.batch_name}</p>
                                                              {/* TODO: Edit/Delete buttons for Batch */}
                                                              <div className="ml-2 space-x-0">
                                                                <Button variant="link" className="text-xs !p-0.5" onClick={() => alert('Edit Batch: Not implemented')} disabled>E</Button>
                                                                <Button variant="danger-link" className="text-xs !p-0.5" onClick={() => alert('Delete Batch: Not implemented')} disabled>D</Button>
                                                              </div>
                                                         </div>
                                                     ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-gray-400 italic ml-4">No batches found for this division.</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                 <p className="text-sm text-gray-500 italic ml-4">
                                    No divisions found for this branch.
                                </p>
                            )}
                            {/* --- END MODIFICATION --- */}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}


export default AdminDashboard;

