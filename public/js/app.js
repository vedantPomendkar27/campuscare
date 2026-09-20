// CampusCare Main Frontend Helper
// Thakur Ramnarayan College of Arts and Commerce

const API_BASE = '/api/v1';

// Global notification / toast
function showToast(message, type = 'success') {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    toastContainer.style.zIndex = '9999';
    document.body.appendChild(toastContainer);
  }

  const toastEl = document.createElement('div');
  const bgClass = type === 'success' ? 'bg-success text-white' : type === 'error' ? 'bg-danger text-white' : 'bg-primary text-white';
  const icon = type === 'success' ? 'bi-check-circle' : type === 'error' ? 'bi-exclamation-triangle' : 'bi-info-circle';

  toastEl.className = `toast align-items-center ${bgClass} border-0 shadow-lg`;
  toastEl.setAttribute('role', 'alert');
  toastEl.setAttribute('aria-live', 'assertive');
  toastEl.setAttribute('aria-atomic', 'true');
  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body d-flex align-items-center gap-2">
        <i class="bi ${icon} fs-5"></i>
        <span>${message}</span>
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
  `;

  toastContainer.appendChild(toastEl);
  const bsToast = new bootstrap.Toast(toastEl, { delay: 4000 });
  bsToast.show();
  toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
}

// Fetch API Wrapper
async function fetchAPI(endpoint, options = {}) {
  try {
    options.credentials = 'include';
    if (!options.headers) {
      options.headers = {};
    }

    // If sending JSON body
    if (options.body && !(options.body instanceof FormData)) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    const res = await fetch(API_BASE + endpoint, options);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || `Request failed with status ${res.status}`);
    }
    return data;
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err);
    throw err;
  }
}

// Get Logged In User
async function getCurrentUser() {
  try {
    const data = await fetchAPI('/auth/me');
    return data.user;
  } catch (err) {
    return null;
  }
}

// Ensure Authenticated
async function requireAuth(allowedRoles = null) {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.pathname);
    return null;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    if (user.roleName !== 'super_admin' && !allowedRoles.includes(user.roleName)) {
      alert('Access restricted. Redirecting to your dashboard.');
      window.location.href = user.roleName === 'student' ? '/dashboard.html' : '/admin-dashboard.html';
      return null;
    }
  }

  return user;
}

// Redirect If Already Authenticated
async function redirectIfAuth() {
  const user = await getCurrentUser();
  if (user) {
    if (user.roleName === 'student') {
      window.location.href = '/dashboard.html';
    } else {
      window.location.href = '/admin-dashboard.html';
    }
  }
}

// Logout
async function logout() {
  try {
    await fetchAPI('/auth/logout', { method: 'POST' });
  } catch (e) {}
  localStorage.clear();
  window.location.href = '/login.html';
}

// Navigation Bar Component
function renderNavbar(activePage = '') {
  const navContainer = document.getElementById('navbar-mount');
  if (!navContainer) return;

  getCurrentUser().then(user => {
    const isAuth = !!user;
    const isStudent = user && user.roleName === 'student';
    const isAdmin = user && (user.roleName === 'dept_admin' || user.roleName === 'super_admin');
    const isSuperAdmin = user && user.roleName === 'super_admin';

    let navHtml = `
    <nav class="navbar navbar-expand-lg navbar-custom sticky-top">
      <div class="container-fluid">
        <a class="navbar-brand d-flex align-items-center gap-2" href="${isAuth ? (isAdmin ? '/admin-dashboard.html' : '/dashboard.html') : '/index.html'}">
          <img src="/images/logo.svg" alt="CampusCare Logo" height="38">
        </a>
        <button class="navbar-toggler border-0" type="button" data-bs-toggle="collapse" data-bs-target="#navContent">
          <span class="navbar-toggler-icon"></span>
        </button>

        <div class="collapse navbar-collapse" id="navContent">
          <ul class="navbar-nav me-auto mb-2 mb-lg-0 ms-lg-3 gap-1">
            ${isAuth ? `
              <li class="nav-item">
                <a class="nav-link ${activePage === 'dashboard' ? 'active' : ''}" href="${isAdmin ? '/admin-dashboard.html' : '/dashboard.html'}">
                  <i class="bi bi-speedometer2 me-1"></i> Dashboard
                </a>
              </li>
              <li class="nav-item">
                <a class="nav-link ${activePage === 'marketplace' ? 'active' : ''}" href="/marketplace.html">
                  <i class="bi bi-shop me-1"></i> Marketplace
                </a>
              </li>
              <li class="nav-item">
                <a class="nav-link ${activePage === 'lostfound' ? 'active' : ''}" href="/lost-found.html">
                  <i class="bi bi-search me-1"></i> Lost & Found
                </a>
              </li>
              <li class="nav-item">
                <a class="nav-link ${activePage === 'complaints' ? 'active' : ''}" href="${isAdmin ? '/admin-dashboard.html#complaints-desk' : '/complaints.html'}">
                  <i class="bi bi-shield-exclamation me-1"></i> Complaints
                </a>
              </li>
              <li class="nav-item">
                <a class="nav-link ${activePage === 'events' ? 'active' : ''}" href="/events.html">
                  <i class="bi bi-calendar-event me-1"></i> Events
                </a>
              </li>
              ${isAdmin ? `
              <li class="nav-item">
                <a class="nav-link ${activePage === 'scanner' ? 'active' : ''}" href="/gate-scanner.html">
                  <i class="bi bi-qr-code-scan me-1"></i> Gate Scanner
                </a>
              </li>
              ` : ''}
            ` : `
              <li class="nav-item"><a class="nav-link ${activePage === 'home' ? 'active' : ''}" href="/index.html">Home</a></li>
              <li class="nav-item"><a class="nav-link" href="/index.html#features">Features</a></li>
              <li class="nav-item"><a class="nav-link" href="/index.html#about">About</a></li>
            `}
          </ul>

          <div class="d-flex align-items-center gap-2">
            ${isAuth ? `
              <!-- Emergency SOS Trigger Button -->
              <button class="btn btn-sos btn-sm d-flex align-items-center gap-1" onclick="triggerSOSModal()">
                <i class="bi bi-exclamation-octagon-fill"></i> SOS Alert
              </button>

              <!-- Notifications Dropdown -->
              <div class="dropdown">
                <button class="btn btn-light rounded-circle p-2 position-relative" type="button" data-bs-toggle="dropdown" id="notif-btn" aria-expanded="false" onclick="loadNotifications()">
                  <i class="bi bi-bell fs-5 text-secondary"></i>
                  <span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger d-none" id="notif-badge">
                    0
                  </span>
                </button>
                <div class="dropdown-menu dropdown-menu-end shadow-lg p-0" style="width: 320px; max-height: 400px; overflow-y: auto;">
                  <div class="p-2 border-bottom bg-light d-flex justify-content-between align-items-center">
                    <span class="fw-bold small">Campus Notifications</span>
                    <button class="btn btn-link btn-sm p-0 text-decoration-none text-muted" onclick="markAllNotificationsRead()">Mark all read</button>
                  </div>
                  <div id="notif-list" class="p-2">
                    <div class="text-center text-muted small py-3">Loading updates...</div>
                  </div>
                </div>
              </div>

              <!-- User Menu Dropdown -->
              <div class="dropdown">
                <button class="btn btn-light border d-flex align-items-center gap-2 rounded-pill px-3 py-1" type="button" data-bs-toggle="dropdown">
                  <img src="${user.avatarUrl || '/images/default-avatar.svg'}" alt="Avatar" class="rounded-circle" width="28" height="28" style="object-fit: cover;">
                  <span class="small fw-semibold text-truncate" style="max-width: 120px;">${user.fullName.split(' ')[0]}</span>
                  <span class="badge ${user.roleName === 'super_admin' ? 'bg-danger' : user.roleName === 'dept_admin' ? 'bg-warning text-dark' : 'bg-primary'} font-monospace" style="font-size: 0.65rem;">
                    ${user.roleName === 'super_admin' ? 'SUPER ADMIN' : user.roleName === 'dept_admin' ? 'DEPT ADMIN' : 'STUDENT'}
                  </span>
                </button>
                <ul class="dropdown-menu dropdown-menu-end shadow border-0 mt-2">
                  <li class="px-3 py-2 border-bottom">
                    <div class="fw-bold small text-dark">${user.fullName}</div>
                    <div class="text-muted small">${user.email}</div>
                    <div class="text-muted" style="font-size: 0.75rem;">${user.department} • ${user.rollNumber}</div>
                  </li>
                  <li><a class="dropdown-item py-2" href="/profile.html"><i class="bi bi-person-gear me-2"></i> Profile Settings</a></li>
                  ${isAdmin ? `<li><a class="dropdown-item py-2" href="/admin-dashboard.html"><i class="bi bi-speedometer2 me-2"></i> Admin Workspace</a></li>` : ''}
                  <li><hr class="dropdown-divider"></li>
                  <li><a class="dropdown-item py-2 text-danger" href="javascript:void(0)" onclick="logout()"><i class="bi bi-box-arrow-right me-2"></i> Log Out</a></li>
                </ul>
              </div>
            ` : `
              <a href="/login.html" class="btn btn-outline-primary btn-sm px-3 fw-semibold">Sign In</a>
              <a href="/register.html" class="btn btn-primary btn-sm px-3 fw-semibold">Register</a>
            `}
          </div>
        </div>
      </div>
    </nav>
    `;

    navContainer.innerHTML = navHtml;

    if (isAuth) {
      updateUnreadNotifCount();
    }
  });
}

// Notification Helpers
async function updateUnreadNotifCount() {
  try {
    const data = await fetchAPI('/notifications');
    const badge = document.getElementById('notif-badge');
    if (badge) {
      if (data.unreadCount > 0) {
        badge.innerText = data.unreadCount > 9 ? '9+' : data.unreadCount;
        badge.classList.remove('d-none');
      } else {
        badge.classList.add('d-none');
      }
    }
  } catch (e) {}
}

async function loadNotifications() {
  const container = document.getElementById('notif-list');
  if (!container) return;
  try {
    const data = await fetchAPI('/notifications');
    if (!data.notifications || data.notifications.length === 0) {
      container.innerHTML = '<div class="text-center text-muted small py-3">No notifications yet.</div>';
      return;
    }

    container.innerHTML = data.notifications.map(n => `
      <div class="p-2 border-bottom rounded ${n.is_read ? 'opacity-75' : 'bg-light fw-semibold'} mb-1" style="font-size: 0.82rem;">
        <div class="d-flex justify-content-between align-items-start">
          <div class="text-primary fw-bold">${n.title}</div>
          <span class="text-muted" style="font-size: 0.7rem;">${new Date(n.created_at).toLocaleDateString()}</span>
        </div>
        <div class="text-muted mt-1">${n.message}</div>
        ${n.link ? `<a href="${n.link}" class="btn btn-link btn-sm p-0 mt-1 text-decoration-none" style="font-size: 0.75rem;">View details &rarr;</a>` : ''}
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = '<div class="text-danger small p-2">Failed to load updates.</div>';
  }
}

