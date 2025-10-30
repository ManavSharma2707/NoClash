# NoClash — Timetable Conflict Checker

A focused, database‑driven API and single‑page app that prevents timetable clashes for students, professors, and administrators. Minimal noise, maximum clarity.

Made by:

- SY CS-K Group 1
- Aadi Joshi
- Manav Sharma
- Tanvesh Deshmukh
- Yash Suryawanshi

## What this project does

- Keeps a clean academic structure (Branches → Divisions → Batches)
- Manages resources (Classrooms, Courses)
- Handles users and roles (Administrator, Professor, Student)
- Authenticates securely (bcrypt + JWT)
- Schedules classes and blocks conflicting bookings with SQL‑level checks

The heart of NoClash is the DBMS/SQL layer: a normalized MySQL schema with constrained relationships and transactionally safe conflict detection for extra‑class bookings.

## High‑level architecture

```mermaid
flowchart LR
  subgraph Client
    A[Web App (Vite+React)]
  end

  subgraph Server
    B[Express API]
    C[Auth (JWT)]
    D[Business Logic]
  end

  subgraph Data
    E[(MySQL)]
    F[mysql2 Connection Pool]
  end

  A -->|HTTPS + CORS| B
  B --> C
  B --> D
  D <-->|SQL Queries| F
  F --> E
```

## Database model (inferred)

The API queries reveal these core entities and relationships.

```mermaid
erDiagram
  Users {
    INT user_id PK
    VARCHAR full_name
    VARCHAR email UNIQUE
    VARCHAR password -- bcrypt hash
    ENUM role -- Administrator|Professor|Student
    ENUM approval_status -- Pending|Approved|Rejected
    INT division_id FK
    INT batch_id FK
  }

  Branches {
    INT branch_id PK
    VARCHAR branch_name
    VARCHAR branch_code UNIQUE
  }

  Divisions {
    INT division_id PK
    INT branch_id FK
    VARCHAR division_name
  }

  Batches {
    INT batch_id PK
    INT division_id FK
    VARCHAR batch_name
  }

  Courses {
    INT course_id PK
    VARCHAR course_code UNIQUE
    VARCHAR course_name
    INT branch_id FK
    INT credits
    ENUM type -- e.g., Theory/Lab
  }

  Classrooms {
    INT classroom_id PK
    VARCHAR room_number UNIQUE
    VARCHAR building
    INT floor
    INT capacity
    ENUM type -- e.g., Lecture/Lab
  }

  Schedule {
    INT schedule_id PK
    INT course_id FK
    INT professor_id FK -- Users.user_id
    INT batch_id FK
    INT classroom_id FK
    VARCHAR day_of_week -- Monday..Sunday (for base classes)
    DATETIME start_time
    DATETIME end_time
    ENUM class_type -- Base|Extra
    DATE class_date -- for Extra; null or ignored for Base
  }

  Branches ||--o{ Divisions : contains
  Divisions ||--o{ Batches : groups
  Branches ||--o{ Courses : offers
  Users ||--o{ Schedule : teaches (professor_id)
  Batches ||--o{ Schedule : attends
  Classrooms ||--o{ Schedule : hosts
  Courses ||--o{ Schedule : scheduled
  Divisions ||--o{ Users : placement (students)
  Batches ||--o{ Users : placement (students)
```

Notes
- Base classes recur by day_of_week; Extra classes are date‑specific.
- Students carry division_id and batch_id in their user record for access control and schedule queries.

## The SQL that keeps clashes out

When a professor books an Extra class, the API does a transactional conflict check that covers three dimensions simultaneously: classroom, professor, and batch.

- Overlap condition: (existing.start_time < new.end_time) AND (existing.end_time > new.start_time)
- Conflict sources (any one triggers a conflict):
  - Another Extra class on the same class_date involving the same classroom OR professor OR batch
  - A Base class on the same day_of_week involving the same classroom OR professor OR batch
- Locking: the check uses FOR UPDATE inside a transaction to prevent race conditions

```mermaid
sequenceDiagram
  autonumber
  actor Prof as Professor
  participant API as Express API
  participant DB as MySQL

  Prof->>API: POST /api/book-extra-class
  API->>DB: BEGIN
  API->>DB: SELECT ... FOR UPDATE (overlap + entity checks)
  alt conflict found
    DB-->>API: 1 row
    API->>DB: ROLLBACK
    API-->>Prof: 409 Conflict (who/when/why)
  else no conflict
    DB-->>API: 0 rows
    API->>DB: INSERT Schedule (class_type=Extra)
    API->>DB: COMMIT
    API-->>Prof: 201 Created (scheduleId)
  end
```

