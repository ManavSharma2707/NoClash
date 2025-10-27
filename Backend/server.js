import express from 'express';
// mysql pool moved to Backend/lib/db.js
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs'; // For password hashing
import jwt from 'jsonwebtoken'; // For JWTs
// import cron from 'node-cron'; // REMOVED as per previous step
import { getPool } from './lib/db.js';

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 4000; // Use port from env or default to 4000

// === MIDDLEWARE ===
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // Middleware to parse JSON bodies

// === DATABASE CONNECTION POOL ===
// Use shared pool from lib/db.js
const pool = getPool();

// === JWT MIDDLEWARE ===

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: Bearer TOKEN

    if (token == null) {
        console.warn('VerifyToken: No token provided');
        return res.status(401).json({ message: 'Authentication required: No token provided' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            console.warn('VerifyToken: Token invalid or expired', err.message);
            return res.status(403).json({ message: 'Authentication failed: Invalid or expired token' });
        }
        // console.log('VerifyToken: Token decoded successfully'); // Verbose
        req.user = decoded; // Attach user payload (user_id, email, role, etc.)
        next();
    });
};

const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'Administrator') {
        // console.log('IsAdmin: Access granted');
        next();
    } else {
        console.warn('IsAdmin: Access denied - User is not an Administrator');
        res.status(403).json({ message: 'Access denied: Administrator role required' });
    }
};

const isProfessor = (req, res, next) => {
    if (req.user && req.user.role === 'Professor') {
        // console.log('IsProfessor: Access granted');
        next();
    } else {
        console.warn('IsProfessor: Access denied - User is not a Professor');
        res.status(403).json({ message: 'Access denied: Professor role required' });
    }
};

const isStudent = (req, res, next) => {
    if (req.user && req.user.role === 'Student') {
        // console.log('IsStudent: Access granted');
        next();
    } else {
        console.warn('IsStudent: Access denied - User is not a Student');
        res.status(403).json({ message: 'Access denied: Student role required' });
    }
};


// === BASIC ROUTE ===
app.get('/', (req, res) => {
    res.send('NoClash Timetable Conflict Checker API is running!');
});

app.get('/api/branches', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [branches] = await connection.query("SELECT * FROM Branches ORDER BY branch_name");
        res.json(branches);
    } catch (error) {
        console.error("Error fetching branches:", error);
        res.status(500).json({ message: 'Error fetching data from database' });
    } finally {
         if (connection) connection.release();
    }
});


// === AUTHENTICATION ROUTES ===

app.post('/api/register', async (req, res) => {
    const fullName = req.body.fullName ? req.body.fullName.trim() : '';
    const email = req.body.email ? req.body.email.trim() : '';
    const password = req.body.password ? req.body.password : '';
    const role = req.body.role ? req.body.role.trim() : '';
    const branchId = req.body.branchId;
    // Assuming frontend now sends IDs directly after Admin implements structure management
    const divisionId = req.body.divisionId;
    const batchId = req.body.batchId;

    console.log('Registration attempt:', { fullName, email, role, branchId, divisionId, batchId });

    if (!fullName || !email || !password || !role) {
        return res.status(400).json({ message: 'Full name, email, password, and role are required.' });
    }
    if (!['Professor', 'Student'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role specified.' });
    }

    let studentDivisionId = null;
    let studentBatchId = null;
    if (role === 'Student') {
        if (divisionId == null || batchId == null) {
            console.warn("Student registration missing divisionId or batchId.");
            return res.status(400).json({ message: 'Division and Batch are required for student registration.' });
        }
        studentDivisionId = divisionId;
        studentBatchId = batchId;
    }


    let connection;
    try {
        connection = await pool.getConnection();

        const [existingUsers] = await connection.query("SELECT user_id FROM Users WHERE email = ?", [email]);
        if (existingUsers.length > 0) {
            console.warn(`Registration failed: Email ${email} already exists.`);
            return res.status(409).json({ message: 'Email address already in use.' });
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        console.log(`Password hashed for ${email}`);

        const [result] = await connection.query(
            "INSERT INTO Users (full_name, email, password, role, approval_status, division_id, batch_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
                fullName, email, hashedPassword, role, 'Pending',
                studentDivisionId,
                studentBatchId
            ]
        );

        console.log(`User ${email} registered successfully with ID: ${result.insertId}`);
        res.status(201).json({ message: 'Registration successful. Waiting for administrator approval.' });

    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ message: 'Server error during registration' });
    } finally {
        if (connection) connection.release();
    }
});