async function markAllNotificationsRead() {
  try {
    await fetchAPI('/notifications/read-all', { method: 'PUT' });
    updateUnreadNotifCount();
    loadNotifications();
    showToast('Notifications cleared');
  } catch (e) {}
}

// Emergency SOS Modal Logic
function triggerSOSModal() {
  let modalEl = document.getElementById('sos-modal');
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = 'sos-modal';
    modalEl.className = 'modal fade';
    modalEl.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content border-danger border-2">
          <div class="modal-header bg-danger text-white">
            <h5 class="modal-title fw-bold"><i class="bi bi-exclamation-triangle-fill me-2"></i> Emergency Campus SOS</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body p-4 text-center">
            <div class="display-4 text-danger mb-2"><i class="bi bi-shield-fill-exclamation"></i></div>
            <h5 class="fw-bold text-dark">Trigger Immediate Emergency Alert?</h5>
            <p class="text-muted small">
              This will instantly broadcast your live GPS coordinates, contact details, and name to Campus Security, Medical Cell, and Department Administrators.
            </p>
            <div class="mb-3 text-start">
              <label class="form-label small fw-semibold">Specific Location / Landmark on Campus:</label>
              <input type="text" id="sos-landmark" class="form-control" placeholder="e.g. 3rd Floor CS Lab corridor, Near Canteen stairs">
            </div>
            <button id="sos-confirm-btn" class="btn btn-danger btn-lg w-100 fw-bold shadow-sm" onclick="sendSOSAlert()">
              <i class="bi bi-broadcast me-1"></i> BROADCAST SOS NOW
            </button>
            <div id="sos-status-msg" class="mt-2 small"></div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modalEl);
  }
  const bsModal = new bootstrap.Modal(modalEl);
  bsModal.show();
}

