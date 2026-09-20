# CampusCare : A Centralized Campus Utility & Support Web Application

> **"One Campus. One Platform. Better Care."**

A full-stack, responsive web application designed for collegiate student services, resource sharing, campus grievance redressal, and automated event gate pass verification.

Developed as a BSc Computer Science Mini-Project for **Thakur Ramnarayan College of Arts and Commerce**, Dahisar (East), Mumbai.

* **Student Author:** Mr. Vedant Milind Pomendkar (Roll No. 2407106)
* **Project Guide:** Dr. Sandeep Kamble (Head of Department, Computer Science)
* **Academic Year:** 2026 – 2027 (Semester V)

---

## 🚀 Key Features

### 1. 🔐 Authentication & Role-Based Access Control (RBAC)
* 3 Distinct User Roles:
  * **Student**: Accesses marketplace, submits complaints, reports lost/found, registers for events, triggers SOS.
  * **Department Admin**: Triages and resolves facility grievances, approves lost item claims, scans gate passes.
  * **Super Admin**: Full administrative governance, RBAC role management, user account activation/deactivation.
* Secure password hashing using **Bcrypt (cost 10)**.
* Cookie & Bearer JWT session token management.
* One-click demo login buttons for evaluation.

### 2. 🛍️ Peer-to-Peer Campus Marketplace
* Students can list semester textbooks, scientific calculators, lab coats, mini-drafters, and Arduino kits.
* Filter by Category, Listing Type (**Sale**, **Borrow / Loan**, **Giveaway**), and Condition.
* Send exchange requests with proposed loan durations or purchase notes.
* Item owners can **Accept** or **Reject** requests; accepted requests reserve the item automatically.

### 3. 🔍 Lost & Found with Smart Algorithmic Matching
* Report Lost or Discovered items with location, date, category, custody, and photo proof.
* **FR-303 Algorithmic Match Assistant**: Intelligent keyword and metadata similarity score (e.g. 95% match) calculated between open lost and found reports.
* Secure ownership claim workflow: Students submit secret proof; Department Admins verify and generate **Return Receipts** (e.g., `RET-2026-XXXX`).

### 4. 🛠️ Grievance Redressal / Complaint System
* File facility issues across IT & Labs, Infrastructure, Sanitation, and Library.
* Automatically generated tracking codes: **`CMP-2026-XXXX`**.
* Defined 5-stage lifecycle workflow:
  `SUBMITTED` ➔ `UNDER REVIEW` ➔ `IN PROGRESS` ➔ `RESOLVED` ➔ `CLOSED`
* Live status activity timeline and admin resolution notes.
* 5-Star satisfaction rating and feedback submission on resolved tickets.

### 5. 🎟️ Campus Events & Anti-Proxy Dynamic QR Passes
* Admins publish events with real-time seat counter and decrement.
* Instant dynamic QR pass generation with cryptographic SHA-256 validation token.
* **Gate Pass Scanner (`/gate-scanner.html`)**: Real-time webcam scanning with `html5-qrcode` + fallback manual ticket code input.
* Prevents duplicate entry with instant warning alerts.
* Automated printable **E-Participation Certificates** for verified attendees.

### 6. 🚨 Real-Time Campus Emergency SOS
* One-click emergency broadcast with GPS coordinate acquisition.
* Instantly alerts security and administrators to student's campus location.

---

## 🛠️ Technology Stack

| Layer | Technology Choice | Architectural Justification |
| :--- | :--- | :--- |
| **Frontend UI** | HTML5, CSS3, JavaScript (ES6+), Bootstrap 5 | Modern, lightweight, mobile-responsive college portal |
| **Icons & Assets** | Bootstrap Icons, SVG vectors | Fast loading, crisp rendering on high-DPI displays |
| **QR Code Engine** | `qrcode` (Node) & `html5-qrcode` (Webcam) | Dynamic pass generation and real-time camera gate check-in |
| **Backend API** | Node.js + Express.js | High-throughput asynchronous REST API gateway |
| **Primary Database** | **MySQL (3NF Schema)** | Structured relational campus data with foreign keys |
| **Resilient Adapter** | **Dual-Engine (MySQL + SQLite Fallback)** | **Zero-configuration viva demonstration guarantee** |

---

## ⚡ Quick Start (Easy 2-Step Run)

### Step 1: Install Dependencies
Open PowerShell or Terminal inside the project folder:
```bash
npm install
```

