const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

let dbMode = 'uninitialized';
let mysqlPool = null;
let sqliteDb = null;

// Precomputed bcrypt hash for 'admin123' and 'student123'
const DEFAULT_PW_HASH = bcrypt.hashSync('student123', 10);
const ADMIN_PW_HASH = bcrypt.hashSync('admin123', 10);

async function initDatabase() {
  const useFallback = process.env.DB_FALLBACK_SQLITE !== 'false';
  let mysqlSuccess = false;

  // 1. Try MySQL Connection if configured
  try {
    const mysql = require('mysql2/promise');
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 3306;
    const user = process.env.DB_USER || 'root';
    const password = process.env.DB_PASSWORD || '';
    const database = process.env.DB_NAME || 'campuscare_db';

    // First try connecting to server to ensure DB exists
    const adminConn = await mysql.createConnection({ host, port, user, password, connectTimeout: 3000 });
    await adminConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
    await adminConn.end();

    mysqlPool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // Test ping
    await mysqlPool.query('SELECT 1');
    dbMode = 'mysql';
    mysqlSuccess = true;
    console.log(`\x1b[32m[CampusCare DB] Connected to MySQL (${host}:${port}/${database}) successfully.\x1b[0m`);

    // Ensure schema exists
    await setupMysqlSchema(mysqlPool);
  } catch (err) {
    if (!useFallback) {
      console.error('\x1b[31m[CampusCare DB] MySQL connection failed and DB_FALLBACK_SQLITE is disabled:\x1b[0m', err.message);
      throw err;
    }
    console.log(`\x1b[33m[CampusCare DB] MySQL not reachable (${err.message}). Activating embedded SQLite engine for zero-config demonstration.\x1b[0m`);
  }

  // 2. Fallback to SQLite
  if (!mysqlSuccess) {
    await initSqlite();
  }
}

async function initSqlite() {
  const sqlite3 = require('sqlite3').verbose();
  const dbDir = path.join(__dirname, '..', '..', 'database');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  const dbPath = path.join(dbDir, 'campuscare.sqlite');

  return new Promise((resolve, reject) => {
    sqliteDb = new sqlite3.Database(dbPath, async (err) => {
      if (err) {
        console.error('[CampusCare DB] Failed to open SQLite database:', err.message);
        return reject(err);
      }
      dbMode = 'sqlite';
      console.log(`\x1b[32m[CampusCare DB] SQLite initialized at: ${dbPath}\x1b[0m`);
      try {
        await setupSqliteSchema();
        resolve();
      } catch (setupErr) {
        reject(setupErr);
      }
    });
  });
}

function sqliteExec(sql) {
  return new Promise((resolve, reject) => {
    sqliteDb.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function sqliteRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    sqliteDb.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ insertId: this.lastID, affectedRows: this.changes });
    });
  });
}

function sqliteAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    sqliteDb.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function setupSqliteSchema() {
  // Create tables in SQLite
  await sqliteExec(`
    CREATE TABLE IF NOT EXISTS roles (
      role_id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_name TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      roll_number TEXT UNIQUE,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      phone TEXT,
      department TEXT DEFAULT 'Computer Science',
      year_of_study TEXT DEFAULT 'T.Y.B.Sc. (CS)',
      avatar_url TEXT DEFAULT '/images/default-avatar.png',
      role_id INTEGER NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (role_id) REFERENCES roles(role_id)
    );

    CREATE TABLE IF NOT EXISTS marketplace_items (
      item_id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      listing_type TEXT NOT NULL DEFAULT 'SALE',
      price REAL DEFAULT 0.0,
      item_condition TEXT DEFAULT 'Good',
      description TEXT,
      image_url TEXT DEFAULT '/images/items/default-item.png',
      status TEXT DEFAULT 'AVAILABLE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS marketplace_requests (
      request_id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      requester_id INTEGER NOT NULL,
      request_type TEXT NOT NULL,
      proposed_duration TEXT,
      message TEXT,
      contact_phone TEXT,
      status TEXT DEFAULT 'PENDING',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (item_id) REFERENCES marketplace_items(item_id),
      FOREIGN KEY (requester_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS lost_found_items (
      report_id INTEGER PRIMARY KEY AUTOINCREMENT,
      reporter_id INTEGER NOT NULL,
      report_type TEXT NOT NULL,
      item_name TEXT NOT NULL,
      category TEXT NOT NULL,
      location_found_lost TEXT NOT NULL,
      event_date TEXT NOT NULL,
      description TEXT NOT NULL,
      identifying_marks TEXT,
      image_url TEXT DEFAULT '/images/lostfound/default.png',
      custody_details TEXT,
      status TEXT DEFAULT 'OPEN',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reporter_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS lost_found_claims (
      claim_id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL,
      claimant_id INTEGER NOT NULL,
      proof_description TEXT NOT NULL,
      proof_image_url TEXT,
      status TEXT DEFAULT 'PENDING',
      admin_remarks TEXT,
      verified_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (report_id) REFERENCES lost_found_items(report_id),
      FOREIGN KEY (claimant_id) REFERENCES users(user_id),
      FOREIGN KEY (verified_by) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS complaints (
      complaint_id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_code TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      department_assigned TEXT DEFAULT 'IT & Maintenance',
      category TEXT NOT NULL,
      location TEXT NOT NULL,
      urgency TEXT DEFAULT 'MEDIUM',
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      photo_url TEXT,
      status TEXT DEFAULT 'SUBMITTED',
      resolution_notes TEXT,
      rating INTEGER,
      feedback TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS complaint_timeline (
      timeline_id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      notes TEXT,
      updated_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (complaint_id) REFERENCES complaints(complaint_id),
      FOREIGN KEY (updated_by) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS events (
      event_id INTEGER PRIMARY KEY AUTOINCREMENT,
      organizer_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      department TEXT DEFAULT 'Computer Science',
      description TEXT NOT NULL,
      venue TEXT NOT NULL,
      event_date TEXT NOT NULL,
      seat_capacity INTEGER NOT NULL DEFAULT 100,
      registered_count INTEGER NOT NULL DEFAULT 0,
      has_certificate INTEGER DEFAULT 1,
      banner_url TEXT DEFAULT '/images/events/default-event.png',
      status TEXT DEFAULT 'UPCOMING',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organizer_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS event_registrations (
      registration_id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      ticket_code TEXT UNIQUE NOT NULL,
      qr_hash TEXT UNIQUE NOT NULL,
      attendance_status TEXT DEFAULT 'REGISTERED',
      attended_at TEXT,
      certificate_issued INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES events(event_id),
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      link TEXT,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS sos_alerts (
      sos_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      latitude REAL,
      longitude REAL,
      location_name TEXT DEFAULT 'Campus Premises',
      status TEXT DEFAULT 'ACTIVE',
      resolved_by INTEGER,
      resolution_remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    );
  `);

  // Seed default data if empty
  const userCount = await sqliteAll('SELECT COUNT(*) as count FROM users');
  if (!userCount || userCount[0].count === 0) {
    console.log('[CampusCare DB] Seeding initial demo data into SQLite...');
    await seedSqliteData();
  }
}