app.post('/api/login', async (req, res) => {
    const email = req.body.email ? req.body.email.trim() : '';
    const password = req.body.password ? req.body.password : '';

    console.log(`Login attempt for email: ${email}`);

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        // ** Fetch division_id and batch_id needed for JWT payload **
        const [users] = await connection.query(
            `SELECT 
                u.user_id, u.full_name, u.email, u.password, u.role, u.approval_status, 
                u.division_id, u.batch_id  -- Select IDs directly from Users table
             FROM Users u 
             WHERE u.email = ?`,
            [email]
        );

        if (users.length === 0) {
            console.log(`Login failed: No user found for email ${email}`);
             if (connection) connection.release();
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const user = users[0];
        // console.log(`User found: ID ${user.user_id}, Role: ${user.role}, Status: ${user.approval_status}`);

        let isMatch = false;
        try {
             isMatch = await bcrypt.compare(password, user.password); // Compare raw password from body
             // console.log(`Password comparison result (isMatch): ${isMatch}`);
        } catch (compareError) {
             console.error("Error during bcrypt comparison:", compareError);
             if (connection) connection.release();
             return res.status(500).json({ message: 'Server error during password check.' });
        }

        // Release connection AFTER comparison, regardless of match result
        if (connection) connection.release();

        if (!isMatch) {
            console.log(`Login failed: Password mismatch for user ${email}`);
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        if (user.approval_status !== 'Approved') {
            console.log(`Login failed: User ${email} is not approved (status: ${user.approval_status})`);
            return res.status(403).json({ message: 'Account not approved. Please contact administrator.' });
        }

        console.log(`Login successful for user: ${email}`);

        // Construct JWT payload with necessary IDs
        const payload = {
            user_id: user.user_id, email: user.email, role: user.role,
            division_id: user.division_id, // Directly from Users table
            batch_id: user.batch_id      // Directly from Users table
        };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
        // console.log(`Token generated for user: ${email}`);

        res.json({
            message: 'Login successful', token: token,
            user: { // Send user details back to frontend for storage
                user_id: user.user_id, full_name: user.full_name, email: user.email,
                role: user.role,
                // Include IDs if needed by frontend immediately (e.g., student dashboard)
                division_id: user.division_id,
                batch_id: user.batch_id
            }
        });

    } catch (error) {
        console.error('Login Error:', error);
        if (connection) connection.release(); // Ensure release on error too
        res.status(500).json({ message: 'Server error during login' });
    }
});


// === NEW: Change Password Route ===
app.put('/api/user/change-password', verifyToken, async (req, res) => {
    const userId = req.user.user_id; // Get user ID from the verified token
    const { currentPassword, newPassword, confirmPassword } = req.body;

    console.log(`Change password attempt for user ID: ${userId}`);

    // Basic validation
    if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({ message: 'Current password, new password, and confirmation are required.' });
    }
    if (newPassword !== confirmPassword) {
        return res.status(400).json({ message: 'New password and confirmation do not match.' });
    }
    if (newPassword.length < 6) { // Example: Enforce minimum length
        return res.status(400).json({ message: 'New password must be at least 6 characters long.' });
    }
    if (newPassword === currentPassword) {
        return res.status(400).json({ message: 'New password cannot be the same as the current password.' });
    }


    let connection;
    try {
        connection = await pool.getConnection();

        // 1. Get the current stored password hash
        const [users] = await connection.query("SELECT password FROM Users WHERE user_id = ?", [userId]);
        if (users.length === 0) {
            console.warn(`Change password failed: User ID ${userId} not found.`);
            return res.status(404).json({ message: 'User not found.' });
        }
        const storedHash = users[0].password;

        // 2. Compare provided current password with the stored hash
        const isMatch = await bcrypt.compare(currentPassword, storedHash);
        if (!isMatch) {
            console.warn(`Change password failed: Incorrect current password for user ID ${userId}.`);
            return res.status(401).json({ message: 'Incorrect current password.' });
        }

        // 3. Hash the new password
        const saltRounds = 10;
        const newHashedPassword = await bcrypt.hash(newPassword, saltRounds);
        console.log(`New password hashed for user ID ${userId}.`);

        // 4. Update the password in the database
        const [updateResult] = await connection.query(
            "UPDATE Users SET password = ? WHERE user_id = ?",
            [newHashedPassword, userId]
        );

        if (updateResult.affectedRows === 1) {
            console.log(`Password updated successfully for user ID ${userId}.`);
            res.json({ message: 'Password updated successfully.' });
        } else {
            // This case should ideally not happen if the user was found earlier
            console.error(`Change password failed: Update query affected 0 rows for user ID ${userId}.`);
            throw new Error('Failed to update password in database.');
        }

    } catch (error) {
        console.error(`Error changing password for user ${userId}:`, error);
        res.status(500).json({ message: 'Server error changing password.' });
    } finally {
        if (connection) connection.release();
    }
});


// === ADMIN ROUTES ===