async function sendSOSAlert() {
  const btn = document.getElementById('sos-confirm-btn');
  const msg = document.getElementById('sos-status-msg');
  const landmark = document.getElementById('sos-landmark')?.value;

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Acquiring GPS & Broadcasting...';

  let lat = 19.2568;
  let lng = 72.8687;

  if (navigator.geolocation) {
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 });
      });
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch (e) {
      console.log('GPS error/timeout, using default campus coordinate.');
    }
  }

  try {
    const data = await fetchAPI('/sos/trigger', {
      method: 'POST',
      body: {
        latitude: lat,
        longitude: lng,
        location_name: landmark || 'Thakur Ramnarayan Campus'
      }
    });

    btn.className = 'btn btn-success btn-lg w-100 fw-bold';
    btn.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i> SOS ACTIVE & BROADCASTED';
    msg.className = 'text-success fw-bold mt-2 small';
    msg.innerText = data.message;
    showToast('🚨 Emergency SOS alert dispatched to Security Desk!', 'error');
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-broadcast me-1"></i> Retry SOS Broadcast';
    msg.className = 'text-danger small mt-2';
    msg.innerText = 'Error: ' + err.message;
  }
}

// Helpers
function formatCurrency(amount) {
  if (!amount || amount === 0) return 'Free';
  return '₹' + parseFloat(amount).toFixed(2);
}

function getUrgencyBadge(urgency) {
  switch (urgency) {
    case 'EMERGENCY': return '<span class="badge bg-danger">EMERGENCY</span>';
    case 'HIGH': return '<span class="badge bg-warning text-dark">HIGH</span>';
    case 'MEDIUM': return '<span class="badge bg-info text-dark">MEDIUM</span>';
    default: return '<span class="badge bg-secondary">LOW</span>';
  }
}

function getComplaintStatusBadge(status) {
  switch (status) {
    case 'SUBMITTED': return '<span class="badge badge-sub">SUBMITTED</span>';
    case 'UNDER REVIEW': return '<span class="badge badge-review">UNDER REVIEW</span>';
    case 'IN PROGRESS': return '<span class="badge badge-progress">IN PROGRESS</span>';
    case 'RESOLVED': return '<span class="badge badge-resolved">RESOLVED</span>';
    case 'CLOSED': return '<span class="badge badge-closed">CLOSED</span>';
    default: return `<span class="badge bg-secondary">${status}</span>`;
  }
}
