let editandoId = null;
let timer;
const _clientesData = {};

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
  if (!clientes.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><p>Sin resultados</p></div>`;
    return;
  }
  const canEdit = App.canEdit();
  clientes.forEach(c => { _clientesData[c.id] = c; });
  el.innerHTML = clientes.map(c => {
    const wa = waLink(c.telefono);
    return `
    <div>
      <div class="mecanico-card" style="border-radius: var(--radius-md) var(--radius-md) ${c.cant_motos ? '0 0' : 'var(--radius-md) var(--radius-md)'}">
        <div style="flex:1; min-width:0">
          <div style="font-size:1rem; font-weight:700; color:var(--text)">${esc(c.nombre)}</div>
          ${c.telefono ? `<div class="text-sm text-muted" style="margin-top:2px; white-space:nowrap">📞 ${esc(c.telefono)}</div>` : ''}
          ${c.email    ? `<div class="text-sm text-muted" style="margin-top:1px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">✉️ ${esc(c.email)}</div>` : ''}
          ${c.cant_motos ? `<button onclick="toggleMotos(${c.id})" style="margin-top:6px; background:none; border:none; cursor:pointer; padding:0; font-size:0.8125rem; font-weight:600; color:var(--primary)">🏍️ Ver motos (${c.cant_motos})</button>` : ''}
        </div>
        <div style="display:flex; flex-direction:column; gap:6px; flex-shrink:0; align-items:flex-end">
          ${wa ? `<a href="${wa}" target="_blank" class="btn btn-sm" style="color:#25D366; border:1px solid #25D366; background:#fff; text-decoration:none">💬 WhatsApp</a>` : ''}
          ${canEdit ? `<div style="display:flex; gap:6px">
            <button class="btn btn-secondary btn-sm" onclick="abrirModal(${c.id})">Editar</button>
            <button class="btn btn-sm" style="color:#EF4444; border:1px solid #FCA5A5; background:#fff" onclick="eliminarCliente(${c.id})">✕</button>
          </div>` : ''}
        </div>
      </div>
      ${c.cant_motos ? `<div id="motos-${c.id}" class="hidden" style="background:var(--bg-subtle); border:1px solid var(--border); border-top:none; border-radius:0 0 var(--radius-md) var(--radius-md); padding:12px 16px;"></div>` : ''}
    </div>`;
  }).join('');
}

async function toggleMotos(clienteId) {
  const div = document.getElementById(`motos-${clienteId}`);
  if (!div) return;

  if (!div.classList.contains('hidden')) {
    div.classList.add('hidden');
    return;
  }

  if (div.dataset.loaded) {
    div.classList.remove('hidden');
    return;
  }

  div.textContent = 'Cargando...';
  div.classList.remove('hidden');
  try {
    const c = await API.get(`/api/clientes/${clienteId}`);
    const motos = c.motos || [];
    if (!motos.length) {
      div.innerHTML = `<div class="text-sm text-muted">Sin motos registradas.</div>`;
    } else {
      div.innerHTML = motos.map(m => `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; padding:7px 0; border-bottom:1px solid var(--border)">
          <div>
            <span style="font-weight:700; letter-spacing:2px; font-size:0.9375rem">${esc(m.patente)}</span>
            <span class="text-sm text-muted" style="margin-left:8px">${esc(m.marca || '')} ${esc(m.modelo || '')}${m.color ? ` · ${esc(m.color)}` : ''}</span>
          </div>
          <div style="display:flex; align-items:center; gap:12px; flex-shrink:0">
            ${m.cant_ot ? `<span class="text-sm text-muted">${m.cant_ot} OT${m.cant_ot !== 1 ? 's' : ''}</span>` : ''}
            <a href="/ordenes?q=${encodeURIComponent(m.patente)}" class="btn btn-secondary btn-sm" style="text-decoration:none">Ver OTs</a>
          </div>
        </div>`).join('');
    }
    div.dataset.loaded = '1';
  } catch {
    div.innerHTML = `<div class="text-sm text-muted">Error al cargar.</div>`;
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
  const linea = motos > 0
    ? `¿Eliminar a <strong>${esc(c.nombre)}</strong>? También se eliminarán sus ${motos} moto(s) y todas sus órdenes.`
    : `¿Eliminar al cliente <strong>${esc(c.nombre)}</strong>?`;
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
