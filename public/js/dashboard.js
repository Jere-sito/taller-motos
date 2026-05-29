const ESTADO_LABELS = {
  recibida:      'Ingresadas',
  en_reparacion: 'En reparación',
  entregada:     'Entregadas'
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
    return `<a href="/ordenes?estado=${est}" class="stat-card ${est}" style="text-decoration:none;color:inherit;">
      <div class="stat-card-header">
        <div class="stat-card-label">${esc(LABELS[est])}</div>
        <div class="stat-card-icon ${est}">${ICONS[est]}</div>
      </div>
      <div class="stat-card-count">${n}</div>
      <div class="stat-card-footer">
        <span class="stat-card-footer-text">órdenes activas</span>
      </div>
    </a>`;
  }).join('');
}
