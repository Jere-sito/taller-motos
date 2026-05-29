const ESTADO_LABELS = {
  recibida:      'Recibida',
  en_reparacion: 'En reparación',
  entregada:     'Entregada'
};

async function onAppReady() {
  await cargarDashboard();
  setInterval(cargarDashboard, 30000);
  document.getElementById('btnNuevaOT')?.addEventListener('click', () => NuevaOT.abrir());
}

async function cargarDashboard() {
  try {
    const data = await API.get('/api/ordenes/dashboard');
    renderEstados(data.por_estado);
  } catch (e) {
    console.error(e);
  }
  cargarRecientes();
}

const PRIORIDAD_BADGE = {
  en_el_dia:   { cls: 'red',        label: 'EN EL DÍA' },
  manana:      { cls: 'amber-warn', label: 'MAÑANA' },
  esta_semana: { cls: 'amber-warn', label: 'ESTA SEMANA' }
};

function badgePrioridad(ot) {
  if (!ot.prioridad) return '';
  if (ot.prioridad === 'fecha_especifica') {
    return ot.fecha_prometida ? `<span class="badge red">${esc(fmtDate(ot.fecha_prometida))}</span>` : '';
  }
  const b = PRIORIDAD_BADGE[ot.prioridad];
  return b ? `<span class="badge ${b.cls}">${b.label}</span>` : '';
}

const PERSON_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
const CHEVRON_SVG = `<svg class="chevron-right" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;

async function cargarRecientes() {
  const container = document.getElementById('dashRecientes');
  if (!container) return;
  try {
    const ordenes = await API.get('/api/ordenes');
    const recientes = ordenes.slice(0, 8);
    if (!recientes.length) {
      container.innerHTML = `<div style="text-align:center; padding:24px; color:var(--text-muted); font-size:0.875rem">Sin órdenes registradas</div>`;
      return;
    }
    container.innerHTML = recientes.map(renderReciente).join('');
  } catch (e) {
    console.error(e);
    container.innerHTML = `<div style="text-align:center; padding:24px; color:var(--text-muted); font-size:0.875rem">Error al cargar</div>`;
  }
}

function renderReciente(ot) {
  const est = ot.estado;
  const moto = [ot.marca, ot.modelo].filter(Boolean).join(' ').toUpperCase();
  return `<a href="/ot-detalle?id=${ot.id}" class="order-card">
    <div class="order-left-bar ${est}"></div>
    <div class="order-info">
      <div class="order-top-row">
        <span class="order-number">${esc(ot.numero)}</span>
        <span class="order-plate">${esc(ot.patente)}</span>
        ${badgePrioridad(ot)}
      </div>
      ${moto ? `<div class="order-model">${esc(moto)}</div>` : ''}
      <div class="order-bottom-row">
        ${PERSON_SVG}
        <span class="order-client">${esc(ot.cliente_nombre || '')}</span>
      </div>
    </div>
    <div class="order-right">
      <span class="badge ${est}">${esc(ESTADO_LABELS[est] || est)}</span>
      ${CHEVRON_SVG}
    </div>
  </a>`;
}

function renderEstados(porEstado) {
  const container = document.getElementById('statCards');
  const counts = {};
  for (const row of porEstado) counts[row.estado] = row.count;

  const ICONS = {
    recibida: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>`,
    en_reparacion: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>`,
    entregada: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
  };
  const LABELS = {
    recibida: 'Recibidas',
    en_reparacion: 'En reparación',
    entregada: 'Entregadas'
  };

  const estados = ['recibida', 'en_reparacion', 'entregada'];
  container.innerHTML = estados.map(est => {
    const n = counts[est] || 0;
    return `<a href="/ordenes?estado=${est}" class="stat-card ${est}">
      <div class="stat-icon ${est}">${ICONS[est]}</div>
      <div class="stat-number ${est}">${n}</div>
      <div class="stat-label">${esc(LABELS[est])}</div>
    </a>`;
  }).join('');
}
