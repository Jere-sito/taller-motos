const App = {
  currentUser: null,

  async init() {
    try {
      this.currentUser = await API.get('/api/auth/me');
    } catch {
      this.currentUser = { userId: 1, username: 'dev', displayName: 'Desarrollo', role: 'admin', mecanico_id: null };
    }
    this._renderUserMenu();
    this._renderSidebarUser();
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

  _renderSidebarUser() {
    const u = this.currentUser;
    if (!u) return;
    const initials = (u.displayName || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const avatarEl = document.getElementById('sidebarAvatar');
    const nameEl   = document.getElementById('sidebarUserName');
    const roleEl   = document.getElementById('sidebarUserRole');
    if (avatarEl) avatarEl.textContent = initials;
    if (nameEl)   nameEl.textContent = u.displayName || '';
    if (roleEl) {
      const labels = { admin: 'Admin', mecanico: 'Mecánico', recepcion: 'Recepción' };
      roleEl.textContent = labels[u.role] || u.role || '';
    }
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
    const SVG_HOME   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
    const SVG_ORDERS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
    const SVG_PERSON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    const SVG_MOTO   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="17" r="2.5"/><circle cx="18" cy="17" r="2.5"/><path d="M4.5 17H2v-4l4-6h8l2 5h3.5"/><path d="M11 11V6"/></svg>`;
    const items = [
      { href: '/',         icon: SVG_HOME,   label: 'Inicio' },
      { href: '/ordenes',  icon: SVG_ORDERS, label: 'Órdenes' },
      { href: '/clientes', icon: SVG_PERSON, label: 'Clientes' },
      { href: '/motos',    icon: SVG_MOTO,   label: 'Motos' },
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

  confirmarDoble(titulo, nombreItem, lineaDetalle, callback) {
    const uid = '_cdm_' + Date.now();
    const overlay = document.createElement('div');
    overlay.className = 'modal';
    overlay.id = uid;
    overlay.innerHTML = `
      <div class="modal-box" style="max-width:420px">
        <div id="${uid}_s1">
          <div class="modal-header">
            <h2 class="modal-title">${esc(titulo)}</h2>
          </div>
          <p style="margin:16px 0; font-size:0.95rem">${lineaDetalle}</p>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="${uid}_c1">Cancelar</button>
            <button class="btn btn-primary" id="${uid}_nx">Continuar →</button>
          </div>
        </div>
        <div id="${uid}_s2" class="hidden">
          <div class="modal-header">
            <h2 class="modal-title" style="color:#DC2626">⚠️ Confirmar eliminación</h2>
          </div>
          <div style="background:#FEF2F2; border:1px solid #FCA5A5; border-radius:8px; padding:14px; margin:16px 0; font-size:0.9rem">
            Esta acción <strong>no se puede deshacer</strong>. Se eliminará permanentemente:<br>
            <span style="font-weight:700; margin-top:6px; display:block">${esc(nombreItem)}</span>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="${uid}_bk">← Volver</button>
            <button class="btn" style="background:#DC2626;color:#fff;border:none;padding:9px 18px;border-radius:8px;font-weight:600;cursor:pointer" id="${uid}_ok">🗑️ Eliminar definitivamente</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    document.getElementById(`${uid}_c1`).onclick = close;
    document.getElementById(`${uid}_nx`).onclick = () => {
      document.getElementById(`${uid}_s1`).classList.add('hidden');
      document.getElementById(`${uid}_s2`).classList.remove('hidden');
    };
    document.getElementById(`${uid}_bk`).onclick = () => {
      document.getElementById(`${uid}_s2`).classList.add('hidden');
      document.getElementById(`${uid}_s1`).classList.remove('hidden');
    };
    document.getElementById(`${uid}_ok`).onclick = () => { close(); callback(); };
  },

  // Bloquea touchmove fuera del modal (previene scroll del fondo en iOS)
  _blockScroll(e) {
    if (e.target.closest('.modal')) return;
    e.preventDefault();
  },

  openModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    if (!document.body.dataset.scrollLock) {
      document.body.dataset.scrollLock = '1';
      document.addEventListener('touchmove', App._blockScroll, { passive: false });
    }
    document.body.classList.add('modal-open');
    m.classList.remove('hidden');
    m.querySelector('input,textarea,select')?.focus();
  },

  closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('hidden');
    if (!document.querySelector('.modal:not(.hidden)')) {
      document.removeEventListener('touchmove', App._blockScroll);
      delete document.body.dataset.scrollLock;
      document.body.classList.remove('modal-open');
    }
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

// Link directo de WhatsApp con prefijo argentino 549
function waLink(telefono) {
  const digits = String(telefono || '').replace(/\D/g, '');
  if (!digits || digits.length < 8) return null;
  let num;
  if (digits.startsWith('549') && digits.length >= 13) num = digits;
  else if (digits.startsWith('54') && digits.length >= 12) num = '549' + digits.slice(2);
  else num = '549' + digits;
  return `https://wa.me/${num}`;
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

// ── Mayúsculas globales ───────────────────────────────────────────────────
// NO se modifica el valor durante el tipeo (rompería el autocorrector de iOS).
// CSS text-transform:uppercase muestra mayúsculas visualmente.
// La conversión real del valor ocurre en focusout (al salir del campo).
document.addEventListener('focusout', e => {
  const el = e.target;
  if (el.classList.contains('input-precio')) return;
  const type = (el.getAttribute('type') || '').toLowerCase();
  const skip = ['email','password','date','number','color','file','range','time','url','radio','checkbox'];
  if (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !skip.includes(type))) {
    el.value = el.value.toUpperCase();
  }
});

// ── Formato de precio (.input-precio) ────────────────────────────────────
document.addEventListener('focusin', e => {
  if (!e.target.classList?.contains('input-precio')) return;
  e.target.value = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '');
});
document.addEventListener('focusout', e => {
  if (!e.target.classList?.contains('input-precio')) return;
  const n = parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0;
  e.target.value = n > 0 ? n.toLocaleString('es-AR') : '';
});
document.addEventListener('input', e => {
  if (!e.target.classList?.contains('input-precio')) return;
  const raw = e.target.value.replace(/[^0-9]/g, '');
  e.target.value = raw ? parseInt(raw).toLocaleString('es-AR') : '';
  const len = e.target.value.length;
  try { e.target.setSelectionRange(len, len); } catch {}
});


document.addEventListener('DOMContentLoaded', () => {
  // Aplicar auto-formato a todos los inputs tel de la página
  document.querySelectorAll('input[type="tel"]').forEach(input => {
    input.addEventListener('input', () => {
      const pos = input.selectionStart;
      const prev = input.value;
      input.value = formatPhone(prev);
      if (input.value.length === prev.length) input.setSelectionRange(pos, pos);
    });
  });

  // Textareas modo lista: Enter inserta nuevo ítem con guión
  function initListTextarea(el) {
    if (el.dataset.listInit) return;
    el.dataset.listInit = '1';
    el.addEventListener('focus', () => {
      if (!el.value.trim()) { el.value = '- '; el.selectionStart = el.selectionEnd = 2; }
    });
    el.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const pos = el.selectionStart;
      el.value = el.value.slice(0, pos) + '\n- ' + el.value.slice(el.selectionEnd);
      el.selectionStart = el.selectionEnd = pos + 3;
    });
  }
  document.querySelectorAll('textarea.textarea-list').forEach(initListTextarea);

  App.init();
});
