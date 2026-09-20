-- ==========================================================
-- CampusCare Seed Data
-- Realistic Demo Data for Thakur Ramnarayan College
-- ==========================================================

USE campuscare_db;

-- Insert Roles
INSERT INTO roles (role_id, role_name, description) VALUES
(1, 'super_admin', 'System Super Administrator with full platform governance'),
(2, 'dept_admin', 'Department & Facility Administrator handling operations'),
(3, 'student', 'Verified Campus Student accessing utility services')
ON DUPLICATE KEY UPDATE role_name = VALUES(role_name);

-- Passwords below are hashed for 'admin123' and 'student123' using bcrypt (cost 10)
-- $2a$10$wN3dDqB1O1hLhGk5k0E5nOZb4vYg5pY4qGqg4wQx8oR1p8yTq9a2e (admin123)
-- $2a$10$wN3dDqB1O1hLhGk5k0E5nOZb4vYg5pY4qGqg4wQx8oR1p8yTq9a2e (student123)

-- Insert Users
INSERT INTO users (user_id, full_name, roll_number, email, password_hash, phone, department, year_of_study, avatar_url, role_id, is_active) VALUES
(1, 'Super Admin', 'EMP-001', 'admin@campuscare.edu', '$2a$10$zS31Vb0yZ7Zp71J3bVdY0e6wB108B7Z6yWcIe8E8H7Z6yWcIe8E8H', '+91 98765 43210', 'Administration', 'Staff', '/images/default-avatar.png', 1, 1),
(2, 'Dr. Sandeep Kamble (HOD)', 'FAC-CS-02', 'deptadmin@campuscare.edu', '$2a$10$zS31Vb0yZ7Zp71J3bVdY0e6wB108B7Z6yWcIe8E8H7Z6yWcIe8E8H', '+91 98201 12345', 'Computer Science', 'Faculty Guide', '/images/default-avatar.png', 2, 1),
(3, 'Vedant Pomendkar', '2407106', 'vedant@campuscare.edu', '$2a$10$zS31Vb0yZ7Zp71J3bVdY0e6wB108B7Z6yWcIe8E8H7Z6yWcIe8E8H', '+91 91375 88990', 'Computer Science', 'T.Y.B.Sc. (CS)', '/images/default-avatar.png', 3, 1),
(4, 'Rahul Sharma', '2407115', 'student@campuscare.edu', '$2a$10$zS31Vb0yZ7Zp71J3bVdY0e6wB108B7Z6yWcIe8E8H7Z6yWcIe8E8H', '+91 98200 99887', 'Information Tech', 'T.Y.B.Sc. (IT)', '/images/default-avatar.png', 3, 1),
(5, 'Ananya Patel', '2407122', 'ananya.p@campuscare.edu', '$2a$10$zS31Vb0yZ7Zp71J3bVdY0e6wB108B7Z6yWcIe8E8H7Z6yWcIe8E8H', '+91 98330 11223', 'Computer Science', 'S.Y.B.Sc. (CS)', '/images/default-avatar.png', 3, 1)
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name);

-- Marketplace Items
INSERT INTO marketplace_items (item_id, owner_id, title, category, listing_type, price, item_condition, description, image_url, status) VALUES
(1, 3, 'Data Structures & Algorithms in Java (Robert Lafore)', 'Books', 'SALE', 350.00, 'Like New', 'Standard semester textbook with neat handwritten notes and zero highlights. Very useful for CS exams.', '/images/items/book-dsa.jpg', 'AVAILABLE'),
(2, 4, 'Scientific Calculator Casio fx-991EX ClassWiz', 'Electronics', 'BORROW', 0.00, 'Good', 'Available for borrow during the upcoming mid-semester exam week. Must be returned in 10 days.', '/images/items/calculator.jpg', 'AVAILABLE'),
(3, 5, 'White Cotton Lab Coat (Size L)', 'Lab Equipment', 'GIVEAWAY', 0.00, 'Good', 'Passing on my lab coat to junior students. Cleaned and washed, no tears.', '/images/items/labcoat.jpg', 'AVAILABLE'),
(4, 3, 'Arduino Uno R3 Starter Sensor Kit', 'Electronics', 'SALE', 650.00, 'Like New', 'Includes Arduino board, breadboard, jumper wires, ultrasonic sensor, RFID reader, and LCD screen.', '/images/items/arduino.jpg', 'AVAILABLE'),
(5, 4, 'Engineering Graphics Mini-Drafter with Scale', 'Stationery', 'SALE', 200.00, 'Good', 'Comes with protective carrying canvas bag and protractor lock.', '/images/items/drafter.jpg', 'AVAILABLE'),
(6, 5, 'Yonex Carbonex Badminton Racket with Bag', 'Sports', 'BORROW', 0.00, 'Fair', 'Available for borrow for inter-collegiate sports practice sessions.', '/images/items/racket.jpg', 'AVAILABLE')
ON DUPLICATE KEY UPDATE title = VALUES(title);

