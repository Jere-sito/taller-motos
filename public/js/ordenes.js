let filtroEstado = new URLSearchParams(window.location.search).get('estado') || '';
let timerBusqueda;

const PRIORIDAD_CHIP = {
  en_el_dia:        `<span class="priority-chip urgente">En el día</span>`,
  manana:           `<span class="priority-chip manana">Mañana</span>`,
  esta_semana:      `<span class="priority-chip semana">Esta semana</span>`,
  sin_apuro:        `<span class="priority-chip sin_apuro">Sin apuro</span>`,
  fecha_especifica: `<span class="priority-chip fecha">FECHA</span>`
};

function fmtPrioridad(ot) {
  if (!ot.prioridad) return '';
  if (ot.prioridad === 'fecha_especifica') {
    return `<span class="priority-chip fecha">${fmtDate(ot.fecha_prometida)}</span>`;
  }
  return PRIORIDAD_CHIP[ot.prioridad] || '';
}

const ESTADO_LABELS = {
  recibida:      'Recibida',
  en_reparacion: 'En reparación',
  entregada:     'Entregada'
};

const PERSON_SVG  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
const CAL_SVG     = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
const CHECK_SVG   = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const CHEVRON_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;

// Transiciones permitidas desde la lista
const AVANZAR = {
  recibida:      'en_reparacion',
  en_reparacion: 'entregada'
};
const RETROCEDER = {
  en_reparacion: 'recibida'
};
const AVANZAR_LABEL = {
  recibida:      '→ En reparación',
  en_reparacion: '→ Entregada'
};
const RETROCEDER_LABEL = {
  en_reparacion: '← Ingresada'
};

async function onAppReady() {
  await cargarOrdenes();
  cargarConteos();
  initFiltros();
  document.getElementById('btnNuevaOT')?.addEventListener('click', () => NuevaOT.abrir());
}

const CHIP_BASE = { '': 'Todas', recibida: 'Recibidas', en_reparacion: 'En reparación', entregada: 'Entregadas' };

async function cargarConteos() {
  try {
    const data = await API.get('/api/ordenes/dashboard');
    const c = {};
    for (const r of data.por_estado) c[r.estado] = r.count;
    const total = (c.recibida || 0) + (c.en_reparacion || 0) + (c.entregada || 0);
    setChipCount('', total);
    setChipCount('recibida', c.recibida || 0);
    setChipCount('en_reparacion', c.en_reparacion || 0);
    setChipCount('entregada', c.entregada || 0);
  } catch {}
}

function setChipCount(estado, n) {
  const chip = document.querySelector(`#chipsEstado .chip[data-estado="${estado}"]`);
  if (chip) chip.textContent = `${CHIP_BASE[estado]} (${n})`;
}

async function cargarOrdenes() {
  const q = document.getElementById('searchQ').value.trim();
  let url = `/api/ordenes?`;
  if (filtroEstado) url += `estado=${filtroEstado}&`;
  if (q)            url += `q=${encodeURIComponent(q)}`;

  try {
    const ordenes = await API.get(url);
    renderOrdenes(ordenes);
  } catch (e) {
    document.getElementById('listaOrdenes').innerHTML =
      `<div class="empty-state"><p>Error al cargar</p></div>`;
  }
}