app.get('/api/pending-users', verifyToken, isAdmin, async (req, res) => {
    // console.log('Admin request received for /pending-users');
    let connection;
    try {
        connection = await pool.getConnection();
        const [pendingUsers] = await connection.query(`
            SELECT
                u.user_id, u.full_name, u.email, u.role, u.approval_status,
                b.batch_name, d.division_name, br.branch_code
            FROM Users u
            LEFT JOIN Batches b ON u.batch_id = b.batch_id
            LEFT JOIN Divisions d ON u.division_id = d.division_id
            LEFT JOIN Branches br ON d.branch_id = br.branch_id
            WHERE u.approval_status = 'Pending'
        `);
        // console.log(`Found ${pendingUsers.length} pending users`);
        res.json(pendingUsers);
    } catch (error) {
        console.error('Error fetching pending users:', error);
        res.status(500).json({ message: 'Server error fetching pending users' });
    } finally {
        if (connection) connection.release();
    }
});


app.put('/api/approve-user/:userId', verifyToken, isAdmin, async (req, res) => {
    const { userId } = req.params;
    console.log(`Admin request received to approve user ID: ${userId}`);

    if (!userId || isNaN(parseInt(userId))) {
        return res.status(400).json({ message: 'Invalid User ID provided.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const [result] = await connection.query(
            "UPDATE Users SET approval_status = 'Approved' WHERE user_id = ? AND approval_status = 'Pending'",
            [userId]
        );

        if (result.affectedRows === 1 && result.changedRows === 1) {
             console.log(`User ID ${userId} approved successfully.`);
             res.json({ message: 'User approved successfully.' });
        } else if (result.affectedRows === 1 && result.changedRows === 0) {
             console.log(`User ID ${userId} was already approved or status unchanged.`);
             res.status(200).json({ message: 'User status was not pending or already approved.' });
        } else {
             console.warn(`Approval failed: User ID ${userId} not found or not in pending state.`);
             res.status(404).json({ message: 'User not found or not pending approval.' });
        }
    } catch (error) {
        console.error(`Error approving user ${userId}:`, error);
        res.status(500).json({ message: 'Server error approving user.' });
    } finally {
         if (connection) connection.release();
    }
});

// --- ** Get All Users Route ** ---
app.get('/api/admin/users', verifyToken, isAdmin, async (req, res) => {
    console.log('Admin request received for /admin/users');
    let connection;
    try {
        connection = await pool.getConnection();
        const [allUsers] = await connection.query(`
            SELECT
                u.user_id, u.full_name, u.email, u.role, u.approval_status,
                u.division_id, u.batch_id, -- Return IDs
                b.batch_name, d.division_name, br.branch_code
            FROM Users u
            LEFT JOIN Batches b ON u.batch_id = b.batch_id
            LEFT JOIN Divisions d ON u.division_id = d.division_id
            LEFT JOIN Branches br ON d.branch_id = br.branch_id
            ORDER BY u.role, u.full_name
        `);
        console.log(`Found ${allUsers.length} total users`);
        res.json(allUsers);
    } catch (error) {
        console.error('Error fetching all users:', error);
        res.status(500).json({ message: 'Server error fetching all users' });
    } finally {
        if (connection) connection.release();
    }
});

// --- ** Admin Resource Management (Classrooms) ** ---

// GET All Classrooms
app.get('/api/admin/classrooms', verifyToken, isAdmin, async (req, res) => {
    // console.log('Admin request received for /api/admin/classrooms');
    let connection;
    try {
        connection = await pool.getConnection();
        const [classrooms] = await connection.query("SELECT * FROM Classrooms ORDER BY building, room_number");
        res.json(classrooms);
    } catch (error) {
        console.error('Error fetching classrooms:', error);
        res.status(500).json({ message: 'Server error fetching classrooms' });
    } finally {
        if (connection) connection.release();
    }
});

// POST (Create) New Classroom
app.post('/api/admin/classrooms', verifyToken, isAdmin, async (req, res) => {
    const { room_number, building, floor, capacity, type } = req.body;
    console.log('Admin request to CREATE classroom:', req.body);

    if (!room_number || !building || !floor || !type) {
        return res.status(400).json({ message: 'Room number, building, floor, and type are required.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const [result] = await connection.query(
            "INSERT INTO Classrooms (room_number, building, floor, capacity, type) VALUES (?, ?, ?, ?, ?)",
            [room_number, building, floor, capacity || 0, type]
        );
        res.status(201).json({ message: 'Classroom created successfully', classroom_id: result.insertId });
    } catch (error) {
        console.error('Error creating classroom:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'A classroom with this room number already exists.' });
        }
        res.status(500).json({ message: 'Server error creating classroom' });
    } finally {
        if (connection) connection.release();
    }
});

// PUT (Update) Classroom
app.put('/api/admin/classrooms/:id', verifyToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { room_number, building, floor, capacity, type } = req.body;
    console.log(`Admin request to UPDATE classroom ID ${id}:`, req.body);

    if (!room_number || !building || !floor || !type) {
        return res.status(400).json({ message: 'Room number, building, floor, and type are required.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const [result] = await connection.query(
            "UPDATE Classrooms SET room_number = ?, building = ?, floor = ?, capacity = ?, type = ? WHERE classroom_id = ?",
            [room_number, building, floor, capacity || 0, type, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Classroom not found.' });
        }
        res.json({ message: 'Classroom updated successfully.' });
    } catch (error) {
        console.error(`Error updating classroom ${id}:`, error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'A classroom with this room number already exists.' });
        }
        res.status(500).json({ message: 'Server error updating classroom' });
    } finally {
        if (connection) connection.release();
    }
});

// DELETE Classroom
app.delete('/api/admin/classrooms/:id', verifyToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    console.log(`Admin request to DELETE classroom ID ${id}`);

    let connection;
    try {
        connection = await pool.getConnection();
        const [result] = await connection.query("DELETE FROM Classrooms WHERE classroom_id = ?", [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Classroom not found.' });
        }
        res.json({ message: 'Classroom deleted successfully.' });
    } catch (error) {
        console.error(`Error deleting classroom ${id}:`, error);
        if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.errno === 1451) {
            return res.status(409).json({ message: 'Cannot delete classroom: It is currently assigned in the schedule.' });
        }
        res.status(500).json({ message: 'Server error deleting classroom' });
    } finally {
        if (connection) connection.release();
    }
});

