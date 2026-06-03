let editandoId = null;
let timer;
const _clientesData = {};

const ICON_PHONE = `<svg class="contact-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>`;
const ICON_MAIL = `<svg class="contact-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2 4 12 13 22 4"/></svg>`;
const ICON_EDIT = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const ICON_TRASH = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
const CHEVRON_DOWN = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
const CHEVRON_UP = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`;
const MOTO_ICON = `<svg class="moto-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="3"/><circle cx="18.5" cy="17.5" r="3"/><path d="M8.5 17.5h7M15 6h-4l-2.5 5.5H2"/><path d="M15 6l3.5 5.5"/><path d="M10 6l-1 5.5"/></svg>`;

function avatarInit(nombre) {
  const parts = (nombre || '').trim().split(/\s+/).filter(Boolean);
  const a = (parts[0] || '')[0] || '';
  const b = (parts[1] || '')[0] || '';
  return (a + b).toUpperCase() || '?';
}

async function onAppReady() {
  await cargarClientes();
  document.getElementById('btnNuevoCliente')?.addEventListener('click', () => abrirModal());
  document.getElementById('btnGuardarCliente').addEventListener('click', guardarCliente);
  document.getElementById('searchQ').addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(cargarClientes, 350);
  });
}

async function cargarClientes() {
  const q = document.getElementById('searchQ').value;
  try {
    const clientes = await API.get(`/api/clientes?q=${encodeURIComponent(q)}&limit=100`);
    renderClientes(clientes);
  } catch {}
}