async function seedSqliteData() {
  await sqliteExec(`
    INSERT OR IGNORE INTO roles (role_id, role_name, description) VALUES
    (1, 'super_admin', 'System Super Administrator with full platform governance'),
    (2, 'dept_admin', 'Department & Facility Administrator handling operations'),
    (3, 'student', 'Verified Campus Student accessing utility services');
  `);

  await sqliteRun(`
    INSERT INTO users (user_id, full_name, roll_number, email, password_hash, phone, department, year_of_study, role_id) VALUES
    (1, 'Super Admin', 'EMP-001', 'admin@campuscare.edu', ?, '+91 98765 43210', 'Administration', 'Staff', 1),
    (2, 'Dr. Sandeep Kamble (HOD)', 'FAC-CS-02', 'deptadmin@campuscare.edu', ?, '+91 98201 12345', 'Computer Science', 'Faculty Guide', 2),
    (3, 'Vedant Pomendkar', '2407106', 'vedant@campuscare.edu', ?, '+91 91375 88990', 'Computer Science', 'T.Y.B.Sc. (CS)', 3),
    (4, 'Rahul Sharma', '2407115', 'student@campuscare.edu', ?, '+91 98200 99887', 'Information Tech', 'T.Y.B.Sc. (IT)', 3),
    (5, 'Ananya Patel', '2407122', 'ananya.p@campuscare.edu', ?, '+91 98330 11223', 'Computer Science', 'S.Y.B.Sc. (CS)', 3);
  `, [ADMIN_PW_HASH, ADMIN_PW_HASH, DEFAULT_PW_HASH, DEFAULT_PW_HASH, DEFAULT_PW_HASH]);

  await sqliteExec(`
    INSERT INTO marketplace_items (item_id, owner_id, title, category, listing_type, price, item_condition, description, image_url, status) VALUES
    (1, 3, 'Data Structures & Algorithms in Java (Robert Lafore)', 'Books', 'SALE', 350.00, 'Like New', 'Standard semester textbook with neat handwritten notes and zero highlights. Very useful for CS exams.', '/images/items/book-dsa.svg', 'AVAILABLE'),
    (2, 4, 'Scientific Calculator Casio fx-991EX ClassWiz', 'Electronics', 'BORROW', 0.00, 'Good', 'Available for borrow during the upcoming mid-semester exam week. Must be returned in 10 days.', '/images/items/calculator.svg', 'AVAILABLE'),
    (3, 5, 'White Cotton Lab Coat (Size L)', 'Lab Equipment', 'GIVEAWAY', 0.00, 'Good', 'Passing on my lab coat to junior students. Cleaned and washed, no tears.', '/images/items/labcoat.svg', 'AVAILABLE'),
    (4, 3, 'Arduino Uno R3 Starter Sensor Kit', 'Electronics', 'SALE', 650.00, 'Like New', 'Includes Arduino board, breadboard, jumper wires, ultrasonic sensor, RFID reader, and LCD screen.', '/images/items/arduino.svg', 'AVAILABLE'),
    (5, 4, 'Engineering Graphics Mini-Drafter with Scale', 'Stationery', 'SALE', 200.00, 'Good', 'Comes with protective carrying canvas bag and protractor lock.', '/images/items/drafter.svg', 'AVAILABLE'),
    (6, 5, 'Yonex Carbonex Badminton Racket with Bag', 'Sports', 'BORROW', 0.00, 'Fair', 'Available for borrow for inter-collegiate sports practice sessions.', '/images/items/racket.svg', 'AVAILABLE');

    INSERT INTO marketplace_requests (request_id, item_id, requester_id, request_type, proposed_duration, message, contact_phone, status) VALUES
    (1, 1, 4, 'BUY', 'Immediate Purchase', 'Hi Vedant, I need this book for the upcoming DSA unit test! Can we meet at the campus library?', '+91 98200 99887', 'PENDING'),
    (2, 2, 3, 'BORROW', '2 Weeks (Exam Duration)', 'Hey Rahul, need this calculator for Applied Mathematics-III practicals.', '+91 91375 88990', 'ACCEPTED');

    INSERT INTO lost_found_items (report_id, reporter_id, report_type, item_name, category, location_found_lost, event_date, description, identifying_marks, image_url, custody_details, status) VALUES
    (1, 3, 'LOST', 'Milton Blue Thermosteel Water Bottle 750ml', 'Personal Belongings', 'Computer Science Lab 3 (3rd Floor)', '2026-09-18', 'Dark blue metallic finish with a silver cap and a small TRCAC sticker on the bottom.', 'Slight dent near bottom rim, TRCAC sticker', '/images/lostfound/bottle.svg', 'N/A', 'OPEN'),
    (2, 2, 'FOUND', 'Navy Blue Stainless Steel Flask', 'Personal Belongings', 'Central Library Reading Hall (2nd Floor)', '2026-09-19', 'Blue insulated bottle found on desk 14 after afternoon study hours.', 'Silver screw cap, TRCAC circular sticker', '/images/lostfound/bottle.svg', 'Deposited with Security Officer Mr. Pawar at Main Gate Desk', 'OPEN'),
    (3, 4, 'LOST', 'HP 65W Laptop Smart AC Adapter / Charger', 'Electronics', 'Ground Floor Cafeteria / Canteen', '2026-09-17', 'Black power brick with blue-tip barrel connector. Attached velcro cable tie.', 'Yellow tape wrap near the plug end', '/images/lostfound/charger.svg', 'N/A', 'OPEN'),
    (4, 5, 'FOUND', 'Black Wireless Earbuds Case (boAt Airdopes)', 'Electronics', 'Seminar Hall Audio Console Area', '2026-09-19', 'Matte black charging capsule found on stage chair after seminar.', 'Small scratch on top lid', '/images/lostfound/earbuds.svg', 'Held at Dept of CS Staff Room with Peon Sachin', 'OPEN');

    INSERT INTO complaints (complaint_id, ticket_code, user_id, department_assigned, category, location, urgency, title, description, photo_url, status, resolution_notes, rating, feedback, created_at) VALUES
    (1, 'CMP-2026-1001', 3, 'IT & Maintenance', 'IT & Labs', 'Computer Lab 2, PC #14 & #15', 'HIGH', 'Projector display flickering & Ethernet drop in Lab 2', 'The ceiling projector HDMI port disconnects repeatedly during OS practicals. PCs 14 and 15 also have damaged RJ45 ethernet clips.', '/images/complaints/lab.svg', 'IN PROGRESS', 'Hardware technician assigned. New HDMI cable requested from store room.', NULL, NULL, datetime('now', '-2 days')),
    (2, 'CMP-2026-1002', 4, 'Infrastructure & Maintenance', 'Infrastructure & Maintenance', '4th Floor Boys Restroom', 'HIGH', 'Water leakage and broken tap fixture', 'Tap continuously running causing severe water wastage and slippery tiles.', '/images/complaints/plumbing.svg', 'RESOLVED', 'Plumber replaced faulty washer and brass tap valve. Tested clean on Sep 19.', 5, 'Quick response! Thank you.', datetime('now', '-3 days')),
    (3, 'CMP-2026-1003', 5, 'Library', 'Library', '3rd Floor Digital Reference Section', 'LOW', 'Wi-Fi dead zone in corner study carrels', 'Signals are very weak near study bays 8 to 12. Students cannot access NPTEL video lectures.', '/images/complaints/wifi.svg', 'UNDER REVIEW', 'Network engineer scheduled to install an additional UniFi AP repeater.', NULL, NULL, datetime('now', '-1 day')),
    (4, 'CMP-2026-1004', 3, 'Sanitation & Hygiene', 'Sanitation & Hygiene', 'Block C Water Cooler Area', 'MEDIUM', 'Water cooler filter due for cartridge replacement', 'Water taste is murky and cooling indicator light is showing service filter alert.', '/images/complaints/cooler.svg', 'SUBMITTED', NULL, NULL, NULL, datetime('now', '-4 hours'));

    INSERT INTO complaint_timeline (timeline_id, complaint_id, status, notes, updated_by) VALUES
    (1, 1, 'SUBMITTED', 'Grievance submitted by student Vedant Pomendkar', 3),
    (2, 1, 'UNDER REVIEW', 'Assigned to IT Maintenance team by Dr. Sandeep Kamble', 2),
    (3, 1, 'IN PROGRESS', 'Technician dispatched with replacement cables', 2),
    (4, 2, 'SUBMITTED', 'Complaint registered for plumbing leakage', 4),
    (5, 2, 'RESOLVED', 'Tap fixture replaced and sealed', 2),
    (6, 2, 'CLOSED', 'Student confirmed resolution and awarded 5-star rating', 4);

    INSERT INTO events (event_id, organizer_id, title, department, description, venue, event_date, seat_capacity, registered_count, has_certificate, banner_url, status) VALUES
    (1, 2, 'TechSpark 2026: Annual Inter-Collegiate Technical Symposium', 'Computer Science', 'A premier campus tech symposium featuring Web Hackathons, Blind Coding, and AI Project Exhibits. Winners receive cash prizes and trophies.', 'Main Auditorium, 1st Floor', '2026-10-15 09:30:00', 250, 42, 1, '/images/events/techspark.svg', 'UPCOMING'),
    (2, 2, 'Hands-on Workshop: Cloud Computing & Docker Containerization', 'Computer Science', 'Comprehensive 6-hour masterclass on Docker containers, microservices, and deploying cloud apps on AWS/Azure.', 'Computer Lab 1 & 2', '2026-09-28 10:00:00', 60, 58, 1, '/images/events/workshop.svg', 'UPCOMING'),
    (3, 1, 'TRCAC Annual Blood Donation & Health Checkup Camp', 'Administration', 'Organized in collaboration with Tata Memorial Hospital. All student and staff donors will receive a donor card and refreshments.', 'Gymkhana Hall, Ground Floor', '2026-10-02 08:30:00', 300, 110, 0, '/images/events/healthcamp.svg', 'UPCOMING');

    INSERT INTO event_registrations (registration_id, event_id, user_id, ticket_code, qr_hash, attendance_status, attended_at, certificate_issued) VALUES
    (1, 1, 3, 'EVT-2026-101-VED', 'SHA256-CC-EVT-1-USER-3-91375', 'REGISTERED', NULL, 0),
    (2, 2, 3, 'EVT-2026-102-VED', 'SHA256-CC-EVT-2-USER-3-91375', 'ATTENDED', '2026-09-20 10:15:00', 1),
    (3, 1, 4, 'EVT-2026-101-RAH', 'SHA256-CC-EVT-1-USER-4-98200', 'REGISTERED', NULL, 0);

    INSERT INTO notifications (notification_id, user_id, title, message, link, is_read) VALUES
    (1, 3, 'Complaint Update: CMP-2026-1001', 'Your complaint regarding Lab 2 Projector is now IN PROGRESS.', '/complaints.html', 0),
    (2, 3, 'Marketplace Request Accepted!', 'Rahul Sharma accepted your request to borrow Casio Calculator.', '/marketplace.html', 0),
    (3, 3, 'Potential Lost Item Match Found!', 'A Navy Blue Flask found in the Library closely matches your reported Lost Bottle.', '/lost-found.html', 0),
    (4, 4, 'Event Pass Confirmed', 'Your entry QR pass for TechSpark 2026 is ready.', '/events.html', 1);
  `);
  console.log('[CampusCare DB] SQLite seeded successfully.');
}

