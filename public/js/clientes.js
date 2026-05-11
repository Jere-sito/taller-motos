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
    <div class="mecanico-card">
      <div style="flex:1; min-width:0">
        <div style="font-size:1rem; font-weight:700; color:var(--text)">${esc(c.nombre)}</div>
        ${c.telefono ? `<div class="text-sm text-muted" style="margin-top:2px; white-space:nowrap">📞 ${esc(c.telefono)}</div>` : ''}
        ${c.email    ? `<div class="text-sm text-muted" style="margin-top:1px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">✉️ ${esc(c.email)}</div>` : ''}
        ${c.cant_motos ? `<div style="margin-top:4px; font-size:0.8125rem; font-weight:600; color:var(--primary)">${c.cant_motos} moto(s)</div>` : ''}
      </div>
      <div style="display:flex; flex-direction:column; gap:6px; flex-shrink:0; align-items:flex-end">
        ${wa ? `<a href="${wa}" target="_blank" class="btn btn-sm" style="color:#25D366; border:1px solid #25D366; background:#fff; text-decoration:none">💬 WhatsApp</a>` : ''}
        ${canEdit ? `<div style="display:flex; gap:6px">
          <button class="btn btn-secondary btn-sm" onclick="abrirModal(${c.id})">Editar</button>
          <button class="btn btn-sm" style="color:#EF4444; border:1px solid #FCA5A5; background:#fff" onclick="eliminarCliente(${c.id})">✕</button>
        </div>` : ''}
      </div>
    </div>`;
  }).join('');
}

function abrirModal(id = null) {
  editandoId = id;
  document.getElementById('clienteModalTitle').textContent = id ? 'Editar cliente' : 'Nuevo cliente';
  if (!id) {
    ['cNombre','cTelefono','cEmail','cDireccion','cNotas'].forEach(f => document.getElementById(f).value = '');
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
    document.getElementById('cDireccion').value = c.direccion || '';
    document.getElementById('cNotas').value = c.notas || '';
  } catch {}
}

async function guardarCliente() {
  const body = {
    nombre: document.getElementById('cNombre').value.trim(),
    telefono: document.getElementById('cTelefono').value.trim(),
    email: document.getElementById('cEmail').value.trim(),
    direccion: document.getElementById('cDireccion').value.trim(),
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