// --- ** Admin Resource Management (Courses) ** ---

// GET All Courses
app.get('/api/admin/courses', verifyToken, isAdmin, async (req, res) => {
    // console.log('Admin request received for /api/admin/courses');
    let connection;
    try {
        connection = await pool.getConnection();
        const [courses] = await connection.query(`
            SELECT c.*, b.branch_code 
            FROM Courses c
            LEFT JOIN Branches b ON c.branch_id = b.branch_id
            ORDER BY c.course_code
        `);
        res.json(courses);
    } catch (error) {
        console.error('Error fetching courses:', error);
        res.status(500).json({ message: 'Server error fetching courses' });
    } finally {
        if (connection) connection.release();
    }
});

// POST (Create) New Course
app.post('/api/admin/courses', verifyToken, isAdmin, async (req, res) => {
    const { course_code, course_name, branch_id, credits, type } = req.body;
    console.log('Admin request to CREATE course:', req.body);

    if (!course_code || !course_name || !branch_id || !credits || !type) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const [result] = await connection.query(
            "INSERT INTO Courses (course_code, course_name, branch_id, credits, type) VALUES (?, ?, ?, ?, ?)",
            [course_code, course_name, branch_id, credits, type]
        );
        res.status(201).json({ message: 'Course created successfully', course_id: result.insertId });
    } catch (error) {
        console.error('Error creating course:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'A course with this code already exists.' });
        }
        if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.errno === 1452) {
             return res.status(400).json({ message: 'Invalid Branch ID provided.' });
        }
        res.status(500).json({ message: 'Server error creating course' });
    } finally {
        if (connection) connection.release();
    }
});

// PUT (Update) Course
app.put('/api/admin/courses/:id', verifyToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { course_code, course_name, branch_id, credits, type } = req.body;
    console.log(`Admin request to UPDATE course ID ${id}:`, req.body);

    if (!course_code || !course_name || !branch_id || !credits || !type) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const [result] = await connection.query(
            "UPDATE Courses SET course_code = ?, course_name = ?, branch_id = ?, credits = ?, type = ? WHERE course_id = ?",
            [course_code, course_name, branch_id, credits, type, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Course not found.' });
        }
        res.json({ message: 'Course updated successfully.' });
    } catch (error) {
        console.error(`Error updating course ${id}:`, error);
         if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'A course with this code already exists.' });
        }
        if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.errno === 1452) {
             return res.status(400).json({ message: 'Invalid Branch ID provided.' });
        }
        res.status(500).json({ message: 'Server error updating course' });
    } finally {
        if (connection) connection.release();
    }
});

// DELETE Course
app.delete('/api/admin/courses/:id', verifyToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    console.log(`Admin request to DELETE course ID ${id}`);

    let connection;
    try {
        connection = await pool.getConnection();
        const [result] = await connection.query("DELETE FROM Courses WHERE course_id = ?", [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Course not found.' });
        }
        res.json({ message: 'Course deleted successfully.' });
    } catch (error) {
        console.error(`Error deleting course ${id}:`, error);
        if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.errno === 1451) {
            return res.status(409).json({ message: 'Cannot delete course: It is currently assigned in the schedule.' });
        }
        res.status(500).json({ message: 'Server error deleting course' });
    } finally {
        if (connection) connection.release();
    }
});

// --- ** Get All Academic Structure Routes ** ---