function renderCard(ot) {
  const sColor = getComputedStyle(document.documentElement).getPropertyValue(`--state-${ot.estado}`).trim();
  const prio = ot.prioridad ? fmtPrioridad(ot) : '';
  const esRep = ot.tipo === 'repuesto';

  // Chip de tipo (distingue de un vistazo, sin leer el contenido)
  const tipoChip = esRep
    ? `<span class="ot-tipo-chip repuesto">Repuesto</span>`
    : `<span class="ot-tipo-chip moto">Moto</span>`;

  // Línea de identidad: patente+modelo (moto) o detalle truncado (repuesto)
  let identidad;
  if (esRep) {
    identidad = `<div class="ot-detalle">${esc(ot.detalle_repuesto || '—')}</div>`;
  } else {
    const moto = [ot.marca, ot.modelo].filter(Boolean).join(' ').toUpperCase();
    identidad = `<div class="ot-plate">${esc(ot.patente || '')}</div>
        ${moto ? `<div class="ot-model">${esc(moto)}</div>` : ''}`;
  }

  return `<a href="/ot-detalle?id=${ot.id}" class="ot-card">
    <div class="ot-card-state-bar" style="background:${sColor}"></div>
    <div class="ot-card-body">
      <div class="otrow-1">
        <span class="ot-card-numero">${esc(ot.numero)}</span>
        ${tipoChip}
        <span class="badge ${ot.estado}">${esc(ESTADO_LABELS[ot.estado] || ot.estado)}</span>
      </div>
      <div class="otrow-2">
        ${identidad}
      </div>
      <div class="otrow-3">
        <div class="ot-client">${PERSON_SVG}<span class="ot-client-name">${esc(ot.cliente_nombre || '')}</span></div>
        ${prio}
      </div>
      <div class="otrow-4">
        ${CAL_SVG}<span class="ot-date">Ingreso: ${esc(fmtDate(ot.fecha_ingreso))}</span>
      </div>
      ${ot.estado === 'entregada' && ot.fecha_entrega_real ? `
      <div class="otrow-4 ot-date-entregada">
        ${CHECK_SVG}<span class="ot-date ot-date-entregada">Entregado: ${esc(fmtDate(ot.fecha_entrega_real))}</span>
      </div>` : ''}
    </div>
    <div class="ot-chevron">${CHEVRON_SVG}</div>
  </a>`;
}

function renderOrdenes(ordenes) {
  const el = document.getElementById('listaOrdenes');

  const label = document.getElementById('resultsLabel');
  if (label) {
    label.textContent = ordenes.length === 1
      ? '1 orden encontrada'
      : `${ordenes.length} órdenes encontradas`;
  }

  if (!ordenes.length) {
    el.innerHTML = `<div class="empty-state"><p>Sin resultados</p></div>`;
    return;
  }

  // Cuando hay filtro activo: mostrar todo directo
  if (filtroEstado) {
    el.innerHTML = ordenes.map(ot => renderCard(ot)).join('');
    return;
  }

  // Sin filtro: separar activas de entregadas
  const activas     = ordenes.filter(o => o.estado !== 'entregada');
  const entregadas  = ordenes.filter(o => o.estado === 'entregada');
  const q           = document.getElementById('searchQ').value.trim();

  let html = activas.map(ot => renderCard(ot)).join('');

  if (entregadas.length) {
    const abierto = !!q; // Si hay búsqueda, mostrar entregadas abiertas
    html += `
      <div style="margin-top:28px">
        <button id="btnToggleEntregadas" onclick="toggleEntregadas()"
          style="display:flex; align-items:center; gap:8px; background:none; border:none; cursor:pointer; font-size:0.875rem; font-weight:700; color:var(--text-muted); padding:8px 0; font-family:inherit; width:100%">
          <span id="iconEntregadas">${abierto ? '▾' : '▸'}</span>
          Entregadas (${entregadas.length})
        </button>
        <div id="seccionEntregadas" class="${abierto ? '' : 'hidden'}">
          ${entregadas.map(ot => renderCard(ot)).join('')}
        </div>
      </div>`;
  }

  if (!activas.length && !entregadas.length) {
    el.innerHTML = `<div class="empty-state"><p>Sin resultados</p></div>`;
    return;
  }

  el.innerHTML = html;
}

function toggleEntregadas() {
  const sec  = document.getElementById('seccionEntregadas');
  const icon = document.getElementById('iconEntregadas');
  if (!sec) return;
  const abierto = !sec.classList.contains('hidden');
  sec.classList.toggle('hidden', abierto);
  if (icon) icon.textContent = abierto ? '▸' : '▾';
}

async function avanzarEstado(e, otId, nuevoEstado) {
  e.preventDefault();
  e.stopPropagation();
  try {
    await API.patch(`/api/ordenes/${otId}/estado`, { estado: nuevoEstado });
    App.toast(`${ESTADO_LABELS[nuevoEstado]}`, 'success');
    await cargarOrdenes();
  } catch (err) {
    App.toast(err.message || 'Error al cambiar estado', 'error');
  }
}

function initFiltros() {
  document.querySelectorAll('#chipsEstado .chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.estado === filtroEstado);
    chip.addEventListener('click', () => {
      filtroEstado = chip.dataset.estado;
      document.querySelectorAll('#chipsEstado .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      cargarOrdenes();
    });
  });

  document.getElementById('searchQ')?.addEventListener('input', () => {
    clearTimeout(timerBusqueda);
    timerBusqueda = setTimeout(cargarOrdenes, 350);
  });
}
