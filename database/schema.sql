-- ==========================================================
-- CampusCare Database Schema (3NF Compliant)
-- Developed for Thakur Ramnarayan College of Arts and Commerce
-- Student: Vedant Milind Pomendkar (Roll No: 2407106)
-- Guide: Dr. Sandeep Kamble, Dept. of Computer Science
-- ==========================================================

CREATE DATABASE IF NOT EXISTS campuscare_db;
USE campuscare_db;

-- 1. Roles Table
CREATE TABLE IF NOT EXISTS roles (
    role_id INT AUTO_INCREMENT PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    roll_number VARCHAR(50) UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    department VARCHAR(100) DEFAULT 'Computer Science',
    year_of_study VARCHAR(20) DEFAULT 'T.Y.B.Sc. (CS)',
    avatar_url VARCHAR(255) DEFAULT '/images/default-avatar.png',
    role_id INT NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE RESTRICT
);

-- 3. Marketplace Items Table
CREATE TABLE IF NOT EXISTS marketplace_items (
    item_id INT AUTO_INCREMENT PRIMARY KEY,
    owner_id INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL, -- Books, Electronics, Stationery, Lab Equipment, Uniform, Sports
    listing_type ENUM('SALE', 'BORROW', 'GIVEAWAY') NOT NULL DEFAULT 'SALE',
    price DECIMAL(10, 2) DEFAULT 0.00,
    item_condition ENUM('Brand New', 'Like New', 'Good', 'Fair') DEFAULT 'Good',
    description TEXT,
    image_url VARCHAR(255) DEFAULT '/images/items/default-item.png',
    status ENUM('AVAILABLE', 'RESERVED', 'COMPLETED') DEFAULT 'AVAILABLE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 4. Marketplace Requests Table
CREATE TABLE IF NOT EXISTS marketplace_requests (
    request_id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    requester_id INT NOT NULL,
    request_type ENUM('BUY', 'BORROW', 'CLAIM') NOT NULL,
    proposed_duration VARCHAR(100), -- e.g., "For 2 weeks during exams"
    message TEXT,
    contact_phone VARCHAR(20),
    status ENUM('PENDING', 'ACCEPTED', 'REJECTED') DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES marketplace_items(item_id) ON DELETE CASCADE,
    FOREIGN KEY (requester_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 5. Lost and Found Items Table
CREATE TABLE IF NOT EXISTS lost_found_items (
    report_id INT AUTO_INCREMENT PRIMARY KEY,
    reporter_id INT NOT NULL,
    report_type ENUM('LOST', 'FOUND') NOT NULL,
    item_name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL,
    location_found_lost VARCHAR(150) NOT NULL,
    event_date DATE NOT NULL,
    description TEXT NOT NULL,
    identifying_marks TEXT,
    image_url VARCHAR(255) DEFAULT '/images/lostfound/default.png',
    custody_details VARCHAR(255), -- Where found item is submitted (e.g., "Handed to Security Desk Room 102")
    status ENUM('OPEN', 'MATCHED', 'CLAIMED', 'RETURNED') DEFAULT 'OPEN',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (reporter_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 6. Lost and Found Claims Table
CREATE TABLE IF NOT EXISTS lost_found_claims (
    claim_id INT AUTO_INCREMENT PRIMARY KEY,
    report_id INT NOT NULL,
    claimant_id INT NOT NULL,
    proof_description TEXT NOT NULL,
    proof_image_url VARCHAR(255),
    status ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING',
    admin_remarks TEXT,
    verified_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES lost_found_items(report_id) ON DELETE CASCADE,
    FOREIGN KEY (claimant_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (verified_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- 7. Complaints (Grievances) Table
CREATE TABLE IF NOT EXISTS complaints (
    complaint_id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_code VARCHAR(30) NOT NULL UNIQUE, -- e.g., "CMP-2026-1001"
    user_id INT NOT NULL,
    department_assigned VARCHAR(100) DEFAULT 'IT & Maintenance',
    category ENUM('IT & Labs', 'Infrastructure & Maintenance', 'Sanitation & Hygiene', 'Library', 'Academic & Canteen', 'Security & Safety') NOT NULL,
    location VARCHAR(150) NOT NULL,
    urgency ENUM('LOW', 'MEDIUM', 'HIGH', 'EMERGENCY') DEFAULT 'MEDIUM',
    title VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    photo_url VARCHAR(255),
    status ENUM('SUBMITTED', 'UNDER REVIEW', 'IN PROGRESS', 'RESOLVED', 'CLOSED') DEFAULT 'SUBMITTED',
    resolution_notes TEXT,
    rating INT DEFAULT NULL, -- 1 to 5 stars
    feedback TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 8. Complaint Timeline / History
CREATE TABLE IF NOT EXISTS complaint_timeline (
    timeline_id INT AUTO_INCREMENT PRIMARY KEY,
    complaint_id INT NOT NULL,
    status VARCHAR(50) NOT NULL,
    notes TEXT,
    updated_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complaint_id) REFERENCES complaints(complaint_id) ON DELETE CASCADE,
    FOREIGN KEY (updated_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- 9. Events Table
CREATE TABLE IF NOT EXISTS events (
    event_id INT AUTO_INCREMENT PRIMARY KEY,
    organizer_id INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    department VARCHAR(100) DEFAULT 'Computer Science',
    description TEXT NOT NULL,
    venue VARCHAR(150) NOT NULL,
    event_date DATETIME NOT NULL,
    seat_capacity INT NOT NULL DEFAULT 100,
    registered_count INT NOT NULL DEFAULT 0,
    has_certificate TINYINT(1) DEFAULT 1,
    banner_url VARCHAR(255) DEFAULT '/images/events/default-event.png',
    status ENUM('UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED') DEFAULT 'UPCOMING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (organizer_id) REFERENCES users(user_id) ON DELETE RESTRICT
);

-- 10. Event Registrations Table
CREATE TABLE IF NOT EXISTS event_registrations (
    registration_id INT AUTO_INCREMENT PRIMARY KEY,
    event_id INT NOT NULL,
    user_id INT NOT NULL,
    ticket_code VARCHAR(50) NOT NULL UNIQUE,
    qr_hash VARCHAR(100) NOT NULL UNIQUE,
    attendance_status ENUM('REGISTERED', 'ATTENDED', 'ABSENT') DEFAULT 'REGISTERED',
    attended_at DATETIME DEFAULT NULL,
    certificate_issued TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_event (event_id, user_id)
);

-- 11. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    link VARCHAR(255),
    is_read TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 12. Emergency SOS Alerts Table
CREATE TABLE IF NOT EXISTS sos_alerts (
    sos_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    location_name VARCHAR(255) DEFAULT 'Campus Premises',
    status ENUM('ACTIVE', 'RESOLVED') DEFAULT 'ACTIVE',
    resolved_by INT DEFAULT NULL,
    resolution_remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (resolved_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Index optimizations
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_complaints_ticket ON complaints(ticket_code);
CREATE INDEX idx_complaints_status ON complaints(status);
CREATE INDEX idx_marketplace_status ON marketplace_items(status);
CREATE INDEX idx_lostfound_status ON lost_found_items(status);
CREATE INDEX idx_registrations_hash ON event_registrations(qr_hash);