// Helper function to get all structure data
const getFullAcademicStructure = async (connection) => {
    const [branches] = await connection.query("SELECT * FROM Branches ORDER BY branch_code");
    const [divisions] = await connection.query(`
        SELECT d.*, b.branch_code 
        FROM Divisions d
        JOIN Branches b ON d.branch_id = b.branch_id
        ORDER BY b.branch_code, d.division_name
    `);
    const [batches] = await connection.query(`
        SELECT ba.*, d.division_name, br.branch_code
        FROM Batches ba
        JOIN Divisions d ON ba.division_id = d.division_id
        JOIN Branches br ON d.branch_id = br.branch_id
        ORDER BY br.branch_code, d.division_name, ba.batch_name
    `);

    // Nest the data for easier frontend consumption
    const structure = branches.map(branch => ({
        ...branch,
        divisions: divisions
            .filter(div => div.branch_id === branch.branch_id)
            .map(div => ({
                ...div,
                batches: batches.filter(batch => batch.division_id === div.division_id)
            }))
    }));
    return structure;
};

// Get Full Academic Structure
app.get('/api/admin/structure', verifyToken, isAdmin, async (req, res) => {
    console.log('Admin request received for /api/admin/structure');
    let connection;
    try {
        connection = await pool.getConnection();
        const structure = await getFullAcademicStructure(connection);
        // console.log(`Found ${structure.length} branches with nested data.`);
        res.json(structure);
    } catch (error) {
        console.error('Error fetching full academic structure:', error);
        res.status(500).json({ message: 'Server error fetching academic structure' });
    } finally {
        if (connection) connection.release();
    }
});


// --- Admin User Management Routes ---
app.delete('/api/admin/users/:userId', verifyToken, isAdmin, async (req, res) => {
     const { userId } = req.params;
     console.log(`Admin request received to DELETE user ID: ${userId}`);
     if (parseInt(userId) === 1) { // Basic check for primary admin
         return res.status(403).json({ message: 'Cannot delete the primary administrator account.' });
     }
    let connection;
     try {
         connection = await pool.getConnection();
         // TODO: Consider implications if user is scheduled for classes
         const [result] = await connection.query("DELETE FROM Users WHERE user_id = ?", [userId]);

         if (result.affectedRows === 1) {
             console.log(`User ID ${userId} deleted successfully.`);
             res.json({ message: 'User deleted successfully.' });
         } else {
             console.warn(`Deletion failed: User ID ${userId} not found.`);
             res.status(404).json({ message: 'User not found.' });
         }
     } catch (error) {
         console.error(`Error deleting user ${userId}:`, error);
         if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.errno === 1451) {
             return res.status(409).json({ message: 'Cannot delete user: They might be assigned to scheduled classes or other records.' });
         }
         res.status(500).json({ message: 'Server error deleting user.' });
     } finally {
         if (connection) connection.release();
     }
 });

app.put('/api/admin/users/:userId', verifyToken, isAdmin, async (req, res) => {
     const { userId } = req.params;
     const { full_name, email, role, approval_status, division_id, batch_id } = req.body; // Include status, division, batch
     console.log(`Admin request received to UPDATE user ID: ${userId} with data:`, req.body);

     if (!full_name || !email || !role || !approval_status) {
         return res.status(400).json({ message: 'Full name, email, role, and approval status are required.' });
     }
     if (!['Pending', 'Approved', 'Rejected'].includes(approval_status)) {
         return res.status(400).json({ message: 'Invalid approval status.' });
     }
     if (role === 'Student' && (division_id == null || batch_id == null)) {
         return res.status(400).json({ message: 'Division and Batch IDs are required for students.' });
     }
     if (parseInt(userId) === 1 && role !== 'Administrator') { // Prevent changing primary admin role
        return res.status(403).json({ message: 'Cannot change the role of the primary administrator.' });
     }

     let connection;
     try {
         connection = await pool.getConnection();
         // Update user details including status, division, and batch
         // Set division/batch to NULL if role is not Student
         const [result] = await connection.query(
             `UPDATE Users SET 
                 full_name = ?, 
                 email = ?, 
                 role = ?, 
                 approval_status = ?, 
                 division_id = ?, 
                 batch_id = ? 
              WHERE user_id = ?`,
             [
                 full_name, email, role, approval_status,
                 role === 'Student' ? division_id : null,
                 role === 'Student' ? batch_id : null,
                 userId
             ]
         );

         if (result.affectedRows === 0) {
              console.warn(`Update failed: User ID ${userId} not found.`);
             return res.status(404).json({ message: 'User not found.' });
         }
         // changedRows might be 0 if data submitted is identical to existing data
         console.log(`User ID ${userId} updated successfully (changedRows: ${result.changedRows}).`);
         res.json({ message: 'User details updated successfully.' });

     } catch (error) {
         console.error(`Error updating user ${userId}:`, error);
          if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: `Update failed: Email '${email}' might already be in use.` });
        }
         res.status(500).json({ message: 'Server error updating user.' });
     } finally {
         if (connection) connection.release();
     }
});

// Temporary Hashing Route (Remove or secure properly for production)
// app.post('/api/admin/generate-hash', verifyToken, isAdmin, async (req, res) => { ... });


// === PROFESSOR DASHBOARD ROUTES ===