Conflict messages pinpoint the offending entity (Classroom / Professor / Batch) and time range, making it obvious how to fix.

## DBMS/SQL implementation details

- Engine: MySQL (compatible with mysql2/promise)
- Driver: mysql2 (async/await, prepared statements)
- Pooling: mysql.createPool with waitForConnections and configurable limits
- Optional TLS: enable with DB_SSL=true and provide CA via DB_SSL_CA
- Date handling: dateStrings=true to avoid timezone surprises; explicit DATE/DATETIME usage in queries
- Transaction safety: BEGIN/COMMIT/ROLLBACK around conflict checks and inserts
- Query style: parameterized queries, consistent LEFT JOIN usage for hydrated payloads

Recommended indexes (for performance and integrity)
- Foreign keys: on all FK columns (division_id, batch_id, branch_id, course_id, classroom_id, professor_id)
- Schedule time queries:
  - (class_date, start_time, end_time)
  - (day_of_week, start_time, end_time)
  - Individual: classroom_id, professor_id, batch_id
- Uniqueness: Users.email, Courses.course_code, Classrooms.room_number, Branches.branch_code

## API surface (selected)

Authentication and users
- POST /api/register — create account; students must include division_id and batch_id
- POST /api/login — returns JWT (1h expiry)
- PUT /api/user/change-password — authenticated

Admin
- GET /api/pending-users — review registrations
- PUT /api/approve-user/:userId — approve
- GET /api/admin/users — list users
- CRUD /api/admin/classrooms — manage rooms
- CRUD /api/admin/courses — manage courses
- GET /api/admin/structure — nested Branch→Division→Batch
- PUT/DELETE /api/admin/users/:userId — manage users

Professor
- GET /api/professor/courses — course options
- GET /api/professor/classrooms — room options
- GET /api/professor/batches — academic structure
- POST /api/book-extra-class — transactional conflict‑safe booking
- GET /api/professor/my-schedule — hydrated schedule

Student
- GET /api/student/my-schedule — batch schedule + division‑level extra classes
- GET /api/student/my-details — profile and placement

## Environment configuration

Backend uses environment variables and supports DATABASE_URL for convenience.

```
Backend/.env.example
```

```ini
# Database Configuration
DATABASE_URL="mysql://username:password@host:port/database_name"

# Server Configuration
PORT=4000

# Security Configuration
JWT_SECRET=your_jwt_secret_key

# CORS Configuration
CORS_ORIGIN=https://your-frontend.vercel.app
# For local development, use:
# CORS_ORIGIN=http://localhost:5173
```

Alternatively, specify discrete variables instead of DATABASE_URL:
- DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
- DB_CONN_LIMIT (default 10)
- DB_SSL=true, DB_SSL_CA, DB_REJECT_UNAUTHORIZED (for TLS)

## Minimal runbook

Backend
1) Copy `Backend/.env.example` to `Backend/.env` and fill values
2) Ensure MySQL is reachable and schema/tables exist as per ER diagram
3) Install deps and run

```powershell
# from repo root
cd Backend
npm install
npm run dev
```

Frontend (optional, for UI)

```powershell
cd ../Frontend
npm install
npm run dev
```

Backend starts on PORT (default 4000). Frontend defaults to http://localhost:5173.

## CORS + security

- CORS allows configured origins only (Vercel prod + localhost by default)
- Passwords are bcrypt‑hashed (saltRounds=10)
- JWT signed with `JWT_SECRET`, expires in 1 hour, contains role + placement IDs for access control

## Data flow at a glance

```mermaid
flowchart TD
  L[Login] -->|JWT| G[Guarded Routes]
  R[Register] -->|Pending| A[Admin Approves]
  A --> S1[User Approved]
  P[Professor] --> BEC[Book Extra Class]
  BEC -->|TX + FOR UPDATE| SQL[(Schedule Table)]
  STU[Student] --> GSM[Get My Schedule]
  GSM -->|Batch + Division joins| SQL
```

## Contributing

This repository welcomes clean, well‑scoped contributions.

- Branching: feature branches under `docs/*`, `feat/*`, or `fix/*`
- Commit style: clear, imperative messages (e.g., `docs: add root README with ERD and flow diagrams`)
- Pull requests: small, reviewed, and tested locally

Current contribution
- Branch: `docs/readme`
- Changes: Adds a comprehensive root `README.md` with architecture and DB‑centric documentation

---

Questions or ideas? Open an issue. Keep it crisp. 