function renderClientes(clientes) {
  const el = document.getElementById('listaClientes');
  const stat = document.getElementById('statClientes');
  if (stat) stat.textContent = clientes.length === 1 ? '1 cliente registrado' : `${clientes.length} clientes registrados`;

  if (!clientes.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><p>Sin resultados</p></div>`;
    return;
  }
  const canEdit = App.canEdit();
  clientes.forEach(c => { _clientesData[c.id] = c; });
  el.innerHTML = clientes.map(c => {
    const n    = c.cant_motos || 0;
    const wa   = waLink(c.telefono);
    const chip = n > 0
      ? `<span class="moto-chip">${n} moto${n > 1 ? 's' : ''}</span>`
      : `<span class="moto-chip gray">Sin motos</span>`;
    return `
    <div class="client-card" data-id="${c.id}">
      <div class="card-row-1">
        <div class="client-avatar">${esc(avatarInit(c.nombre))}</div>
        <span class="client-name">${esc(c.nombre)}</span>
        ${chip}
        ${canEdit ? `<div class="cli-actions">
          <button onclick="abrirModal(${c.id})" title="Editar" style="color:var(--text-muted)">${ICON_EDIT}</button>
          <button onclick="eliminarCliente(${c.id})" title="Eliminar" style="color:#EF4444">${ICON_TRASH}</button>
        </div>` : ''}
      </div>
      ${(c.telefono || c.email) ? `<div class="card-contact">
        ${c.telefono ? `<a class="contact-row" href="${wa || `tel:${esc(c.telefono.replace(/[^0-9+]/g,''))}`}" ${wa ? 'target="_blank"' : ''}>${ICON_PHONE}<span class="contact-text">${esc(c.telefono)}</span></a>` : ''}
        ${c.email ? `<div class="contact-row">${ICON_MAIL}<span class="contact-text email">${esc(c.email)}</span></div>` : ''}
      </div>` : ''}
      ${n > 0 ? `
        <button class="toggle-btn" id="toggleBtn-${c.id}" onclick="toggleMotos(${c.id})">${CHEVRON_DOWN}<span>Ver motos (${n})</span></button>
        <div class="moto-expand hidden" id="motos-${c.id}"></div>
      ` : ''}
    </div>`;
  }).join('');
}

async function toggleMotos(clienteId) {
  const div = document.getElementById(`motos-${clienteId}`);
  const btn = document.getElementById(`toggleBtn-${clienteId}`);
  if (!div) return;
  const n = _clientesData[clienteId]?.cant_motos || 0;

  if (!div.classList.contains('hidden')) {
    div.classList.add('hidden');
    if (btn) btn.innerHTML = `${CHEVRON_DOWN}<span>Ver motos (${n})</span>`;
    return;
  }

  if (btn) btn.innerHTML = `${CHEVRON_UP}<span>Ocultar motos (${n})</span>`;

  if (div.dataset.loaded) {
    div.classList.remove('hidden');
    return;
  }

  div.innerHTML = `<div class="text-sm text-muted" style="padding:4px">Cargando...</div>`;
  div.classList.remove('hidden');
  try {
    const c = await API.get(`/api/clientes/${clienteId}`);
    const motos = c.motos || [];
    if (!motos.length) {
      div.innerHTML = `<div class="text-sm text-muted" style="padding:4px">Sin motos registradas.</div>`;
    } else {
      div.innerHTML = motos.map(m => {
        const ots    = m.cant_ot || 0;
        const modelo = [m.marca, m.modelo].filter(Boolean).join(' ') + (m.color ? ` · ${m.color}` : '');
        return `<a class="moto-row" href="/ordenes?q=${encodeURIComponent(m.patente)}">
          ${MOTO_ICON}
          <div class="moto-info">
            <span class="moto-patente">${esc(m.patente)}</span>
            <span class="moto-modelo">${esc(modelo || '—')}</span>
          </div>
          ${ots ? `<span class="ot-chip">${ots} OT${ots !== 1 ? 's' : ''}</span>` : ''}
        </a>`;
      }).join('');
    }
    div.dataset.loaded = '1';
  } catch {
    div.innerHTML = `<div class="text-sm text-muted" style="padding:4px">Error al cargar.</div>`;
  }
}

function abrirModal(id = null) {
  editandoId = id;
  document.getElementById('clienteModalTitle').textContent = id ? 'Editar cliente' : 'Nuevo cliente';
  if (!id) {
    ['cNombre','cTelefono','cEmail','cNotas'].forEach(f => { const el = document.getElementById(f); if (el) el.value = ''; });
  }
  App.openModal('modalCliente');
  if (id) cargarDatosCliente(id);
}

async function cargarDatosCliente(id) {
  try {
    const c = await API.get(`/api/clientes/${id}`);
    document.getElementById('cNombre').value = c.nombre || '';
    setPhone('cTelefono', c.telefono);
    document.getElementById('cEmail').value = c.email || '';
    document.getElementById('cNotas').value = c.notas || '';
  } catch {}
}

async function guardarCliente() {
  const body = {
    nombre: document.getElementById('cNombre').value.trim(),
    telefono: document.getElementById('cTelefono').value.trim(),
    email: document.getElementById('cEmail').value.trim(),
    notas: document.getElementById('cNotas').value.trim()
  };
  if (!body.nombre) return App.toast('El nombre es requerido', 'error');
  try {
    if (editandoId) await API.patch(`/api/clientes/${editandoId}`, body);
    else await API.post('/api/clientes', body);
    App.closeModal('modalCliente');
    App.toast(editandoId ? 'Cliente actualizado' : 'Cliente creado', 'success');
    await cargarClientes();
  } catch (e) {
    App.toast(e.message || 'Error', 'error');
  }
}

function eliminarCliente(id) {
  const c = _clientesData[id];
  if (!c) return;
  const motos = c.cant_motos || 0;
  const linea = `¿Eliminar a <strong>${esc(c.nombre)}</strong>? Se eliminarán también ${motos > 0 ? `sus ${motos} moto(s) y ` : ''}todas sus órdenes (incluidas las de repuesto). Esta acción no se puede deshacer.`;
  App.confirmarDoble(
    'Eliminar cliente',
    c.nombre,
    linea,
    async () => {
      try {
        await API.del(`/api/clientes/${id}`);
        App.toast('Cliente eliminado', 'success');
        await cargarClientes();
      } catch (e) {
        App.toast(e.message || 'No se puede eliminar', 'error');
      }
    }
  );
}
