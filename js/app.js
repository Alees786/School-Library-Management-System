// ============================================================
//  app.js — shared API client + utilities
//  !! Replace API_URL with your deployed Google Apps Script URL
// ============================================================

const API_URL = 'https://script.google.com/macros/s/AKfycbxqIItauWcjYDLgtWdqNArYABLsmld2PC13PcF48YmTZ33-L0VCev2fnOwK0F7Vx5XH/exec';

// ── API Client ────────────────────────────────────────────────

const api = {
  async call(data) {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify(data),
        redirect: 'follow'
      });
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); }
      catch { throw new Error('Invalid server response: ' + text.slice(0, 100)); }
      if (!json.success && json.error) throw new Error(json.error);
      return json;
    } catch (err) {
      showToast(err.message || 'Network error', 'error');
      throw err;
    }
  },

  login:            (d) => api.call({ action: 'login', ...d }),
  getBooks:         (d) => api.call({ action: 'getBooks', ...d }),
  addBook:          (d) => api.call({ action: 'addBook', ...d }),
  updateBook:       (d) => api.call({ action: 'updateBook', ...d }),
  deleteBook:       (d) => api.call({ action: 'deleteBook', ...d }),
  issueBook:        (d) => api.call({ action: 'issueBook', ...d }),
  returnBook:       (d) => api.call({ action: 'returnBook', ...d }),
  getIssuedBooks:   (d) => api.call({ action: 'getIssuedBooks', ...d }),
  reserveBook:      (d) => api.call({ action: 'reserveBook', ...d }),
  cancelReservation:(d) => api.call({ action: 'cancelReservation', ...d }),
  getReservations:  (d) => api.call({ action: 'getReservations', ...d }),
  getFines:         (d) => api.call({ action: 'getFines', ...d }),
  payFine:          (d) => api.call({ action: 'payFine', ...d }),
  getUsers:         (d) => api.call({ action: 'getUsers', ...d }),
  addUser:          (d) => api.call({ action: 'addUser', ...d }),
  deleteUser:       (d) => api.call({ action: 'deleteUser', ...d }),
  resetPassword:    (d) => api.call({ action: 'resetPassword', ...d }),
  getReports:       (d) => api.call({ action: 'getReports', ...d }),
};

// ── Auth Session ──────────────────────────────────────────────

const auth = {
  save(user, role) {
    sessionStorage.setItem('lms_user', JSON.stringify({ ...user, role }));
  },
  load() {
    try { return JSON.parse(sessionStorage.getItem('lms_user')); }
    catch { return null; }
  },
  clear() { sessionStorage.removeItem('lms_user'); },
  require(expectedRole) {
    const u = auth.load();
    if (!u) { window.location.href = 'index.html'; return null; }
    if (expectedRole && u.role !== expectedRole) {
      window.location.href = 'index.html'; return null;
    }
    return u;
  }
};

// ── Toast Notifications ───────────────────────────────────────

function showToast(msg, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ── Modal Helpers ─────────────────────────────────────────────

function openModal(id)  { document.getElementById(id)?.classList.add('active'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('active'); }
function closeAllModals() {
  document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
}

document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) closeAllModals();
  if (e.target.classList.contains('modal-close')) {
    e.target.closest('.modal-overlay')?.classList.remove('active');
  }
});

// ── Tab Helpers ───────────────────────────────────────────────

function initTabs(containerSelector) {
  document.querySelectorAll(containerSelector + ' .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      const parent = btn.closest('[data-tabs]') || btn.closest('.card') || document;
      parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      parent.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      parent.querySelector('#' + target)?.classList.add('active');
    });
  });
}

// ── Utility Functions ─────────────────────────────────────────

function formatDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysUntil(dateStr) {
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / 86400000);
}

function isOverdue(dueDateStr) {
  return new Date(dueDateStr) < new Date();
}

function statusBadge(status) {
  const map = {
    Issued: 'issued', Returned: 'returned', Overdue: 'overdue',
    Waiting: 'waiting', Fulfilled: 'fulfilled', Cancelled: 'cancelled',
    Unpaid: 'unpaid', Paid: 'paid'
  };
  return `<span class="badge badge-${map[status] || ''}">${status}</span>`;
}

function availabilityBadge(available) {
  return Number(available) > 0
    ? `<span class="badge badge-available">Available (${available})</span>`
    : `<span class="badge badge-unavailable">Unavailable</span>`;
}

function setLoading(btn, loading) {
  if (loading) {
    btn.dataset.orig = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span>';
    btn.disabled = true;
  } else {
    btn.innerHTML = btn.dataset.orig || btn.innerHTML;
    btn.disabled = false;
  }
}

function escHtml(str) {
  return String(str || '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

// ── Logout ────────────────────────────────────────────────────

function logout() {
  auth.clear();
  window.location.href = 'index.html';
}

// ── Render user in navbar ─────────────────────────────────────

function renderNavUser(user) {
  const el = document.getElementById('nav-user');
  if (!el || !user) return;
  el.innerHTML = `
    <span class="navbar-user">${escHtml(user.Name)}</span>
    <span class="badge-role badge-${user.role}">${user.role}</span>
    <button class="btn btn-sm btn-outline" style="color:#fff;border-color:rgba(255,255,255,0.4)" onclick="logout()">Logout</button>
  `;
}