// GET Courses (for Professor dropdown)
app.get('/api/professor/courses', verifyToken, isProfessor, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [courses] = await connection.query(`
            SELECT course_id, course_code, course_name, type 
            FROM Courses 
            ORDER BY course_code
        `);
        res.json(courses);
    } catch (error) {
        console.error('Error fetching courses for professor:', error);
        res.status(500).json({ message: 'Server error fetching courses' });
    } finally {
        if (connection) connection.release();
    }
});

// GET Classrooms (for Professor dropdown)
app.get('/api/professor/classrooms', verifyToken, isProfessor, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [classrooms] = await connection.query(`
            SELECT classroom_id, room_number, building, type 
            FROM Classrooms 
            ORDER BY building, room_number
        `);
        res.json(classrooms);
    } catch (error) {
        console.error('Error fetching classrooms for professor:', error);
        res.status(500).json({ message: 'Server error fetching classrooms' });
    } finally {
        if (connection) connection.release();
    }
});

// GET Academic Structure (Batches) (for Professor dropdown)
app.get('/api/professor/batches', verifyToken, isProfessor, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const structure = await getFullAcademicStructure(connection); // Use helper
        res.json(structure);
    } catch (error) {
        console.error('Error fetching academic structure for professor:', error);
        res.status(500).json({ message: 'Server error fetching academic structure' });
    } finally {
        if (connection) connection.release();
    }
});


// === PROFESSOR SCHEDULE ROUTES ===

// GET Professor's Schedule
app.get('/api/professor/my-schedule', verifyToken, isProfessor, async (req, res) => {
    const professor_id = req.user.user_id;
    let connection;
    try {
        connection = await pool.getConnection();
        const [scheduleEvents] = await connection.query(`
            SELECT 
                s.schedule_id, 
                s.class_type, 
                s.day_of_week, 
                s.class_date,
                DATE_FORMAT(s.start_time, '%Y-%m-%d %H:%i:%s') as start_time,
                DATE_FORMAT(s.end_time, '%Y-%m-%d %H:%i:%s') as end_time,
                c.course_code, 
                c.course_name,
                cr.room_number,
                -- Provide full batch details for professor's view
                CONCAT(br.branch_code, '-', d.division_name, '-', b.batch_name) AS batch_details 
            FROM Schedule s
            LEFT JOIN Courses c ON s.course_id = c.course_id
            LEFT JOIN Classrooms cr ON s.classroom_id = cr.classroom_id
            LEFT JOIN Batches b ON s.batch_id = b.batch_id
            LEFT JOIN Divisions d ON b.division_id = d.division_id
            LEFT JOIN Branches br ON d.branch_id = br.branch_id
            WHERE s.professor_id = ?
            ORDER BY start_time, s.class_date; -- Use alias and date for correct sorting
        `, [professor_id]);

        res.json(scheduleEvents);

    } catch (error) {
        console.error(`Error fetching schedule for professor ${professor_id}:`, error);
        res.status(500).json({ message: 'Server error fetching schedule' });
    } finally {
        if (connection) connection.release();
    }
});

