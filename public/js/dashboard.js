const ESTADO_LABELS = {
  ingresada:           'Ingresadas',
  en_diagnostico:      'En diagnóstico',
  presupuestada:       'Presupuestadas',
  aprobada:            'Aprobadas',
  en_reparacion:       'En reparación',
  esperando_repuesto:  'Esperando repuesto',
  lista:               'Listas para retirar',
  entregada:           'Entregadas hoy'
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

function renderVencidas(vencidas) {
  const el = document.getElementById('listVencidas');
  if (!vencidas.length) {
    el.innerHTML = `<div class="empty-state" style="padding:20px 0">
      <div style="font-size:1.5rem; margin-bottom:6px">🎉</div>
      <div class="text-muted text-sm">Sin alertas por ahora</div>
    </div>`;
    return;
  }
  el.innerHTML = vencidas.map(ot => `
    <a href="/ot-detalle?id=${ot.id}" style="display:block; text-decoration:none; padding:10px 0; border-bottom:1px solid var(--border);">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:3px">
        <div style="font-size:0.8125rem; font-weight:700; color:#991B1B">${esc(ot.numero)}</div>
        <span class="badge-vencida">${ot.dias_retraso} día${ot.dias_retraso !== 1 ? 's' : ''} de retraso</span>
      </div>
      <div style="font-size:0.9375rem; font-weight:600; color:var(--text)">${esc(ot.patente)} — ${esc(ot.cliente_nombre)}</div>
      ${ot.mecanico_nombre ? `<div class="text-sm text-muted" style="margin-top:2px">🔧 ${esc(ot.mecanico_nombre)}</div>` : ''}
    </a>
  `).join('');
}

function renderListas(listas) {
  const el = document.getElementById('listListas');
  if (!listas.length) {
    el.innerHTML = `<div class="empty-state" style="padding:20px 0">
      <div style="font-size:1.5rem; margin-bottom:6px">⏳</div>
      <div class="text-muted text-sm">Ninguna por ahora</div>
    </div>`;
    return;
  }
  el.innerHTML = listas.map(ot => `
    <a href="/ot-detalle?id=${ot.id}" style="display:block; text-decoration:none; padding:10px 0; border-bottom:1px solid var(--border);">
      <div style="font-size:0.8125rem; font-weight:700; color:var(--state-lista); margin-bottom:3px">${esc(ot.numero)}</div>
      <div style="font-size:0.9375rem; font-weight:600; color:var(--text)">${esc(ot.patente)} — ${esc(ot.cliente_nombre)}</div>
      ${ot.cliente_telefono ? `<div class="text-sm text-muted" style="margin-top:2px">📞 ${esc(ot.cliente_telefono)}</div>` : ''}
    </a>
  `).join('');
}
