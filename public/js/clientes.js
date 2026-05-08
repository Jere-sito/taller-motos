let editandoId = null;
let timer;
const _clientesData = {};

function waLink(telefono) {
  const digits = String(telefono || '').replace(/\D/g, '');
  if (!digits) return null;
  const num = digits.startsWith('54') && digits.length >= 12 ? digits : '54' + digits;
  return `https://wa.me/${num}`;
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
  const tbody = document.getElementById('tablaClientes');
  if (!clientes.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">Sin resultados</td></tr>`;
    return;
  }
  const canEdit = App.canEdit();
  clientes.forEach(c => { _clientesData[c.id] = c; });
  tbody.innerHTML = clientes.map(c => `
    <tr>
      <td><strong>${esc(c.nombre)}</strong></td>
      <td>${esc(c.telefono || '—')}</td>
      <td class="col-hide-mobile">${esc(c.email || '—')}</td>
      <td class="col-hide-mobile">${c.cant_motos || 0}</td>
      <td style="text-align:right; white-space:nowrap">
        ${waLink(c.telefono) ? `<a href="${waLink(c.telefono)}" target="_blank" class="btn btn-sm" style="margin-right:4px; color:#25D366; border:1px solid #25D366; background:#fff; text-decoration:none">💬</a>` : ''}
        ${canEdit ? `<button class="btn btn-secondary btn-sm" onclick="abrirModal(${c.id})">Editar</button>` : ''}
        ${canEdit ? `<button class="btn btn-sm" style="margin-left:4px; color:#EF4444; border:1px solid #FCA5A5; background:#fff" onclick="eliminarCliente(${c.id})">✕</button>` : ''}
      </td>
    </tr>`).join('');
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
