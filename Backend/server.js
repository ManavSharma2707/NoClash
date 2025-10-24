import express from 'express';
import mysql from 'mysql2/promise'; // Use promise version for async/await
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs'; // For password hashing
import jwt from 'jsonwebtoken'; // For JWTs
import cron from 'node-cron'; // For scheduled jobs
import { URL } from 'url'; // Built-in Node.js URL module

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 4000; // Use port from env or default to 4000

// === MIDDLEWARE ===
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // Middleware to parse JSON bodies

// === DATABASE CONNECTION POOL ===
let pool;
try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        throw new Error("DATABASE_URL environment variable is not set.");
    }
    const parsedUrl = new URL(dbUrl);
    const dbConfig = {
        host: parsedUrl.hostname,
        port: parsedUrl.port || 3306,
        user: parsedUrl.username,
        password: parsedUrl.password,
        database: parsedUrl.pathname.slice(1), // Remove leading '/'
        connectionLimit: 10,
        dateStrings: true, // Return DATE/DATETIME types as strings
    };

    // Explicitly configure SSL based on sslmode parameter
    const sslMode = parsedUrl.searchParams.get('sslmode');
    if (sslMode && sslMode.toUpperCase() !== 'DISABLED' && sslMode.toUpperCase() !== 'NONE') {
        dbConfig.ssl = {
            rejectUnauthorized: true
        };
        console.log("SSL configuration enabled for database connection.");
    } else {
        console.log("SSL configuration disabled or not specified for database connection.");
    }


    pool = mysql.createPool(dbConfig);
    console.log("Database connection pool created successfully.");

    // Test the connection immediately
    pool.getConnection()
        .then(connection => {
            console.log('Successfully connected to the database!');
            connection.release();
        })
        .catch(err => {
            console.error('Error getting initial database connection:', err);
        });

} catch (error) {
    console.error("Error creating database connection pool:", error.message);
    process.exit(1); // Exit if pool creation fails
}

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
        console.log('VerifyToken: Token decoded successfully'); // Removed decoded for brevity
        req.user = decoded;
        next();
    });
};

const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'Administrator') {
        console.log('IsAdmin: Access granted');
        next();
    } else {
        console.warn('IsAdmin: Access denied - User is not an Administrator');
        res.status(403).json({ message: 'Access denied: Administrator role required' });
    }
};

const isProfessor = (req, res, next) => {
    if (req.user && req.user.role === 'Professor') {
        console.log('IsProfessor: Access granted');
        next();
    } else {
        console.warn('IsProfessor: Access denied - User is not a Professor');
        res.status(403).json({ message: 'Access denied: Professor role required' });
    }
};

