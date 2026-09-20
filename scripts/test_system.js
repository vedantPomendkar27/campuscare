const http = require('http');

const BASE_URL = 'http://localhost:3000';

async function request(path, options = {}) {
  const url = new URL(path, BASE_URL);
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.status, headers: res.headers, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('\n--- STARTING CAMPUSCARE END-TO-END VERIFICATION ---\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  \x1b[32m✔ PASS\x1b[0m: ${message}`);
      passed++;
    } else {
      console.log(`  \x1b[31m✖ FAIL\x1b[0m: ${message}`);
      failed++;
    }
  }

  // 1. Health check
  try {
    const health = await request('/api/health');
    assert(health.body && health.body.status === 'OK', `Health endpoint responded OK (Engine: ${health.body?.databaseEngine})`);
  } catch (e) {
    assert(false, `Health check failed: ${e.message}`);
  }

  // 2. Student Login
  let studentCookie = '';
  let studentToken = '';
  try {
    const res = await request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { email: 'vedant@campuscare.edu', password: 'student123' }
    });
    assert(res.body.success === true && res.body.user.roleName === 'student', 'Student login (Vedant Pomendkar)');
    studentToken = res.body.token;
    if (res.headers['set-cookie']) {
      studentCookie = res.headers['set-cookie'][0].split(';')[0];
    }
  } catch (e) {
    assert(false, `Student login failed: ${e.message}`);
  }

  // 3. Dept Admin Login
  let adminToken = '';
  try {
    const res = await request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { email: 'deptadmin@campuscare.edu', password: 'admin123' }
    });
    assert(res.body.success === true && res.body.user.roleName === 'dept_admin', 'Dept Admin login (Dr. Sandeep Kamble)');
    adminToken = res.body.token;
  } catch (e) {
    assert(false, `Dept Admin login failed: ${e.message}`);
  }

  // 4. Marketplace Items
  try {
    const res = await request('/api/v1/marketplace/items');
    assert(res.body.success && res.body.items.length >= 6, `Marketplace catalog fetched (${res.body.items.length} items listed)`);
  } catch (e) {
    assert(false, `Marketplace items query failed: ${e.message}`);
  }

  // 5. Submit Complaint & Check Auto Ticket Format (CMP-2026-XXXX)
  let createdTicketCode = '';
  let createdComplaintId = null;
  try {
    const res = await request('/api/v1/complaints', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`
      },
      body: {
        title: 'Air Conditioner thermostat not cooling in Lab 3',
        category: 'IT & Labs',
        location: 'Computer Science Lab 3, 3rd Floor',
        urgency: 'MEDIUM',
        description: 'The split AC unit is showing error E4 and blowing ambient air during afternoon practical batch.'
      }
    });
    assert(res.body.success && res.body.ticketCode && res.body.ticketCode.startsWith('CMP-'), `Complaint submitted with tracking code: ${res.body.ticketCode}`);
    createdTicketCode = res.body.ticketCode;
    createdComplaintId = res.body.complaintId;
  } catch (e) {
    assert(false, `Submit complaint failed: ${e.message}`);
  }

  // 6. Admin Update Complaint Status
  try {
    const res = await request(`/api/v1/complaints/${createdComplaintId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: {
        status: 'IN PROGRESS',
        resolution_notes: 'Technician dispatched to inspect AC filter and refrigerant levels.'
      }
    });
    assert(res.body.success, `Admin updated complaint status to IN PROGRESS with notes`);
  } catch (e) {
    assert(false, `Admin update complaint failed: ${e.message}`);
  }

  // 7. Lost & Found Algorithmic Matcher
  try {
    const res = await request('/api/v1/lost-found/matches');
    assert(res.body.success && res.body.matches.length > 0, `Algorithmic matcher identified ${res.body.matches.length} probable item overlap matches (Top score: ${res.body.matches[0]?.matchScore}%)`);
  } catch (e) {
    assert(false, `Lost & Found matcher failed: ${e.message}`);
  }

  // 8. Events & QR Gate Verification
  try {
    // Register for event 3
    const regRes = await request('/api/v1/events/register/3', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`
      }
    });
    assert(regRes.body.success && regRes.body.qrDataUrl, `Event registered with QR pass generated (${regRes.body.ticketCode})`);

    // Gate scan validation
    const verifyRes = await request('/api/v1/events/verify-pass', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: {
        ticket_code: regRes.body.ticketCode
      }
    });
    assert(verifyRes.body.success && verifyRes.body.status === 'VERIFIED', `Gate scanner verified pass: Entry Granted to ${verifyRes.body.pass.student_name}`);

    // Test duplicate entry prevention
    const dupRes = await request('/api/v1/events/verify-pass', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: {
        ticket_code: regRes.body.ticketCode
      }
    });
    assert(dupRes.body.status === 'ALREADY_USED', `Anti-proxy gate scanner blocked duplicate entry`);
  } catch (e) {
    assert(false, `Events & QR gate validation failed: ${e.message}`);
  }

  // 9. Admin Stats Overview
  try {
    const res = await request('/api/v1/admin/stats', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(res.body.success && res.body.stats.users.total >= 5, `Admin dashboard KPIs aggregated successfully`);
  } catch (e) {
    assert(false, `Admin stats failed: ${e.message}`);
  }

  console.log(`\n--- VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED ---\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
