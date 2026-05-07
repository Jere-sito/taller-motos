let editandoMotoId = null;
let timer;
const _motosData = {};

async function onAppReady() {
  await cargarMotos();
  document.getElementById('btnGuardarMoto').addEventListener('click', guardarMoto);
  document.getElementById('searchQ').addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(cargarMotos, 350);
  });
}

async function cargarMotos() {
  const q = document.getElementById('searchQ').value;
  try {
    const motos = await API.get(`/api/motos?q=${encodeURIComponent(q)}`);
    renderMotos(motos);
  } catch {}
}

function renderMotos(motos) {
  const tbody = document.getElementById('tablaMotos');
  if (!motos.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">Sin resultados</td></tr>`;
    return;
  }
  const canEdit = App.canEdit();
  motos.forEach(m => { _motosData[m.id] = m; });
  tbody.innerHTML = motos.map(m => `
    <tr>
      <td><strong style="letter-spacing:2px">${esc(m.patente)}</strong></td>
      <td>${esc(m.marca)} ${esc(m.modelo)} ${m.anio ? `(${m.anio})` : ''}</td>
      <td>${esc(m.cliente_nombre)}</td>
      <td>${m.cant_ot || 0}</td>
      <td style="text-align:right; white-space:nowrap">
        ${canEdit ? `<button class="btn btn-secondary btn-sm" onclick="abrirModal(${m.id})">Editar</button>` : ''}
        ${canEdit ? `<button class="btn btn-sm" style="margin-left:4px; color:#EF4444; border:1px solid #FCA5A5; background:#fff" onclick="eliminarMoto(${m.id})">✕</button>` : ''}
      </td>
    </tr>`).join('');
}

function abrirModal(id) {
  editandoMotoId = id;
  App.openModal('modalMoto');
  cargarDatosMoto(id);
}

async function cargarDatosMoto(id) {
  try {
    const m = await API.get(`/api/motos/${id}`);
    document.getElementById('mPatente').value = m.patente || '';
    document.getElementById('mMarca').value = m.marca || '';
    document.getElementById('mModelo').value = m.modelo || '';
    document.getElementById('mAnio').value = m.anio || '';
    document.getElementById('mColor').value = m.color || '';
    document.getElementById('mNotas').value = m.notas || '';
  } catch {}
}

function eliminarMoto(id) {
  const m = _motosData[id];
  if (!m) return;
  const desc = [m.marca, m.modelo, m.anio ? `(${m.anio})` : ''].filter(Boolean).join(' ');
  const tieneOTs = (m.cant_ot || 0) > 0;
  App.confirmarDoble(
    'Eliminar moto',
    `${m.patente}${desc ? ' — ' + desc : ''}`,
    `¿Eliminar la moto <strong>${esc(m.patente)}</strong>${desc ? ` (${esc(desc)})` : ''}?${tieneOTs ? `<br><span style="color:#DC2626;font-size:0.85rem">También se eliminarán sus ${m.cant_ot} orden(es) de trabajo y todo su historial.</span>` : ''}`,
    async () => {
      try {
        await API.del(`/api/motos/${id}`);
        App.toast('Moto eliminada', 'success');
        await cargarMotos();
      } catch (e) {
        App.toast(e.message || 'No se puede eliminar', 'error');
      }
    }
  );
}

async function guardarMoto() {
  if (!editandoMotoId) return;
  const body = {
    marca: document.getElementById('mMarca').value.trim(),
    modelo: document.getElementById('mModelo').value.trim(),
    anio: document.getElementById('mAnio').value || null,
    color: document.getElementById('mColor').value.trim(),
    notas: document.getElementById('mNotas').value.trim()
  };
  try {
    await API.patch(`/api/motos/${editandoMotoId}`, body);
    App.closeModal('modalMoto');
    App.toast('Moto actualizada', 'success');
    await cargarMotos();
  } catch (e) {
    App.toast(e.message || 'Error', 'error');
  }
}