const isStudent = (req, res, next) => {
    if (req.user && req.user.role === 'Student') {
        console.log('IsStudent: Access granted');
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
    const divisionId = req.body.divisionId; // Frontend currently sends string like "1-A" needs adjustment
    const batchId = req.body.batchId; // Frontend currently sends string like "1-A-B1" needs adjustment

    console.log('Registration attempt:', { fullName, email, role, branchId, divisionId, batchId });

    if (!fullName || !email || !password || !role) {
        return res.status(400).json({ message: 'Full name, email, password, and role are required.' });
    }
    if (!['Professor', 'Student'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role specified.' });
    }

    // --- TODO: Backend needs to parse/lookup actual division_id and batch_id ---
    // For now, setting them to NULL as the frontend sends mock strings
    let actualDivisionId = null;
    let actualBatchId = null;
    if (role === 'Student') {
        console.warn("Student registration received mock division/batch IDs. Storing NULL. Implement ID lookup.");
        // Example (needs proper implementation):
        // actualDivisionId = await findDivisionId(branchId, divisionIdString);
        // actualBatchId = await findBatchId(actualDivisionId, batchIdString);
        if (branchId == null /* || actualDivisionId == null || actualBatchId == null */ ) {
             // Re-enable checks once ID lookup is done
            return res.status(400).json({ message: 'Branch, Division, and Batch are required for student registration (or could not be found).' });
        }
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
                actualDivisionId, // Use looked-up ID
                actualBatchId   // Use looked-up ID
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
        const [users] = await connection.query(
            "SELECT user_id, full_name, email, password, role, approval_status, division_id, batch_id FROM Users WHERE email = ?",
            [email]
        );

        if (users.length === 0) {
            console.log(`Login failed: No user found for email ${email}`);
             if (connection) connection.release();
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const user = users[0];
        console.log(`User found: ID ${user.user_id}, Role: ${user.role}, Status: ${user.approval_status}`);
        console.log(`Stored password hash: ${user.password}`);
        console.log(`Password provided by user (raw): ${req.body.password}`); // Log raw one

        let isMatch = false;
        try {
             isMatch = await bcrypt.compare(password, user.password); // Compare raw password from body
             console.log(`Password comparison result (isMatch): ${isMatch}`);
        } catch (compareError) {
             console.error("Error during bcrypt comparison:", compareError);
             if (connection) connection.release();
             return res.status(500).json({ message: 'Server error during password check.' });
        }

        if (connection) connection.release(); // Release connection AFTER comparison

        if (!isMatch) {
            console.log(`Login failed: Password mismatch for user ${email}`);
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        if (user.approval_status !== 'Approved') {
            console.log(`Login failed: User ${email} is not approved (status: ${user.approval_status})`);
            return res.status(403).json({ message: 'Account not approved. Please contact administrator.' });
        }

        console.log(`Login successful for user: ${email}`);

        const payload = {
            user_id: user.user_id, email: user.email, role: user.role,
            division_id: user.division_id, batch_id: user.batch_id
        };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
        console.log(`Token generated for user: ${email}`);

        res.json({
            message: 'Login successful', token: token,
            user: {
                user_id: user.user_id, full_name: user.full_name, email: user.email,
                role: user.role, division_id: user.division_id, batch_id: user.batch_id
            }
        });

    } catch (error) {
        console.error('Login Error:', error);
        if (connection) connection.release();
        res.status(500).json({ message: 'Server error during login' });
    }
});


// === ADMIN ROUTES ===

app.get('/api/pending-users', verifyToken, isAdmin, async (req, res) => {
    console.log('Admin request received for /pending-users');
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
        console.log(`Found ${pendingUsers.length} pending users`);
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

// --- ** NEW: Get All Users Route ** ---
// Protected: Only Admin
app.get('/api/admin/users', verifyToken, isAdmin, async (req, res) => {
    console.log('Admin request received for /admin/users');
    // Basic implementation without search/pagination for now
    let connection;
    try {
        connection = await pool.getConnection();
        // Fetch all users, joining with related tables for student details
        // Exclude password hash from the result
        const [allUsers] = await connection.query(`
            SELECT
                u.user_id, u.full_name, u.email, u.role, u.approval_status,
                u.division_id, u.batch_id, -- Return IDs
                b.batch_name, d.division_name, br.branch_code
            FROM Users u
            LEFT JOIN Batches b ON u.batch_id = b.batch_id
            LEFT JOIN Divisions d ON u.division_id = d.division_id
            LEFT JOIN Branches br ON d.branch_id = br.branch_id
            ORDER BY u.role, u.full_name -- Example ordering
        `);
        console.log(`Found ${allUsers.length} total users`);
        res.json(allUsers); // Send the full list back
    } catch (error) {
        console.error('Error fetching all users:', error);
        res.status(500).json({ message: 'Server error fetching all users' });
    } finally {
        if (connection) connection.release();
    }
});
// --- ** NEW: Admin Resource Management (Classrooms) ** ---

// GET All Classrooms
app.get('/api/admin/classrooms', verifyToken, isAdmin, async (req, res) => {
    console.log('Admin request received for /api/admin/classrooms');
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

// --- ** NEW: Admin Resource Management (Courses) ** ---

// GET All Courses
app.get('/api/admin/courses', verifyToken, isAdmin, async (req, res) => {
    console.log('Admin request received for /api/admin/courses');
    let connection;
    try {
        connection = await pool.getConnection();
        // Join with Branches to get branch_code, as needed by the frontend
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

// --- ** NEW: Get All Academic Structure Routes ** ---

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
// Protected: Only Admin
app.get('/api/admin/structure', verifyToken, isAdmin, async (req, res) => { // <-- ADDED /api BACK
    console.log('Admin request received for /api/admin/structure'); // Updated log
    let connection;
    try {
        connection = await pool.getConnection();
        const structure = await getFullAcademicStructure(connection);
        console.log(`Found ${structure.length} branches with nested data.`);
        res.json(structure);
    } catch (error) {
        console.error('Error fetching full academic structure:', error);
        res.status(500).json({ message: 'Server error fetching academic structure' });
    } finally {
        if (connection) connection.release();
    }
});




// --- TODO: Add Admin routes for Reject/Delete User, Update User ---
// Placeholder for DELETE User
app.delete('/api/admin/users/:userId', verifyToken, isAdmin, async (req, res) => {
     const { userId } = req.params;
     console.log(`Admin request received to DELETE user ID: ${userId}`);
     // Prevent deleting the main admin (e.g., user_id 1)
     if (parseInt(userId) === 1) {
         return res.status(403).json({ message: 'Cannot delete the primary administrator account.' });
     }
    let connection;
     try {
         connection = await pool.getConnection();
         // Check dependencies (e.g., if professor is scheduled) before deleting? Or rely on FK constraints?
         // For simplicity, relying on FK constraints for now (Schedule might prevent deletion if prof has classes)
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
         // Handle foreign key constraint errors specifically if needed
         if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.errno === 1451) {
             return res.status(409).json({ message: 'Cannot delete user: They might be assigned to scheduled classes.' });
         }
         res.status(500).json({ message: 'Server error deleting user.' });
     } finally {
         if (connection) connection.release();
     }
 });

// Placeholder for UPDATE User
app.put('/api/admin/users/:userId', verifyToken, isAdmin, async (req, res) => {
     const { userId } = req.params;
     // Get updated data from body - EXCLUDE password for now
     const { full_name, email, role /*, division_id, batch_id */ } = req.body;
     console.log(`Admin request received to UPDATE user ID: ${userId} with data:`, req.body);

     if (!full_name || !email || !role) {
         return res.status(400).json({ message: 'Full name, email, and role are required for update.' });
     }
     // Add validation for role, etc.

     // TODO: Handle division_id and batch_id updates carefully, especially if role changes.
     // For now, only updating basic info.

     let connection;
     try {
         connection = await pool.getConnection();
         const [result] = await connection.query(
             "UPDATE Users SET full_name = ?, email = ?, role = ? WHERE user_id = ?",
             // Add division_id = ?, batch_id = ? if implementing that update
             [full_name, email, role, userId]
         );

         if (result.affectedRows === 0) {
              console.warn(`Update failed: User ID ${userId} not found.`);
             return res.status(404).json({ message: 'User not found.' });
         }
         if (result.changedRows === 0) {
             console.log(`Update successful but no changes made for user ID: ${userId}.`);
            return res.json({ message: 'User details updated (no changes detected).' });
         }

         console.log(`User ID ${userId} updated successfully.`);
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

// Temporary Hashing Route (Keep for debugging if needed, ensure it's protected)
app.post('/api/admin/generate-hash', verifyToken, isAdmin, async (req, res) => {
    const { passwordToHash } = req.body;
    console.log("Admin requested to hash a password.");
    if (!passwordToHash) return res.status(400).json({ message: 'Please provide "passwordToHash".' });
    try {
        const generatedHash = await bcrypt.hash(passwordToHash, 10);
        res.json({ originalPassword: passwordToHash, generatedHash: generatedHash });
    } catch (error) {
        console.error("Error generating hash:", error);
        res.status(500).json({ message: 'Server error generating hash.' });
    }
});


// === ADMIN RESOURCE MANAGEMENT ROUTES ===

// --- Classroom Router ---
const classroomRouter = express.Router();
classroomRouter.post('/', async (req, res) => { /* ... existing code ... */ });
classroomRouter.get('/', async (req, res) => { /* ... existing code ... */ });
classroomRouter.get('/:id', async (req, res) => { /* ... existing code ... */ });
classroomRouter.put('/:id', async (req, res) => { /* ... existing code ... */ });
classroomRouter.delete('/:id', async (req, res) => { /* ... existing code ... */ });
app.use('/api/admin/classrooms', verifyToken, isAdmin, classroomRouter); // Keep protection

// --- Course Router ---
const courseRouter = express.Router();
courseRouter.post('/', async (req, res) => { /* ... existing code ... */ });
courseRouter.get('/', async (req, res) => { /* ... existing code ... */ });
courseRouter.get('/:id', async (req, res) => { /* ... existing code ... */ });
courseRouter.put('/:id', async (req, res) => { /* ... existing code ... */ });
courseRouter.delete('/:id', async (req, res) => { /* ... existing code ... */ });
app.use('/api/admin/courses', verifyToken, isAdmin, courseRouter); // Keep protection


// --- ** NEW: Professor Dashboard Routes (for form data) ** ---

// GET All Courses (for Professor dropdown)
app.get('/api/professor/courses', verifyToken, isProfessor, async (req, res) => {
    console.log(`Professor request received for /api/professor/courses by user ${req.user.user_id}`);
    let connection;
    try {
        connection = await pool.getConnection();
        // Professors can presumably book any course, so fetch all
        const [courses] = await connection.query(`
            SELECT course_id, course_code, course_name 
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

// GET All Classrooms (for Professor dropdown)
app.get('/api/professor/classrooms', verifyToken, isProfessor, async (req, res) => {
    console.log(`Professor request received for /api/professor/classrooms by user ${req.user.user_id}`);
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

// GET Full Academic Structure (Batches) (for Professor dropdown)
app.get('/api/professor/batches', verifyToken, isProfessor, async (req, res) => {
    console.log(`Professor request received for /api/professor/batches by user ${req.user.user_id}`);
    let connection;
    try {
        connection = await pool.getConnection();
        // Using the same logic as the admin structure route
        const [branches] = await connection.query("SELECT * FROM Branches ORDER BY branch_name");
        const [divisions] = await connection.query("SELECT * FROM Divisions ORDER BY division_name");
        const [batches] = await connection.query("SELECT * FROM Batches ORDER BY batch_name");

        // Nest the data
        const structure = branches.map(branch => ({
            ...branch,
            divisions: divisions
                .filter(div => div.branch_id === branch.branch_id)
                .map(div => ({
                    ...div,
                    batches: batches.filter(b => b.division_id === div.division_id)
                }))
        }));
        
        res.json(structure);
    } catch (error) {
        console.error('Error fetching academic structure for professor:', error);
        res.status(500).json({ message: 'Server error fetching academic structure' });
    } finally {
        if (connection) connection.release();
    }
});



// === PROFESSOR ROUTES ===

// --- ** NEW: Professor Schedule Route ** ---
app.get('/api/professor/my-schedule', verifyToken, isProfessor, async (req, res) => {
    const professor_id = req.user.user_id;
    console.log(`Professor ${professor_id} requesting their schedule`);
    let connection;
    try {
        connection = await pool.getConnection();
        // Fetch all schedule entries (Base and Extra) for this professor
        // We join with all necessary tables to get human-readable names
        const [scheduleEvents] = await connection.query(`
            SELECT 
                s.schedule_id, 
                s.class_type, 
                s.day_of_week, 
                s.class_date,
                s.start_time, -- This is a full DATETIME string
                s.end_time,   -- This is a full DATETIME string
                c.course_code, 
                c.course_name,
                cr.room_number,
                CONCAT(br.branch_code, '-', d.division_name, '-', b.batch_name) AS batch_details
            FROM Schedule s
            JOIN Courses c ON s.course_id = c.course_id
            JOIN Classrooms cr ON s.classroom_id = cr.classroom_id
            JOIN Batches b ON s.batch_id = b.batch_id
            JOIN Divisions d ON b.division_id = d.division_id
            JOIN Branches br ON d.branch_id = br.branch_id
            WHERE s.professor_id = ?
            ORDER BY s.start_time;
        `, [professor_id]);

        console.log(`Found ${scheduleEvents.length} schedule events for professor ${professor_id}`);
        res.json(scheduleEvents);

    } catch (error) {
        console.error(`Error fetching schedule for professor ${professor_id}:`, error);
        res.status(500).json({ message: 'Server error fetching schedule' });
    } finally {
        if (connection) connection.release();
    }
});

app.post('/api/book-extra-class', verifyToken, isProfessor, async (req, res) => {
    const professor_id = req.user.user_id;
    const { course_id, batch_id, classroom_id, class_date, start_time, end_time } = req.body;
    console.log(`Professor ${professor_id} attempting to book extra class:`, req.body);

    if (course_id == null || batch_id == null || classroom_id == null || !class_date || !start_time || !end_time) {
        return res.status(400).json({ message: 'Missing required fields.' });
    }
    const timeRegex = /^\d{2}:\d{2}(:\d{2})?$/;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(class_date) || !timeRegex.test(start_time) || !timeRegex.test(end_time)) {
         return res.status(400).json({ message: 'Invalid date/time format.' });
    }
    if (start_time >= end_time) {
         return res.status(400).json({ message: 'Start time must be before end time.' });
    }

    const fullStartTime = `${class_date} ${start_time}`;
    const fullEndTime = `${class_date} ${end_time}`;
    let dayOfWeek;
    try {
        const dateObj = new Date(class_date + 'T00:00:00');
        if (isNaN(dateObj)) throw new Error('Invalid date');
        dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    } catch (dateError) {
        console.error("Invalid date format provided:", class_date, dateError);
        return res.status(400).json({ message: 'Invalid date format (YYYY-MM-DD).' });
    }

    let connection;
    try {
        connection = await pool.getConnection();

        const [conflicts] = await connection.query(
          `SELECT /* ... Conflict Check Query ... */
              schedule_id, class_type, day_of_week,
              DATE_FORMAT(start_time, '%H:%i') as existing_start,
              DATE_FORMAT(end_time, '%H:%i') as existing_end,
              CASE
                  WHEN classroom_id = ? THEN 'Classroom' WHEN professor_id = ? THEN 'Professor' WHEN batch_id = ? THEN 'Batch' ELSE 'Unknown'
              END AS conflict_entity,
              CASE
                  WHEN classroom_id = ? THEN (SELECT room_number FROM Classrooms WHERE classroom_id = Schedule.classroom_id)
                  WHEN professor_id = ? THEN (SELECT full_name FROM Users WHERE user_id = Schedule.professor_id)
                  WHEN batch_id = ? THEN (SELECT CONCAT(br.branch_code,'-',d.division_name,'-',b.batch_name) FROM Batches b JOIN Divisions d ON b.division_id=d.division_id JOIN Branches br ON d.branch_id=br.branch_id WHERE b.batch_id = Schedule.batch_id)
                  ELSE 'Details unavailable'
              END AS conflict_details
          FROM Schedule WHERE (start_time < ? AND end_time > ?) AND (
              (class_type = 'Extra' AND class_date = ? AND (classroom_id = ? OR professor_id = ? OR batch_id = ?)) OR
              (class_type = 'Base' AND day_of_week = ? AND (classroom_id = ? OR professor_id = ? OR batch_id = ?))
          ) LIMIT 1;`,
          [
              classroom_id, professor_id, batch_id, classroom_id, professor_id, batch_id,
              fullEndTime, fullStartTime, class_date, classroom_id, professor_id, batch_id,
              dayOfWeek, classroom_id, professor_id, batch_id
          ]
      );

        if (conflicts.length > 0) {
            const conflict = conflicts[0];
            const reason = `Conflict: ${conflict.conflict_entity} (${conflict.conflict_details}) is already booked for a ${conflict.class_type} class (${conflict.day_of_week || class_date} ${conflict.existing_start}-${conflict.existing_end}).`;
            console.warn(`Booking conflict detected for professor ${professor_id}: ${reason}`);
            return res.status(409).json({ message: reason });
        }

        console.log(`No conflicts found for professor ${professor_id}. Proceeding to book.`);
        const [insertResult] = await connection.query(
            "INSERT INTO Schedule (course_id, professor_id, batch_id, classroom_id, day_of_week, start_time, end_time, class_type, class_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [course_id, professor_id, batch_id, classroom_id, dayOfWeek, fullStartTime, fullEndTime, 'Extra', class_date]
        );

        if (insertResult.affectedRows === 1) {
            console.log(`Extra class booked successfully for professor ${professor_id}, schedule ID: ${insertResult.insertId}`);
            res.status(201).json({ message: 'Extra class booked successfully!', scheduleId: insertResult.insertId });
        } else {
            throw new Error('Failed to insert extra class schedule.');
        }

    } catch (error) {
        console.error(`Error booking extra class for professor ${professor_id}:`, error);
        if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.errno === 1452) {
             return res.status(400).json({ message: 'Invalid Course, Batch, or Classroom ID provided.' });
        }
        res.status(500).json({ message: 'Server error booking extra class.' });
    } finally {
        if (connection) connection.release();
    }
});

// === STUDENT SCHEDULE ROUTE ===
app.get('/api/student/my-schedule', verifyToken, isStudent, async (req, res) => {
    const batch_id = req.user.batch_id; // Get the batch ID from the JWT payload
    console.log(`Fetching schedule for student batch ID: ${batch_id}`);

    if (!batch_id) {
         return res.status(400).json({ message: 'User data is missing batch information.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();

        // Fetch all classes for this batch (Base and Extra)
        const [schedule] = await connection.query(`
            SELECT
                s.schedule_id, s.class_type, s.day_of_week, s.class_date,
                DATE_FORMAT(s.start_time, '%Y-%m-%d %H:%i:%s') as start_time,
                DATE_FORMAT(s.end_time, '%Y-%m-%d %H:%i:%s') as end_time,
                c.course_name, c.course_code,
                u_prof.full_name AS professor_name,
                cr.room_number
            FROM Schedule s
            JOIN Courses c ON s.course_id = c.course_id
            JOIN Users u_prof ON s.professor_id = u_prof.user_id
            JOIN Classrooms cr ON s.classroom_id = cr.classroom_id
            WHERE s.batch_id = ?
            ORDER BY s.day_of_week, s.start_time, s.class_date
        `, [batch_id]);

        res.json(schedule);

    } catch (error) {
        console.error(`Error fetching schedule for student batch ${batch_id}:`, error);
        res.status(500).json({ message: 'Server error fetching student schedule.' });
    } finally {
        if (connection) connection.release();
    }
});

// === SCHEDULED JOB FOR CLEANUP ===
cron.schedule('5 1 * * *', async () => { /* ... existing cleanup code ... */ }, {
    scheduled: true,
    timezone: "Asia/Kolkata"
});
console.log('Scheduled cleanup job registered.');


// === START SERVER ===
app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});

