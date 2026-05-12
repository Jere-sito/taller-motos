const ESTADO_LABELS = {
  recibida:      'Recibidas',
  en_reparacion: 'En reparación',
  entregada:     'Entregadas hoy'
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

  const estados = ['recibida', 'en_reparacion', 'entregada'];
  container.innerHTML = estados.map(est => {
    const n = counts[est] || 0;
    const sColor = getComputedStyle(document.documentElement).getPropertyValue(`--state-${est}`).trim();
    return `<a href="/ordenes?estado=${est}" class="stat-card">
      <div class="stat-card-count" style="color:${sColor}">${n}</div>
      <div class="stat-card-label">
        <span class="stat-card-dot" style="background:${sColor}"></span>
        ${esc(ESTADO_LABELS[est] || est)}
      </div>
    </a>`;
  }).join('');
}