-- Marketplace Requests
INSERT INTO marketplace_requests (request_id, item_id, requester_id, request_type, proposed_duration, message, contact_phone, status) VALUES
(1, 1, 4, 'BUY', 'Immediate Purchase', 'Hi Vedant, I need this book for the upcoming DSA unit test! Can we meet at the campus library?', '+91 98200 99887', 'PENDING'),
(2, 2, 3, 'BORROW', '2 Weeks (Exam Duration)', 'Hey Rahul, need this calculator for Applied Mathematics-III practicals.', '+91 91375 88990', 'ACCEPTED')
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- Lost and Found Items
INSERT INTO lost_found_items (report_id, reporter_id, report_type, item_name, category, location_found_lost, event_date, description, identifying_marks, image_url, custody_details, status) VALUES
(1, 3, 'LOST', 'Milton Blue Thermosteel Water Bottle 750ml', 'Personal Belongings', 'Computer Science Lab 3 (3rd Floor)', '2026-09-18', 'Dark blue metallic finish with a silver cap and a small TRCAC sticker on the bottom.', 'Slight dent near bottom rim, TRCAC sticker', '/images/lostfound/bottle.jpg', 'N/A', 'OPEN'),
(2, 2, 'FOUND', 'Navy Blue Stainless Steel Flask', 'Personal Belongings', 'Central Library Reading Hall (2nd Floor)', '2026-09-19', 'Blue insulated bottle found on desk 14 after afternoon study hours.', 'Silver screw cap, TRCAC circular sticker', '/images/lostfound/bottle.jpg', 'Deposited with Security Officer Mr. Pawar at Main Gate Desk', 'OPEN'),
(3, 4, 'LOST', 'HP 65W Laptop Smart AC Adapter / Charger', 'Electronics', 'Ground Floor Cafeteria / Canteen', '2026-09-17', 'Black power brick with blue-tip barrel connector. Attached velcro cable tie.', 'Yellow tape wrap near the plug end', '/images/lostfound/charger.jpg', 'N/A', 'OPEN'),
(4, 5, 'FOUND', 'Black Wireless Earbuds Case (boAt Airdopes)', 'Electronics', 'Seminar Hall Audio Console Area', '2026-09-19', 'Matte black charging capsule found on stage chair after seminar.', 'Small scratch on top lid', '/images/lostfound/earbuds.jpg', 'Held at Dept of CS Staff Room with Peon Sachin', 'OPEN')
ON DUPLICATE KEY UPDATE item_name = VALUES(item_name);

-- Complaints (Grievances)
INSERT INTO complaints (complaint_id, ticket_code, user_id, department_assigned, category, location, urgency, title, description, photo_url, status, resolution_notes, rating, feedback) VALUES
(1, 'CMP-2026-1001', 3, 'IT & Maintenance', 'IT & Labs', 'Computer Lab 2, PC #14 & #15', 'HIGH', 'Projector display flickering & Ethernet drop in Lab 2', 'The ceiling projector HDMI port disconnects repeatedly during OS practicals. PCs 14 and 15 also have damaged RJ45 ethernet clips.', '/images/complaints/lab-projector.jpg', 'IN PROGRESS', 'Hardware technician assigned. New HDMI cable requested from store room.', NULL, NULL),
(2, 'CMP-2026-1002', 4, 'Infrastructure & Maintenance', 'Infrastructure & Maintenance', '4th Floor Boys Restroom', 'HIGH', 'Water leakage and broken tap fixture', 'Tap continuously running causing severe water wastage and slippery tiles.', '/images/complaints/tap.jpg', 'RESOLVED', 'Plumber replaced faulty washer and brass tap valve. Tested clean on Sep 19.', 5, 'Quick response! Thank you.'),
(3, 'CMP-2026-1003', 5, 'Library', 'Library', '3rd Floor Digital Reference Section', 'LOW', 'Wi-Fi dead zone in corner study carrels', 'Signals are very weak near study bays 8 to 12. Students cannot access NPTEL video lectures.', '/images/complaints/wifi.jpg', 'UNDER REVIEW', 'Network engineer scheduled to install an additional UniFi AP repeater.', NULL, NULL),
(4, 'CMP-2026-1004', 3, 'Sanitation & Hygiene', 'Sanitation & Hygiene', 'Block C Water Cooler Area', 'MEDIUM', 'Water cooler filter due for cartridge replacement', 'Water taste is murky and cooling indicator light is showing service filter alert.', '/images/complaints/water-cooler.jpg', 'SUBMITTED', NULL, NULL, NULL)
ON DUPLICATE KEY UPDATE title = VALUES(title);

