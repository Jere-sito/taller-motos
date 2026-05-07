const App = {
  currentUser: null,

  async init() {
    try {
      this.currentUser = await API.get('/api/auth/me');
    } catch {
      this.currentUser = { userId: 1, username: 'dev', displayName: 'Desarrollo', role: 'admin', mecanico_id: null };
    }
    this._renderUserMenu();
    this._highlightNav();
    this._injectBottomNav();
    if (typeof onAppReady === 'function') onAppReady();
  },

  _renderUserMenu() {
    const el = document.getElementById('userDisplayName');
    if (el) el.textContent = this.currentUser.displayName;

    const roleBadge = document.getElementById('userRoleBadge');
    if (roleBadge) {
      const labels = { admin: 'Admin', mecanico: 'Mecánico', recepcion: 'Recepción' };
      roleBadge.textContent = labels[this.currentUser.role] || this.currentUser.role;
      roleBadge.dataset.role = this.currentUser.role;
    }

    // Ocultar elementos según rol
    document.querySelectorAll('[data-require-role]').forEach(el => {
      const roles = el.dataset.requireRole.split(',');
      if (!roles.includes(this.currentUser.role)) el.style.display = 'none';
    });
  },

  _highlightNav() {
    const path = window.location.pathname;
    document.querySelectorAll('.nav-link').forEach(a => {
      a.classList.toggle('active', a.getAttribute('href') === path || (path === '/' && a.getAttribute('href') === '/'));
    });
  },

  _injectBottomNav() {
    if (document.querySelector('.bottom-nav')) return;
    const path = window.location.pathname;
    const role = this.currentUser?.role;
    const items = [
      { href: '/',          icon: '📊', label: 'Inicio' },
      { href: '/ordenes',   icon: '📋', label: 'Órdenes' },
      { href: '/clientes',  icon: '👤', label: 'Clientes' },
      { href: '/motos',     icon: '🏍️', label: 'Motos' },
      { href: '/mecanicos', icon: '🔧', label: 'Mecánicos', roles: ['admin', 'recepcion'] },
    ];
    const nav = document.createElement('nav');
    nav.className = 'bottom-nav';
    nav.innerHTML = items
      .filter(item => !item.roles || item.roles.includes(role))
      .map(item => {
        const active = path === item.href;
        return `<a href="${item.href}" class="bottom-nav-item${active ? ' active' : ''}">
          <span class="bnav-icon">${item.icon}</span>
          <span>${item.label}</span>
        </a>`;
      }).join('');
    document.body.appendChild(nav);
  },

  toast(msg, type = 'info', duration = 3000) {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      document.body.appendChild(container);
    }
    const t = document.createElement('div');
    t.className = `toast toast--${type}`;
    t.textContent = msg;
    container.appendChild(t);
    requestAnimationFrame(() => t.classList.add('toast--show'));
    setTimeout(() => {
      t.classList.remove('toast--show');
      setTimeout(() => t.remove(), 300);
    }, duration);
  },

  confirm(msg) {
    return window.confirm(msg);
  },

  openModal(id) {
    const m = document.getElementById(id);
    if (m) { m.classList.remove('hidden'); m.querySelector('input,textarea,select')?.focus(); }
  },

  closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('hidden');
  },

  isAdmin() { return this.currentUser?.role === 'admin'; },
  isMecanico() { return this.currentUser?.role === 'mecanico'; },
  isRecepcion() { return this.currentUser?.role === 'recepcion'; },
  canEdit() { return this.currentUser?.role !== 'mecanico'; }
};

// Helper para escapar HTML
function esc(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Formatear fecha legible
function fmtDate(str) {
  if (!str) return '—';
  const d = new Date(str);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtDateTime(str) {
  if (!str) return '—';
  const d = new Date(str);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtMoney(n) {
  if (n == null || isNaN(n)) return '$0';
  return '$' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// Auto-formato de teléfono argentino: XX-XXXX-XXXX
function formatPhone(raw) {
  const d = String(raw || '').replace(/\D/g, '').slice(0, 10);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}`;
}

// Establece un campo tel con formato; usar en lugar de .value = x
function setPhone(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = formatPhone(val);
}

// Cerrar modal con Escape
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden'));
});

// Logout
document.addEventListener('click', async e => {
  if (!e.target.closest('#btnLogout')) return;
  await API.post('/api/auth/logout', {});
  window.location.href = '/login';
});

document.addEventListener('DOMContentLoaded', () => {
  // Aplicar auto-formato a todos los inputs tel de la página
  document.querySelectorAll('input[type="tel"]').forEach(input => {
    input.addEventListener('input', () => {
      const pos = input.selectionStart;
      const prev = input.value;
      input.value = formatPhone(prev);
      // Mantener cursor aproximado si el largo no cambió
      if (input.value.length === prev.length) input.setSelectionRange(pos, pos);
    });
  });
  App.init();
});