// POST Book Extra Class
app.post('/api/book-extra-class', verifyToken, isProfessor, async (req, res) => {
    const professor_id = req.user.user_id;
    const { course_id, batch_id, classroom_id, class_date, start_time, end_time } = req.body;
    console.log(`Professor ${professor_id} attempting to book extra class:`, req.body);

    // --- Input Validation ---
    if (course_id == null || batch_id == null || classroom_id == null || !class_date || !start_time || !end_time) {
        return res.status(400).json({ message: 'Missing required fields (Course, Batch, Classroom, Date, Times).' });
    }
    const timeRegex = /^\d{2}:\d{2}(:\d{2})?$/; // HH:MM or HH:MM:SS
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;   // YYYY-MM-DD
    if (!dateRegex.test(class_date) || !timeRegex.test(start_time) || !timeRegex.test(end_time)) {
         return res.status(400).json({ message: 'Invalid date (YYYY-MM-DD) or time (HH:MM) format.' });
    }
    if (start_time >= end_time) {
         return res.status(400).json({ message: 'Start time must be before end time.' });
    }
    // Check if date is in the past (optional but recommended)
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to beginning of today
    const selectedDate = new Date(class_date + 'T00:00:00Z'); // Treat date as UTC start of day
    if (isNaN(selectedDate) || selectedDate < today) {
        return res.status(400).json({ message: 'Cannot schedule classes for past dates.' });
    }

    // Combine date and time into full DATETIME strings for DB
    const fullStartTime = `${class_date} ${start_time.length === 5 ? start_time + ':00' : start_time}`; // Ensure seconds
    const fullEndTime = `${class_date} ${end_time.length === 5 ? end_time + ':00' : end_time}`;     // Ensure seconds

    // Determine day of the week based on the provided date
    let dayOfWeek;
    try {
        // Use UTC date object to avoid local timezone shifts when getting day name
        const dateObj = new Date(class_date + 'T00:00:00Z');
        if (isNaN(dateObj)) throw new Error('Invalid date');
        // Get day name based on UTC date
        dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
    } catch (dateError) {
        console.error("Invalid date format provided for dayOfWeek calculation:", class_date, dateError);
        return res.status(400).json({ message: 'Invalid date format (YYYY-MM-DD).' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction(); // Start transaction for reliable conflict check

        // --- Conflict Check Query ---
        // Checks for overlaps with BOTH Base and Extra classes involving the
        // requested classroom, professor, OR batch during the specified time.
        const conflictQuery = `
          SELECT 
              s.schedule_id, 
              s.class_type, 
              s.day_of_week, 
              s.class_date,
              DATE_FORMAT(s.start_time, '%H:%i') as existing_start,
              DATE_FORMAT(s.end_time, '%H:%i') as existing_end,
              -- Identify which entity caused the conflict
              CASE
                  WHEN s.classroom_id = ? THEN 'Classroom' 
                  WHEN s.professor_id = ? THEN 'Professor' 
                  WHEN s.batch_id = ? THEN 'Batch' 
                  ELSE 'Unknown Conflict' 
              END AS conflict_entity,
              -- Get details about the conflicting entity
              CASE
                  WHEN s.classroom_id = ? THEN COALESCE((SELECT cr.room_number FROM Classrooms cr WHERE cr.classroom_id = s.classroom_id), 'N/A')
                  WHEN s.professor_id = ? THEN COALESCE((SELECT u.full_name FROM Users u WHERE u.user_id = s.professor_id), 'N/A')
                  WHEN s.batch_id = ? THEN COALESCE((
                      SELECT CONCAT(br.branch_code,'-',d.division_name,'-',b.batch_name) 
                      FROM Batches b 
                      JOIN Divisions d ON b.division_id=d.division_id 
                      JOIN Branches br ON d.branch_id=br.branch_id 
                      WHERE b.batch_id = s.batch_id
                  ), 'N/A')
                  ELSE 'Details unavailable'
              END AS conflict_details
          FROM Schedule s 
          WHERE 
              -- Check for time overlap: (ExistingStart < NewEnd) AND (ExistingEnd > NewStart)
              (s.start_time < ? AND s.end_time > ?) 
              AND (
                  -- Conflict condition 1: Another Extra class on the SAME DATE involving room, prof, or batch
                  (s.class_type = 'Extra' AND s.class_date = ? AND (s.classroom_id = ? OR s.professor_id = ? OR s.batch_id = ?)) 
                  OR
                  -- Conflict condition 2: A Base class on the SAME DAY OF WEEK involving room, prof, or batch
                  (s.class_type = 'Base' AND s.day_of_week = ? AND (s.classroom_id = ? OR s.professor_id = ? OR s.batch_id = ?))
              )
          LIMIT 1 
          FOR UPDATE; -- Lock the conflicting row(s) to prevent race conditions
        `;
        const conflictParams = [
            classroom_id, professor_id, batch_id, // For CASE conflict_entity
            classroom_id, professor_id, batch_id, // For CASE conflict_details
            fullEndTime, fullStartTime,           // Time overlap check
            class_date, classroom_id, professor_id, batch_id, // Extra class conflict check
            dayOfWeek, classroom_id, professor_id, batch_id   // Base class conflict check
        ];

        const [conflicts] = await connection.query(conflictQuery, conflictParams);

        if (conflicts.length > 0) {
            await connection.rollback(); // Conflict found, rollback transaction
            const conflict = conflicts[0];
            const reason = `Conflict: ${conflict.conflict_entity} (${conflict.conflict_details}) is already booked for a ${conflict.class_type} class (${conflict.day_of_week || conflict.class_date} ${conflict.existing_start}-${conflict.existing_end}).`;
            console.warn(`Booking conflict detected for professor ${professor_id}: ${reason}`);
            return res.status(409).json({ message: reason });
        }

        // --- No Conflicts Found: Insert the New Class ---
        console.log(`No conflicts found for professor ${professor_id}. Proceeding to book.`);
        const insertQuery = `
            INSERT INTO Schedule 
                (course_id, professor_id, batch_id, classroom_id, day_of_week, start_time, end_time, class_type, class_date) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const insertParams = [
            course_id, professor_id, batch_id, classroom_id,
            dayOfWeek, // Store the calculated day name
            fullStartTime, fullEndTime,
            'Extra', class_date
        ];
        const [insertResult] = await connection.query(insertQuery, insertParams);

        if (insertResult.affectedRows === 1) {
            await connection.commit(); // Success, commit transaction
            console.log(`Extra class booked successfully for professor ${professor_id}, schedule ID: ${insertResult.insertId}`);
            res.status(201).json({ message: 'Extra class booked successfully!', scheduleId: insertResult.insertId });
        } else {
            // Should not happen if query is correct, but good to handle
            await connection.rollback();
            console.error(`Booking failed unexpectedly for professor ${professor_id}. Insert affected 0 rows.`);
            throw new Error('Failed to insert extra class schedule.');
        }

    } catch (error) {
        if (connection) await connection.rollback(); // Rollback on any error during the process
        console.error(`Error booking extra class for professor ${professor_id}:`, error);
        // Handle specific foreign key errors if needed
        if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.errno === 1452) {
             return res.status(400).json({ message: 'Invalid Course, Batch, or Classroom ID provided. Please ensure they exist.' });
        }
        res.status(500).json({ message: 'Server error during booking process.' });
    } finally {
        if (connection) connection.release(); // Always release connection
    }
});


// === STUDENT ROUTES ===

// GET Student's Schedule
app.get('/api/student/my-schedule', verifyToken, isStudent, async (req, res) => {
    const studentUserId = req.user.user_id;
    const studentBatchId = req.user.batch_id;
    const studentDivisionId = req.user.division_id;

    console.log(`Fetching schedule using UNION for student ID: ${studentUserId}, Batch ID: ${studentBatchId}, Division ID: ${studentDivisionId}`);

    if (!studentBatchId || !studentDivisionId) {
        console.error(`Student ${studentUserId} is missing batch_id or division_id in token.`);
        return res.status(400).json({ message: 'User data is missing batch or division information.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();

        // Return classes for the student's batch AND include Extra classes for any batch in the student's division.
        // This ensures division-level Extra classes (created for other batches in the same division)
        // are visible to the student.
        const query = `
            SELECT 
                s.schedule_id, s.class_type, s.day_of_week, s.class_date,
                DATE_FORMAT(s.start_time, '%Y-%m-%d %H:%i:%s') as start_time_alias,
                DATE_FORMAT(s.end_time, '%Y-%m-%d %H:%i:%s') as end_time_alias,
                COALESCE(c.course_name, 'Unknown Course') as course_name,
                COALESCE(c.course_code, 'N/A') as course_code,
                c.type as course_type,
                COALESCE(u_prof.full_name, 'Unknown Professor') AS professor_name,
                COALESCE(cr.room_number, 'N/A') as room_number,
                COALESCE(b.batch_name, 'N/A') as batch_name,
                COALESCE(d.division_name, 'N/A') as division_name
            FROM Schedule s
            LEFT JOIN Batches b ON s.batch_id = b.batch_id
            LEFT JOIN Divisions d ON b.division_id = d.division_id
            LEFT JOIN Courses c ON s.course_id = c.course_id
            LEFT JOIN Users u_prof ON s.professor_id = u_prof.user_id
            LEFT JOIN Classrooms cr ON s.classroom_id = cr.classroom_id
            WHERE (
                s.batch_id = ?
            ) OR (
                s.class_type = 'Extra' AND d.division_id = ?
            )
            ORDER BY start_time_alias, class_date;
        `;

        const params = [studentBatchId, studentDivisionId];

        const [schedule] = await connection.query(query, params);

        console.log(`Found ${schedule.length} schedule events for student (Batch: ${studentBatchId}, Division: ${studentDivisionId}).`);

        // Rename alias back to start_time/end_time for frontend compatibility
        const finalSchedule = schedule.map(item => ({
            ...item,
            start_time: item.start_time_alias,
            end_time: item.end_time_alias,
            // Optionally remove aliases if frontend doesn't use them
            // start_time_alias: undefined,
            // end_time_alias: undefined
        }));

        res.json(finalSchedule);

    } catch (error) {
        console.error(`Error fetching schedule for student batch ${studentBatchId}:`, error); 
        res.status(500).json({ message: 'Server error fetching student schedule.' });
    } finally {
        if (connection) connection.release();
    }
});


// GET Student's Details
app.get('/api/student/my-details', verifyToken, isStudent, async (req, res) => {
    const student_id = req.user.user_id;
    console.log(`Fetching profile details for student ID: ${student_id}`);

    if (!student_id) {
         return res.status(400).json({ message: 'User data is missing ID.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const [details] = await connection.query(`
            SELECT 
                u.full_name, u.email,
                b.batch_name,
                d.division_name,
                br.branch_name, br.branch_code
            FROM Users u
            LEFT JOIN Batches b ON u.batch_id = b.batch_id
            LEFT JOIN Divisions d ON u.division_id = d.division_id
            LEFT JOIN Branches br ON d.branch_id = br.branch_id
            WHERE u.user_id = ? AND u.role = 'Student'
        `, [student_id]);

        if (details.length === 0) {
            return res.status(404).json({ message: 'Student details not found.' });
        }

        res.json(details[0]);

    } catch (error) {
        console.error(`Error fetching details for student ${student_id}:`, error);
        res.status(500).json({ message: 'Server error fetching student details.' });
    } finally {
        if (connection) connection.release();
    }
});


// === SCHEDULED JOB FOR CLEANUP (REMOVED) ===
console.log('Scheduled cleanup job removed as calendar layout is date-specific.');


// === START SERVER ===
app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});

