import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast'; // Import toast
import logo from '../../Utils/logo.png';

// --- Reusable Components (Ideally move to src/components later) ---
const InputField = ({ id, label, type = 'text', value, onChange, required = true, placeholder = '', error, autoComplete = "off" }) => (
    <div className="mb-4">
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        <input
            type={type}
            id={id}
            name={id} // Ensure name matches id for handleChange
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
            name={id} // Ensure name matches id for handleChange
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
const API_BASE_URL = 'https://noclash.onrender.com/api'; // Ensure this matches your backend

// --- RegisterPage Component ---
function RegisterPage() {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        role: '',
        fullName: '',
        email: '',
        password: '',
        confirmPassword: '',
        branchId: '',
        divisionId: '',
        batchId: '',
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
            } catch (error) {
                 console.error("Error fetching branches:", error);
                 setApiError("Could not load branch data. Please ensure the backend server is running and accessible.");
                 toast.error("Could not load branch data."); // Add toast
            } finally {
                 setLoadingDropdowns(false);
            }
        };
        fetchBranches();
    }, []);

     // Fetch divisions when branchId changes
    useEffect(() => {
        const fetchDivisions = async () => {
            if (!formData.branchId) {
                setDivisions([]); setBatches([]);
                setFormData(prev => ({ ...prev, divisionId: '', batchId: '' }));
                return;
            }
            setLoadingDropdowns(true);
            setFormData(prev => ({ ...prev, divisionId: '', batchId: '' }));
            try {
                // --- TEMPORARILY COMMENTED OUT - Requires dedicated public endpoint ---
                // const response = await axios.get(`${API_BASE_URL}/divisions?branchId=${formData.branchId}`);
                // setDivisions(response.data.map(d => ({ value: d.division_id, label: d.division_name })));
                console.warn("Division fetching is disabled. Requires a public '/api/divisions' endpoint.");
                setDivisions([]); // Keep dropdown empty for now
                // --- END TEMPORARY ---
            } catch (error) {
                 console.error("Error fetching divisions:", error);
                 setApiError("Could not load division data.");
                 toast.error("Could not load division data.");
            } finally {
                 setLoadingDropdowns(false);
            }
        };
        // Only run if branchId is selected
        if (formData.branchId) {
            fetchDivisions();
        } else {
             // Clear divisions if branchId is deselected
             setDivisions([]);
             setBatches([]);
        }
    }, [formData.branchId]);

    // Fetch batches when divisionId changes
    useEffect(() => {
        const fetchBatches = async () => {
             if (!formData.divisionId) {
                 setBatches([]);
                 setFormData(prev => ({ ...prev, batchId: '' }));
                 return;
            }
             setLoadingDropdowns(true);
             setFormData(prev => ({ ...prev, batchId: '' }));
            try {
                 // --- TEMPORARILY COMMENTED OUT - Requires dedicated public endpoint ---
                // const response = await axios.get(`${API_BASE_URL}/batches?divisionId=${formData.divisionId}`);
                // setBatches(response.data.map(b => ({ value: b.batch_id, label: b.batch_name })));
                console.warn("Batch fetching is disabled. Requires a public '/api/batches' endpoint.");
                setBatches([]); // Keep dropdown empty for now
                 // --- END TEMPORARY ---
            } catch (error) {
                 console.error("Error fetching batches:", error);
                 setApiError("Could not load batch data.");
                 toast.error("Could not load batch data.");
            } finally {
                 setLoadingDropdowns(false);
            }
        };
        // Only run if divisionId is selected
        if (formData.divisionId) {
            fetchBatches();
        } else {
            // Clear batches if divisionId is deselected
             setBatches([]);
        }
    }, [formData.divisionId]);

    // --- Form Handling ---
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: undefined }));

        // Reset logic remains the same
        if (name === 'branchId') {
            setFormData(prev => ({ ...prev, divisionId: '', batchId: '' }));
            // No need to clear state here, useEffect handles it
        } else if (name === 'divisionId') {
            setFormData(prev => ({ ...prev, batchId: '' }));
             // No need to clear state here, useEffect handles it
        }
    };

    const validateStep = () => {
        const newErrors = {};
        if (step === 1) { if (!formData.role) newErrors.role = 'Please select a role.'; }
        else if (step === 2) {
            if (!formData.fullName.trim()) newErrors.fullName = 'Full name is required.';
            if (!formData.email.trim()) newErrors.email = 'Email is required.';
            else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email address is invalid.';
            if (!formData.password) newErrors.password = 'Password is required.';
            else if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters long.';
            if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match.';
        } else if (step === 3 && formData.role === 'Student') {
             // Temporarily disable validation for dropdowns until API exists
            // if (!formData.branchId) newErrors.branchId = 'Branch selection is required.';
            // if (!formData.divisionId) newErrors.divisionId = 'Division selection is required.';
            // if (!formData.batchId) newErrors.batchId = 'Batch selection is required.';
             console.log("Skipping step 3 validation until dropdown APIs are implemented.");
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const nextStep = () => { if (validateStep()) { setApiError(''); if (step === 1 && formData.role === 'Professor') setStep(2); else if (step < 3) setStep(step + 1); } };
    const prevStep = () => { setApiError(''); if (step > 1) { setErrors({}); setStep(step - 1); } };

    const handleRegister = async () => {
        // Re-validate final step before submitting
        if (!validateStep()) {
             // Highlight validation errors if any exist
             toast.error("Please correct the errors in the form.");
             return;
        }

         // Add specific check for student academic details if APIs were enabled
         if (formData.role === 'Student' && (!formData.branchId || !formData.divisionId || !formData.batchId)) {
             // This check will only be relevant once dropdowns are functional
              setApiError('Branch, Division, and Batch are required for student registration.');
              toast.error('Branch, Division, and Batch are required for student registration.');
              setStep(3); // Go back to step 3 if student details are missing
              return;
         }


        setApiError(''); setLoading(true);

        const payload = {
            fullName: formData.fullName,
            email: formData.email,
            password: formData.password,
            role: formData.role,
            // Only include these if they have values (i.e., student role and selected)
            branchId: formData.branchId ? parseInt(formData.branchId) : null,
            divisionId: formData.divisionId ? parseInt(formData.divisionId) : null,
            batchId: formData.batchId ? parseInt(formData.batchId) : null,
        };

         // Clean payload for Professor role
         if (payload.role === 'Professor') {
             delete payload.branchId;
             delete payload.divisionId;
             delete payload.batchId;
         }

        console.log("Sending Payload:", payload);

        try {
            const response = await axios.post(`${API_BASE_URL}/register`, payload);
            console.log('Registration successful:', response.data);
            toast.success('Registration successful! Waiting for admin approval.', { duration: 5000 });
            navigate('/login');
        } catch (err) {
            console.error('Registration error details:', err);
             const message = err.response?.data?.message || 'Registration failed. Please check details or try again later.';
             setApiError(message);
             toast.error(message);
        } finally { setLoading(false); }
    };

    // --- Render Logic ---
    const renderStepContent = () => {
        switch (step) {
            case 1: return (
                 <>
                    <h3 className="text-xl font-semibold text-gray-800 mb-6 text-center">Step 1: Choose Role</h3>
                    <SelectField id="role" label="Registering as a" value={formData.role} onChange={handleChange} options={[{ value: 'Professor', label: 'Professor' }, { value: 'Student', label: 'Student' }]} placeholder="Select role..." error={errors.role} />
                 </>
            );
            case 2: return (
                 <>
                    <h3 className="text-xl font-semibold text-gray-800 mb-6 text-center">Step 2: Account Details</h3>
                    <InputField id="fullName" label="Full Name" value={formData.fullName} onChange={handleChange} placeholder="Enter full name" error={errors.fullName} />
                    <InputField id="email" label="Email Address" type="email" value={formData.email} onChange={handleChange} placeholder="you@example.com" error={errors.email} autoComplete="email" />
                    <InputField id="password" label="Password" type="password" value={formData.password} onChange={handleChange} placeholder="Min. 6 characters" error={errors.password} autoComplete="new-password"/>
                    <InputField id="confirmPassword" label="Confirm Password" type="password" value={formData.confirmPassword} onChange={handleChange} placeholder="Re-enter password" error={errors.confirmPassword} autoComplete="new-password"/>
                 </>
            );
            case 3: if (formData.role !== 'Student') return null; return (
                 <>
                    <h3 className="text-xl font-semibold text-gray-800 mb-6 text-center">Step 3: Academic Details</h3>
                    <SelectField id="branchId" label="Branch" value={formData.branchId} onChange={handleChange} options={branches} placeholder="Select branch..." error={errors.branchId} disabled={loadingDropdowns} />
                    {/* Display note about API requirement */}
                     <p className="text-xs text-orange-600 mb-2">*Division & Batch dropdowns require backend API implementation.</p>
                    <SelectField id="divisionId" label="Division" value={formData.divisionId} onChange={handleChange} options={divisions} placeholder={!formData.branchId ? "Select branch first" : (loadingDropdowns ? "Loading..." : "Select division...")} error={errors.divisionId} disabled={!formData.branchId || loadingDropdowns || divisions.length === 0} />
                    <SelectField id="batchId" label="Batch" value={formData.batchId} onChange={handleChange} options={batches} placeholder={!formData.divisionId ? "Select division first" : (loadingDropdowns ? "Loading..." : "Select batch...")} error={errors.batchId} disabled={!formData.divisionId || loadingDropdowns || batches.length === 0} />
                    {loadingDropdowns && <div className="flex justify-center"><Spinner/></div>}
                 </>
            );
            default: return null;
        }
    };

     let nextButtonText = 'Next';
     const isFinalSubmitStep = (step === 2 && formData.role === 'Professor') || (step === 3 && formData.role === 'Student');
     if (isFinalSubmitStep) nextButtonText = 'Register';
     else if (step === 1 && formData.role === 'Professor') nextButtonText = 'Next';

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-white to-purple-100 font-sans p-6">
             <Toaster position="top-right" />
            <div className="w-full max-w-lg bg-white rounded-xl shadow-lg p-8 sm:p-10 border border-gray-200">
                <div className="flex items-center justify-center mb-4">
                    <div className="w-20 h-20 mr-3 rounded-md bg-white p-2 shadow-md flex items-center justify-center border border-gray-200">
                        <img src={logo} alt="NoClash Logo" className="w-full h-full object-contain" />
                    </div>
                    <div className="text-center">
                        <h2 className="text-2xl font-bold text-gray-800">NoClash</h2>
                        <p className="text-sm text-indigo-600 font-medium">Timetable Conflict Checker</p>
                    </div>
                </div>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4 text-center">Create account</h2>
                {/* Progress Indicator */}
             <div className="mb-8 flex justify-center items-center space-x-2 sm:space-x-4 px-2">
                     {['Role', 'Details', formData.role === 'Student' ? 'Academic' : null].filter(Boolean).map((stepName, index) => (
                        <React.Fragment key={index}>
                           {index > 0 && <div className={`flex-1 h-1 rounded ${step > index ? 'bg-indigo-500' : 'bg-gray-300'}`}></div>}
                            <div className="flex flex-col items-center flex-shrink-0">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= index + 1 ? 'bg-indigo-600 text-white' : 'bg-gray-300 text-gray-600'}`}> {index + 1} </div>
                                <span className={`mt-1 text-xs text-center ${step >= index + 1 ? 'text-indigo-700 font-medium' : 'text-gray-500'}`}>{stepName}</span>
                            </div>
                        </React.Fragment>
                    ))}
                </div>
                <AlertMessage message={apiError} type="error" />
                <div className="min-h-[300px] sm:min-h-[350px]"> {renderStepContent()} </div>
                {/* Navigation Buttons */}
                <div className="mt-8 flex justify-between items-center">
                    <button type="button" onClick={prevStep} disabled={step === 1 || loading} className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-md shadow-sm transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"> Back </button>
                    <button
                        type="button"
                        onClick={isFinalSubmitStep ? handleRegister : nextStep}
                        // Disable Register/Next if dropdowns are loading OR if student is on final step but required fields are missing (after APIs are implemented)
                        disabled={loading || loadingDropdowns || (step === 1 && !formData.role) /* || (isFinalSubmitStep && formData.role === 'Student' && (!formData.branchId || !formData.divisionId || !formData.batchId)) */}
                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md shadow-sm transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[80px]"
                    >
                         {loading ? <Spinner /> : nextButtonText }
                    </button>
                </div>
                <p className="mt-6 text-center text-sm text-gray-600"> Already have an account?{' '} <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500"> Sign in </Link> </p>
            </div>
        </div>
    );
}

export default RegisterPage;

