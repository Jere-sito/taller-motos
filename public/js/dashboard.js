const ESTADO_LABELS = {
  ingresada: 'Ingresadas',
  en_diagnostico: 'En diagnóstico',
  presupuestada: 'Presupuestadas',
  aprobada: 'Aprobadas',
  en_reparacion: 'En reparación',
  esperando_repuesto: 'Esperando repuesto',
  lista: 'Listas para retirar',
  entregada: 'Entregadas hoy'
};

async function onAppReady() {
  await cargarDashboard();

  // Actualizar cada 30s
  setInterval(cargarDashboard, 30000);

  document.getElementById('btnNuevaOT').addEventListener('click', () => {
    NuevaOT.abrir();
  });
}

async function cargarDashboard() {
  try {
    const data = await API.get('/api/ordenes/dashboard');
    renderEstados(data.por_estado);
    renderVencidas(data.vencidas);
    renderListas(data.listas);
  } catch (e) {
    console.error(e);
  }
}

function renderEstados(porEstado) {
  const container = document.getElementById('statCards');
  const counts = {};
  for (const row of porEstado) counts[row.estado] = row.count;

  const estados = ['ingresada','en_diagnostico','presupuestada','aprobada','en_reparacion','esperando_repuesto','lista'];
  container.innerHTML = estados.map(est => {
    const n = counts[est] || 0;
    const color = getComputedStyle(document.documentElement).getPropertyValue(`--state-${est}`).trim();
    return `<a href="/ordenes?estado=${est}" class="stat-card">
      <div class="stat-card-count" style="color:${color}">${n}</div>
      <div class="stat-card-label">
        <span class="stat-card-dot" style="background:${color}"></span>${esc(ESTADO_LABELS[est] || est)}
      </div>
    </a>`;
  }).join('');
}

function renderVencidas(vencidas) {
  const el = document.getElementById('listVencidas');
  if (!vencidas.length) {
    el.innerHTML = '<div class="text-muted text-sm">Sin alertas 🎉</div>';
    return;
  }
  el.innerHTML = vencidas.map(ot => `
    <a href="/ot-detalle?id=${ot.id}" style="display:block; text-decoration:none; color:var(--text); padding: 8px 0; border-bottom: 1px solid var(--border);">
      <div style="font-size:0.82rem; font-weight:700; color: #B91C1C;">${esc(ot.numero)}</div>
      <div style="font-size:0.85rem; font-weight:600;">${esc(ot.patente)} — ${esc(ot.cliente_nombre)}</div>
      <div style="font-size:0.78rem; color:var(--text-muted);">
        <span class="badge-vencida">${ot.dias_retraso} día${ot.dias_retraso !== 1 ? 's' : ''} de retraso</span>
        ${ot.mecanico_nombre ? `· ${esc(ot.mecanico_nombre)}` : ''}
      </div>
    </a>
  `).join('');
}

function renderListas(listas) {
  const el = document.getElementById('listListas');
  if (!listas.length) {
    el.innerHTML = '<div class="text-muted text-sm">Ninguna por ahora</div>';
    return;
  }
  el.innerHTML = listas.map(ot => `
    <a href="/ot-detalle?id=${ot.id}" style="display:block; text-decoration:none; color:var(--text); padding: 8px 0; border-bottom: 1px solid var(--border);">
      <div style="font-size:0.82rem; font-weight:700; color: var(--state-lista);">${esc(ot.numero)}</div>
      <div style="font-size:0.85rem; font-weight:600;">${esc(ot.patente)} — ${esc(ot.cliente_nombre)}</div>
      <div style="font-size:0.78rem; color:var(--text-muted);">📞 ${esc(ot.cliente_telefono || '—')}</div>
    </a>
  `).join('');
}
