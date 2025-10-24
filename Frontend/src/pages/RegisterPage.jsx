import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';

// --- Reusable Components (Ideally move to src/components later) ---
const InputField = ({ id, label, type = 'text', value, onChange, required = true, placeholder = '', error, autoComplete = "off" }) => (
    <div className="mb-4">
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        <input
            type={type}
            id={id}
            name={id}
            value={value}
            onChange={onChange}
            required={required}
            placeholder={placeholder}
            autoComplete={autoComplete}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 sm:text-sm ${error ? 'border-red-500 ring-red-500' : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'}`}
        />
         {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
);

const SelectField = ({ id, label, value, onChange, required = true, options = [], placeholder = 'Select...', error, disabled = false }) => (
    <div className="mb-4">
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        <select
            id={id}
            name={id}
            value={value}
            onChange={onChange}
            required={required}
            disabled={disabled}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 bg-white sm:text-sm ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''} ${error ? 'border-red-500 ring-red-500' : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'}`}
        >
            <option value="" disabled>{placeholder}</option>
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
         {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
);

const Spinner = () => (
    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const AlertMessage = ({ message, type = 'error' }) => {
    const bgColor = type === 'error' ? 'bg-red-100 border-red-400 text-red-700' : 'bg-green-100 border-green-400 text-green-700';
    if (!message) return null;
    return (
        <div className={`mb-4 p-3 border rounded-md text-sm ${bgColor}`}>
            {message}
        </div>
    );
};

// --- API Base URL ---
const API_BASE_URL = 'http://localhost:4000/api'; // Ensure this matches your backend

// --- RegisterPage Component ---
function RegisterPage() {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        role: '', full_name: '', email: '', password: '', confirmPassword: '',
        branch_id: '', division_id: '', batch_id: '',
    });
    const [errors, setErrors] = useState({});
    const [apiError, setApiError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const [branches, setBranches] = useState([]);
    const [divisions, setDivisions] = useState([]);
    const [batches, setBatches] = useState([]);
    const [loadingDropdowns, setLoadingDropdowns] = useState(false);

    // Fetch branches on component mount
    useEffect(() => {
        const fetchBranches = async () => {
            setLoadingDropdowns(true);
            try {
                const response = await axios.get(`${API_BASE_URL}/branches`);
                setBranches(response.data.map(branch => ({ value: branch.branch_id, label: `${branch.branch_name} (${branch.branch_code})` })));
            } catch (error) { console.error("Error fetching branches:", error); setApiError("Could not load branch data."); }
            finally { setLoadingDropdowns(false); }
        };
        fetchBranches();
    }, []);

    // Fetch divisions when branch_id changes
    useEffect(() => {
        const fetchDivisions = async () => {
            if (!formData.branch_id) { setDivisions([]); setFormData(prev => ({ ...prev, division_id: '', batch_id: '' })); return; }
            setLoadingDropdowns(true); setFormData(prev => ({ ...prev, division_id: '', batch_id: '' }));
            try {
                // --- TODO: Replace with actual API call: GET /api/divisions?branchId=... ---
                const allDivisionsPlaceholder = [ /* See previous example */
                    { value: 1, label: 'A', branch_id: 1 }, { value: 2, label: 'B', branch_id: 1 }, { value: 3, label: 'C', branch_id: 1 }, { value: 4, label: 'D', branch_id: 1 },
                    { value: 5, label: 'A', branch_id: 2 }, { value: 6, label: 'B', branch_id: 2 }, { value: 7, label: 'C', branch_id: 2 }, { value: 8, label: 'D', branch_id: 2 },
                    { value: 9, label: 'A', branch_id: 3 }, { value: 10, label: 'B', branch_id: 3 }, { value: 11, label: 'C', branch_id: 3 }, { value: 12, label: 'D', branch_id: 3 },
                    { value: 13, label: 'A', branch_id: 4 }, { value: 14, label: 'B', branch_id: 4 }, { value: 15, label: 'C', branch_id: 4 }, { value: 16, label: 'D', branch_id: 4 },
                    { value: 17, label: 'A', branch_id: 5 }, { value: 18, label: 'B', branch_id: 5 }, { value: 19, label: 'C', branch_id: 5 }, { value: 20, label: 'D', branch_id: 5 },
                ];
                const filteredDivisions = allDivisionsPlaceholder.filter(d => d.branch_id === parseInt(formData.branch_id)).map(d => ({ value: d.value, label: d.label }));
                setDivisions(filteredDivisions);
                // --- End Placeholder ---
            } catch (error) { console.error("Error fetching divisions:", error); setApiError("Could not load division data."); }
            finally { setLoadingDropdowns(false); }
        };
        fetchDivisions();
    }, [formData.branch_id]);

    // Fetch batches when division_id changes
    useEffect(() => {
        const fetchBatches = async () => {
             if (!formData.division_id) { setBatches([]); setFormData(prev => ({ ...prev, batch_id: '' })); return; }
             setLoadingDropdowns(true); setFormData(prev => ({ ...prev, batch_id: '' }));
            try {
                // --- TODO: Replace with actual API call: GET /api/batches?divisionId=... ---
                 const allBatchesPlaceholder = [ /* See previous example */
                    { value: 1, label: 'B1', division_id: 1 }, { value: 2, label: 'B2', division_id: 1 }, { value: 3, label: 'B3', division_id: 1 }, { value: 4, label: 'B1', division_id: 2 }, { value: 5, label: 'B2', division_id: 2 }, { value: 6, label: 'B3', division_id: 2 }, { value: 7, label: 'B1', division_id: 3 }, { value: 8, label: 'B2', division_id: 3 }, { value: 9, label: 'B3', division_id: 3 }, { value: 10, label: 'B1', division_id: 4 }, { value: 11, label: 'B2', division_id: 4 }, { value: 12, label: 'B3', division_id: 4 }, { value: 13, label: 'B1', division_id: 5 }, { value: 14, label: 'B2', division_id: 5 }, { value: 15, label: 'B3', division_id: 5 }, { value: 16, label: 'B1', division_id: 6 }, { value: 17, label: 'B2', division_id: 6 }, { value: 18, label: 'B3', division_id: 6 }, { value: 19, label: 'B1', division_id: 7 }, { value: 20, label: 'B2', division_id: 7 }, { value: 21, label: 'B3', division_id: 7 }, { value: 22, label: 'B1', division_id: 8 }, { value: 23, label: 'B2', division_id: 8 }, { value: 24, label: 'B3', division_id: 8 }, { value: 25, label: 'B1', division_id: 9 }, { value: 26, label: 'B2', division_id: 9 }, { value: 27, label: 'B3', division_id: 9 }, { value: 28, label: 'B1', division_id: 10 }, { value: 29, label: 'B2', division_id: 10 }, { value: 30, label: 'B3', division_id: 10 }, { value: 31, label: 'B1', division_id: 11 }, { value: 32, label: 'B2', division_id: 11 }, { value: 33, label: 'B3', division_id: 11 }, { value: 34, label: 'B1', division_id: 12 }, { value: 35, label: 'B2', division_id: 12 }, { value: 36, label: 'B3', division_id: 12 }, { value: 37, label: 'B1', division_id: 13 }, { value: 38, label: 'B2', division_id: 13 }, { value: 39, label: 'B3', division_id: 13 }, { value: 40, label: 'B1', division_id: 14 }, { value: 41, label: 'B2', division_id: 14 }, { value: 42, label: 'B3', division_id: 14 }, { value: 43, label: 'B1', division_id: 15 }, { value: 44, label: 'B2', division_id: 15 }, { value: 45, label: 'B3', division_id: 15 }, { value: 46, label: 'B1', division_id: 16 }, { value: 47, label: 'B2', division_id: 16 }, { value: 48, label: 'B3', division_id: 16 }, { value: 49, label: 'B1', division_id: 17 }, { value: 50, label: 'B2', division_id: 17 }, { value: 51, label: 'B3', division_id: 17 }, { value: 52, label: 'B1', division_id: 18 }, { value: 53, label: 'B2', division_id: 18 }, { value: 54, label: 'B3', division_id: 18 }, { value: 55, label: 'B1', division_id: 19 }, { value: 56, label: 'B2', division_id: 19 }, { value: 57, label: 'B3', division_id: 19 }, { value: 58, label: 'B1', division_id: 20 }, { value: 59, label: 'B2', division_id: 20 }, { value: 60, label: 'B3', division_id: 20 }
                 ];
                const filteredBatches = allBatchesPlaceholder.filter(b => b.division_id === parseInt(formData.division_id)).map(b => ({ value: b.value, label: b.label }));
                setBatches(filteredBatches);
                 // --- End Placeholder ---
            } catch (error) { console.error("Error fetching batches:", error); setApiError("Could not load batch data."); }
            finally { setLoadingDropdowns(false); }
        };
        fetchBatches();
    }, [formData.division_id]);

    // --- Form Handling ---
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: undefined }));
        if (name === 'branch_id') { setFormData(prev => ({ ...prev, division_id: '', batch_id: '' })); setDivisions([]); setBatches([]); }
        else if (name === 'division_id') { setFormData(prev => ({ ...prev, batch_id: '' })); setBatches([]); }
    };

    const validateStep = () => { /* ... (same validation logic as before) ... */
        const newErrors = {};
        if (step === 1) { if (!formData.role) newErrors.role = 'Please select a role.'; }
        else if (step === 2) {
            if (!formData.full_name.trim()) newErrors.full_name = 'Full name is required.';
            if (!formData.email.trim()) newErrors.email = 'Email is required.';
            else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email address is invalid.';
            if (!formData.password) newErrors.password = 'Password is required.';
            else if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters long.';
            if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match.';
        } else if (step === 3 && formData.role === 'Student') {
            if (!formData.branch_id) newErrors.branch_id = 'Branch selection is required.';
            if (!formData.division_id) newErrors.division_id = 'Division selection is required.';
            if (!formData.batch_id) newErrors.batch_id = 'Batch selection is required.';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const nextStep = () => { if (validateStep()) { setApiError(''); if (step === 1 && formData.role === 'Professor') setStep(2); else if (step < 3) setStep(step + 1); } };
    const prevStep = () => { setApiError(''); if (step > 1) setStep(step - 1); };

    const handleRegister = async () => {
        if (!validateStep()) return;
        setApiError(''); setLoading(true);
        const payload = {
            full_name: formData.full_name, email: formData.email, password: formData.password, role: formData.role,
            batch_id: (formData.role === 'Student' && formData.batch_id) ? parseInt(formData.batch_id) : null,
        };
        try {
            const response = await axios.post(`${API_BASE_URL}/register`, payload);
            console.log('Registration successful:', response.data);
            alert('Registration successful! Your account is pending admin approval.');
            navigate('/login');
        } catch (err) {
            console.error('Registration error details:', err);
             if (err.response) setApiError(err.response.data.message || 'Registration failed.');
             else if (err.request) setApiError('Network error. Could not reach server.');
             else setApiError('An unexpected error occurred.');
        } finally { setLoading(false); }
    };

    // --- Render Logic ---
    const renderStepContent = () => {
        switch (step) {
            case 1: return ( /* ... Role selection ... */
                 <>
                    <h3 className="text-xl font-semibold text-gray-800 mb-6 text-center">Step 1: Choose Role</h3>
                    <SelectField id="role" label="Registering as a" value={formData.role} onChange={handleChange} options={[{ value: 'Professor', label: 'Professor' }, { value: 'Student', label: 'Student' }]} placeholder="Select role..." error={errors.role} />
                 </>
            );
            case 2: return ( /* ... Common details ... */
                 <>
                    <h3 className="text-xl font-semibold text-gray-800 mb-6 text-center">Step 2: Account Details</h3>
                    <InputField id="full_name" label="Full Name" value={formData.full_name} onChange={handleChange} placeholder="Enter full name" error={errors.full_name} />
                    <InputField id="email" label="Email Address" type="email" value={formData.email} onChange={handleChange} placeholder="you@example.com" error={errors.email} autoComplete="email" />
                    <InputField id="password" label="Password" type="password" value={formData.password} onChange={handleChange} placeholder="Min. 6 characters" error={errors.password} autoComplete="new-password"/>
                    <InputField id="confirmPassword" label="Confirm Password" type="password" value={formData.confirmPassword} onChange={handleChange} placeholder="Re-enter password" error={errors.confirmPassword} autoComplete="new-password"/>
                 </>
            );
            case 3: if (formData.role !== 'Student') return null; return ( /* ... Student details ... */
                 <>
                    <h3 className="text-xl font-semibold text-gray-800 mb-6 text-center">Step 3: Academic Details</h3>
                    <SelectField id="branch_id" label="Branch" value={formData.branch_id} onChange={handleChange} options={branches} placeholder="Select branch..." error={errors.branch_id} disabled={loadingDropdowns} />
                    <SelectField id="division_id" label="Division" value={formData.division_id} onChange={handleChange} options={divisions} placeholder={!formData.branch_id ? "Select branch first" : (loadingDropdowns ? "Loading..." : "Select division...")} error={errors.division_id} disabled={!formData.branch_id || loadingDropdowns} />
                    <SelectField id="batch_id" label="Batch" value={formData.batch_id} onChange={handleChange} options={batches} placeholder={!formData.division_id ? "Select division first" : (loadingDropdowns ? "Loading..." : "Select batch...")} error={errors.batch_id} disabled={!formData.division_id || loadingDropdowns} />
                    {loadingDropdowns && <p className="text-sm text-gray-500 text-center">Loading options...</p>}
                 </>
            );
            default: return null;
        }
    };

     let nextButtonText = 'Next';
     const isFinalSubmitStep = (step === 2 && formData.role === 'Professor') || (step === 3 && formData.role === 'Student');
     if (isFinalSubmitStep) nextButtonText = 'Register';
     else if (step === 1 && formData.role === 'Professor') nextButtonText = 'Next'; // Explicitly set for Prof step 1->2

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-100 via-white to-teal-100 font-sans p-4">
            <div className="w-full max-w-lg bg-white rounded-lg shadow-xl p-8 border border-gray-200">
                <h2 className="text-3xl font-bold text-center text-teal-700 mb-4">Create Account</h2>
                {/* Progress Indicator */}
                <div className="mb-8 flex justify-center items-center space-x-2 sm:space-x-4 px-2">
                     {['Role', 'Details', formData.role === 'Student' ? 'Academic' : null].filter(Boolean).map((stepName, index) => (
                        <React.Fragment key={index}>
                           {index > 0 && <div className={`flex-1 h-1 rounded ${step > index ? 'bg-teal-500' : 'bg-gray-300'}`}></div>}
                            <div className="flex flex-col items-center flex-shrink-0">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= index + 1 ? 'bg-teal-600 text-white' : 'bg-gray-300 text-gray-600'}`}> {index + 1} </div>
                                <span className={`mt-1 text-xs text-center ${step >= index + 1 ? 'text-teal-700 font-medium' : 'text-gray-500'}`}>{stepName}</span>
                            </div>
                        </React.Fragment>
                    ))}
                </div>
                <AlertMessage message={apiError} type="error" />
                <div className="min-h-[300px] sm:min-h-[350px]"> {renderStepContent()} </div>
                {/* Navigation Buttons */}
                <div className="mt-8 flex justify-between items-center">
                    <button type="button" onClick={prevStep} disabled={step === 1 || loading} className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-md shadow-sm transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"> Back </button>
                    <button type="button" onClick={isFinalSubmitStep ? handleRegister : nextStep} disabled={loading || (step === 1 && !formData.role)} className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-md shadow-sm transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[80px]"> {loading ? <Spinner /> : nextButtonText } </button>
                </div>
                <p className="mt-6 text-center text-sm text-gray-600"> Already have an account?{' '} <Link to="/login" className="font-medium text-teal-600 hover:text-teal-500"> Sign in </Link> </p>
            </div>
        </div>
    );
}

export default RegisterPage; // Export the component