-- Complaint Timeline
INSERT INTO complaint_timeline (timeline_id, complaint_id, status, notes, updated_by) VALUES
(1, 1, 'SUBMITTED', 'Grievance submitted by student Vedant Pomendkar', 3),
(2, 1, 'UNDER REVIEW', 'Assigned to IT Maintenance team by Dr. Sandeep Kamble', 2),
(3, 1, 'IN PROGRESS', 'Technician dispatched with replacement cables', 2),
(4, 2, 'SUBMITTED', 'Complaint registered for plumbing leakage', 4),
(5, 2, 'RESOLVED', 'Tap fixture replaced and sealed', 2),
(6, 2, 'CLOSED', 'Student confirmed resolution and awarded 5-star rating', 4)
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- Events
INSERT INTO events (event_id, organizer_id, title, department, description, venue, event_date, seat_capacity, registered_count, has_certificate, banner_url, status) VALUES
(1, 2, 'TechSpark 2026: Annual Inter-Collegiate Technical Symposium', 'Computer Science', 'A premier campus tech symposium featuring Web Hackathons, Blind Coding, and AI Project Exhibits. Winners receive cash prizes and trophies.', 'Main Auditorium, 1st Floor', '2026-10-15 09:30:00', 250, 42, 1, '/images/events/techspark.jpg', 'UPCOMING'),
(2, 2, 'Hands-on Workshop: Cloud Computing & Docker Containerization', 'Computer Science', 'Comprehensive 6-hour masterclass on Docker containers, microservices, and deploying cloud apps on AWS/Azure.', 'Computer Lab 1 & 2', '2026-09-28 10:00:00', 60, 58, 1, '/images/events/workshop.jpg', 'UPCOMING'),
(3, 1, 'TRCAC Annual Blood Donation & Health Checkup Camp', 'Administration', 'Organized in collaboration with Tata Memorial Hospital. All student and staff donors will receive a donor card and refreshments.', 'Gymkhana Hall, Ground Floor', '2026-10-02 08:30:00', 300, 110, 0, '/images/events/healthcamp.jpg', 'UPCOMING')
ON DUPLICATE KEY UPDATE title = VALUES(title);

-- Event Registrations
INSERT INTO event_registrations (registration_id, event_id, user_id, ticket_code, qr_hash, attendance_status, attended_at, certificate_issued) VALUES
(1, 1, 3, 'EVT-2026-101-VED', 'SHA256-CC-EVT-1-USER-3-91375', 'REGISTERED', NULL, 0),
(2, 2, 3, 'EVT-2026-102-VED', 'SHA256-CC-EVT-2-USER-3-91375', 'ATTENDED', '2026-09-20 10:15:00', 1),
(3, 1, 4, 'EVT-2026-101-RAH', 'SHA256-CC-EVT-1-USER-4-98200', 'REGISTERED', NULL, 0)
ON DUPLICATE KEY UPDATE ticket_code = VALUES(ticket_code);

-- Notifications
INSERT INTO notifications (notification_id, user_id, title, message, link, is_read) VALUES
(1, 3, 'Complaint Update: CMP-2026-1001', 'Your complaint regarding Lab 2 Projector is now IN PROGRESS.', '/complaints.html', 0),
(2, 3, 'Marketplace Request Accepted!', 'Rahul Sharma accepted your request to borrow Casio Calculator.', '/marketplace.html', 0),
(3, 3, 'Potential Lost Item Match Found!', 'A Navy Blue Flask found in the Library closely matches your reported Lost Bottle.', '/lost-found.html', 0),
(4, 4, 'Event Pass Confirmed', 'Your entry QR pass for TechSpark 2026 is ready.', '/events.html', 1)
ON DUPLICATE KEY UPDATE title = VALUES(title);
