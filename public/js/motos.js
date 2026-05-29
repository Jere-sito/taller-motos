let editandoMotoId = null;
let timer;
const _motosData = {};
let _allMotos = [];
let filtroMoto = '';

const M_THUMB = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M9 17.5h6M15 6h-5l-3 5.5"/><path d="M15 6l3 5.5"/><path d="M9 11.5h9"/><path d="M18.5 14l-3.5-8"/></svg>`;
const M_OWNER = `<svg class="owner-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
const M_CHEVRON = `<svg class="moto-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
const M_EDIT = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const M_TRASH = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;

const COLOR_MAP = {
  rojo: '#DC2626', negro: '#0F172A', blanco: '#FFFFFF', azul: '#1D4ED8',
  celeste: '#38BDF8', verde: '#16A34A', gris: '#6B7280', plata: '#9CA3AF',
  gris_plata: '#9CA3AF', amarillo: '#EAB308', naranja: '#EA580C', bordo: '#7F1D1D',
  bordó: '#7F1D1D', violeta: '#7C3AED', rosa: '#EC4899', marron: '#92400E',
  marrón: '#92400E', dorado: '#CA8A04'
};
function colorHex(color) {
  if (!color) return null;
  const key = color.trim().toLowerCase().split(/[\s/]+/)[0];
  return COLOR_MAP[key] || null;
}

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
    _allMotos = await API.get(`/api/motos?q=${encodeURIComponent(q)}`);
    _allMotos.forEach(m => { _motosData[m.id] = m; });
    renderChips();
    aplicarFiltro();
  } catch {}
}

function renderChips() {
  const cont = document.getElementById('chipsMoto');
  if (!cont) return;
  const total   = _allMotos.length;
  const enTaller = _allMotos.filter(m => (m.ot_activas || 0) > 0).length;

  // Marcas más frecuentes (top 4)
  const conteoMarca = {};
  _allMotos.forEach(m => {
    const marca = (m.marca || '').trim();
    if (marca) conteoMarca[marca] = (conteoMarca[marca] || 0) + 1;
  });
  const marcas = Object.keys(conteoMarca).sort((a, b) => conteoMarca[b] - conteoMarca[a]).slice(0, 4);

  let html = `<button class="chip ${filtroMoto === '' ? 'active' : ''}" data-f="">Todas (${total})</button>`;
  if (enTaller > 0) {
    html += `<button class="chip ${filtroMoto === 'taller' ? 'active' : ''}" data-f="taller"><span class="chip-dot"></span>En taller (${enTaller})</button>`;
  }
  marcas.forEach(m => {
    html += `<button class="chip ${filtroMoto === 'marca:' + m ? 'active' : ''}" data-f="marca:${esc(m)}">${esc(m)}</button>`;
  });
  cont.innerHTML = html;
  cont.querySelectorAll('.chip').forEach(ch => {
    ch.addEventListener('click', () => { filtroMoto = ch.dataset.f; renderChips(); aplicarFiltro(); });
  });
}

function aplicarFiltro() {
  let lista = _allMotos;
  if (filtroMoto === 'taller') lista = _allMotos.filter(m => (m.ot_activas || 0) > 0);
  else if (filtroMoto.startsWith('marca:')) {
    const marca = filtroMoto.slice(6);
    lista = _allMotos.filter(m => (m.marca || '').trim() === marca);
  }
  const label = document.getElementById('resultsLabelMotos');
  if (label) label.textContent = lista.length === 1 ? '1 moto' : `${lista.length} motos registradas`;
  renderMotos(lista);
}

function renderMotos(motos) {
  const el = document.getElementById('listaMotos');
  if (!motos.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><p>Sin resultados</p></div>`;
    return;
  }
  const canEdit = App.canEdit();
  el.innerHTML = motos.map(m => {
    const activa = (m.ot_activas || 0) > 0;
    const n      = m.cant_ot || 0;
    const hex    = colorHex(m.color);
    const modelo = [m.marca, m.modelo].filter(Boolean).join(' ');
    const meta   = [modelo, m.anio].filter(Boolean).join(' · ');
    const dot    = hex ? `<span class="color-dot" style="background:${hex}"></span>` : '';
    const right  = canEdit
      ? `<div class="moto-actions" onclick="event.stopPropagation()">
          <button onclick="abrirModal(${m.id})" title="Editar" style="color:var(--text-muted)">${M_EDIT}</button>
          <button onclick="eliminarMoto(${m.id})" title="Eliminar" style="color:#EF4444">${M_TRASH}</button>
        </div>`
      : M_CHEVRON;
    return `
    <div class="moto-card" onclick="location.href='/ordenes?q=${encodeURIComponent(m.patente)}'">
      <div class="moto-thumb ${activa ? 'in-shop' : ''}">${M_THUMB}</div>
      <div class="moto-body">
        <div class="moto-top">
          <span class="moto-patente">${esc(m.patente)}</span>
          ${activa ? `<span class="badge-shop"><span class="pulse"></span>En taller</span>` : ''}
        </div>
        <div class="moto-model">${dot}${esc(meta || '—')}</div>
        <div class="moto-bottom">
          ${M_OWNER}
          <span class="owner-name">${esc(m.cliente_nombre || '')}</span>
          <span class="ot-chip ${n ? '' : 'zero'}">${n ? `${n} OT${n !== 1 ? 's' : ''}` : 'Sin OTs'}</span>
        </div>
      </div>
      ${right}
    </div>`;
  }).join('');
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
    document.getElementById('mColor').value = m.color || '';
    document.getElementById('mNotas').value = m.notas || '';
  } catch {}
}

function eliminarMoto(id) {
  const m = _motosData[id];
  if (!m) return;
  const desc = [m.marca, m.modelo].filter(Boolean).join(' ');
  const tieneOTs = (m.cant_ot || 0) > 0;
  App.confirmarDoble(
    'Eliminar moto',
    `${m.patente}${desc ? ' — ' + desc : ''}`,
    `¿Eliminar la moto <strong>${esc(m.patente)}</strong>${desc ? ` (${esc(desc)})` : ''}?${tieneOTs ? `<br><span style="color:#DC2626;font-size:0.85rem">También se eliminarán sus ${m.cant_ot} orden(es) y todo su historial.</span>` : ''}`,
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