async function setupMysqlSchema(pool) {
  try {
    const [rows] = await pool.query("SHOW TABLES LIKE 'users'");
    if (rows.length === 0) {
      console.log('[CampusCare DB] Initializing MySQL tables from schema.sql...');
      const schemaPath = path.join(__dirname, '..', '..', 'database', 'schema.sql');
      const seedPath = path.join(__dirname, '..', '..', 'database', 'seed.sql');
      
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      const statements = schemaSql.split(/;\s*$/m).filter(s => s.trim().length > 0);
      for (const statement of statements) {
        await pool.query(statement);
      }

      const seedSql = fs.readFileSync(seedPath, 'utf8');
      const seedStatements = seedSql.split(/;\s*$/m).filter(s => s.trim().length > 0);
      for (const statement of seedStatements) {
        await pool.query(statement);
      }
      console.log('[CampusCare DB] MySQL schema and seed data created successfully.');
    }
  } catch (err) {
    console.error('[CampusCare DB] MySQL setup error:', err.message);
  }
}

// Unified query function: returns [rowsOrResult, fields]
async function query(sql, params = []) {
  if (dbMode === 'mysql') {
    return await mysqlPool.query(sql, params);
  } else if (dbMode === 'sqlite') {
    const trimmed = sql.trim().toUpperCase();
    if (trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA') || trimmed.startsWith('WITH')) {
      const rows = await sqliteAll(sql, params);
      return [rows, []];
    } else {
      const result = await sqliteRun(sql, params);
      return [result, []];
    }
  } else {
    throw new Error('Database is not initialized yet. Call initDatabase() first.');
  }
}

module.exports = {
  initDatabase,
  query,
  getMode: () => dbMode
};