### Step 2: Start the Web Server
```bash
npm start
```
Open your browser and navigate to:
👉 **`http://localhost:3000`**

> **💡 Zero-Config Demo Mode:**
> If MySQL is not running on your computer, CampusCare **automatically** boots with its embedded SQLite database (`database/campuscare.sqlite`), pre-seeded with all realistic college demo records! You can test every single feature immediately without installing or configuring MySQL.

---

## 🗄️ Optional: Connecting to MySQL (XAMPP / WAMP / MySQL Workbench)

To run the application against a live MySQL server:

1. Open **XAMPP Control Panel** and start **MySQL** (or start MySQL service).
2. Open **phpMyAdmin** (`http://localhost/phpmyadmin`) or MySQL Workbench.
3. Import the database schema and seed data:
   * Execute `database/schema.sql`
   * Execute `database/seed.sql`
4. Verify or update your credentials in `.env`:
   ```env
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=campuscare_db
   ```
5. Start the server (`npm start`). CampusCare will automatically connect to MySQL!

---

## 👤 Pre-Configured Demo Accounts

| Role | Email | Password | Name / Details |
| :--- | :--- | :--- | :--- |
| **Student** | `vedant@campuscare.edu` | `student123` | Vedant Pomendkar (T.Y.B.Sc. CS, Roll: 2407106) |
| **Student 2** | `student@campuscare.edu` | `student123` | Rahul Sharma (T.Y.B.Sc. IT, Roll: 2407115) |
| **Dept Admin** | `deptadmin@campuscare.edu` | `admin123` | Dr. Sandeep Kamble (HOD Computer Science) |
| **Super Admin** | `admin@campuscare.edu` | `admin123` | Super Administrator (System Governance) |

*(Convenient one-click login buttons are also available on the Login page!)*

---

## 📁 Project Directory Structure

```
CAMPUSCARE/
├── database/
│   ├── schema.sql              # 3NF MySQL relational database schema
│   ├── seed.sql                # Preloaded realistic college data
│   └── campuscare.sqlite       # Embedded zero-config SQLite database
├── public/
│   ├── css/
│   │   └── style.css           # Custom college theme & responsive styling
│   ├── js/
│   │   └── app.js              # Central frontend API helper & auth state
│   ├── images/                 # Logo, avatars, and item graphics
│   ├── index.html              # College portal landing page
│   ├── login.html              # Login page with 1-click demo buttons
│   ├── register.html           # Student registration page
│   ├── dashboard.html          # Student workspace dashboard
│   ├── marketplace.html        # P2P Buy/Borrow/Giveaway marketplace
│   ├── lost-found.html         # Lost & Found with algorithmic matching
│   ├── complaints.html         # Grievance portal (CMP-2026-XXXX)
│   ├── events.html             # Events hub, QR passes, and certificates
│   ├── gate-scanner.html       # Live webcam QR code verification desk
│   ├── admin-dashboard.html    # Department & Super Admin command center
│   └── profile.html            # Profile self-service & password change
├── src/
│   ├── config/
│   │   └── db.js               # Universal resilient database adapter
│   ├── middleware/
│   │   ├── auth.js             # JWT & Role-Based Access Control (RBAC)
│   │   └── upload.js           # Multer file and photo upload handler
│   ├── routes/
│   │   ├── auth.js             # User login, register, profile
│   │   ├── marketplace.js      # Items catalog and request approvals
│   │   ├── lostFound.js        # Lost/found reports, matcher, claims
│   │   ├── complaints.js       # Grievances, ticket generator, ratings
│   │   ├── events.js           # Event registration, QR passes, certs
│   │   ├── admin.js            # KPI metrics and user management
│   │   ├── sos.js              # Real-time Emergency SOS broadcast
│   │   └── notifications.js    # User notification bell alerts
│   └── server.js               # Express application entry point
├── .env                        # Configuration environment variables
├── .env.example                # Sample environment template
├── package.json                # Project dependencies and scripts
└── README.md                   # Complete documentation and setup guide
```

---

## 📄 Academic Citation & Reference
This project was implemented following the Software Requirements Specification (SRS) in:
* *CampusCare — A Centralized Campus Utility & Support Web Application*, Project Report by Vedant Pomendkar, Department of Computer Science, Thakur Ramnarayan College of Arts and Commerce, 2026-2027.
