let editandoMecId = null;

async function onAppReady() {
  await cargarMecanicos();
  document.getElementById('btnNuevoMecanico')?.addEventListener('click', () => abrirModal());
  document.getElementById('btnGuardarMecanico').addEventListener('click', guardarMecanico);
}

async function cargarMecanicos() {
  try {
    const mecs = await API.get('/api/mecanicos');
    renderMecanicos(mecs);
  } catch {}
}

function renderMecanicos(mecs) {
  const el = document.getElementById('listaMecanicos');
  if (!mecs.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🔧</div><p>Sin mecánicos registrados</p></div>`;
    return;
  }
  const isAdmin = App.isAdmin();
  el.innerHTML = mecs.map(m => `
    <div class="card" style="margin-bottom:12px">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px">
        <div>
          <div style="font-size:1.05rem; font-weight:700">${esc(m.nombre)}</div>
          <div class="text-muted text-sm">${m.especialidad ? `🔧 ${esc(m.especialidad)}` : ''} ${m.telefono ? `· 📞 ${esc(m.telefono)}` : ''}</div>
          <div style="margin-top:8px; font-size:0.85rem; font-weight:600; color:var(--primary)">${m.ot_activas || 0} OT activa(s)</div>
        </div>
        ${isAdmin ? `<div style="display:flex; gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="abrirModal(${m.id})">Editar</button>
          <button class="btn btn-sm" style="border:1px solid var(--border); background:#fff; color:var(--text-muted)" onclick="desactivar(${m.id})">Dar de baja</button>
        </div>` : ''}
      </div>
    </div>`).join('');
}

function abrirModal(id = null) {
  editandoMecId = id;
  document.getElementById('mecModalTitle').textContent = id ? 'Editar mecánico' : 'Nuevo mecánico';
  ['mecNombre','mecTelefono','mecEspecialidad'].forEach(f => document.getElementById(f).value = '');
  App.openModal('modalMecanico');
  if (id) cargarDatos(id);
}

async function cargarDatos(id) {
  try {
    const m = await API.get(`/api/mecanicos/${id}`);
    document.getElementById('mecNombre').value = m.nombre || '';
    setPhone('mecTelefono', m.telefono);
    document.getElementById('mecEspecialidad').value = m.especialidad || '';
  } catch {}
}

async function guardarMecanico() {
  const body = {
    nombre: document.getElementById('mecNombre').value.trim(),
    telefono: document.getElementById('mecTelefono').value.trim(),
    especialidad: document.getElementById('mecEspecialidad').value.trim()
  };
  if (!body.nombre) return App.toast('El nombre es requerido', 'error');
  try {
    if (editandoMecId) await API.patch(`/api/mecanicos/${editandoMecId}`, body);
    else await API.post('/api/mecanicos', body);
    App.closeModal('modalMecanico');
    App.toast(editandoMecId ? 'Mecánico actualizado' : 'Mecánico creado', 'success');
    await cargarMecanicos();
  } catch (e) {
    App.toast(e.message || 'Error', 'error');
  }
}

async function desactivar(id) {
  if (!App.confirm('¿Dar de baja este mecánico? Ya no aparecerá en los selectores.')) return;
  try {
    await API.patch(`/api/mecanicos/${id}/activo`, { activo: false });
    App.toast('Mecánico dado de baja', 'success');
    await cargarMecanicos();
  } catch (e) {
    App.toast(e.message || 'Error', 'error');
  }
}
