let filtroEstado = new URLSearchParams(window.location.search).get('estado') || '';
let timerBusqueda;

const PRIORIDAD_LABELS = {
  en_el_dia:        '🔴 En el día',
  manana:           '🟠 Mañana',
  esta_semana:      '🟡 Esta semana',
  sin_apuro:        '🟢 Sin apuro',
  fecha_especifica: '📅'
};

function fmtPrioridad(ot) {
  if (!ot.prioridad) return null;
  if (ot.prioridad === 'fecha_especifica') return `📅 ${fmtDate(ot.fecha_prometida)}`;
  return PRIORIDAD_LABELS[ot.prioridad] || ot.prioridad;
}

const ESTADO_LABELS = {
  recibida:      'Recibida',
  en_reparacion: 'En reparación',
  entregada:     'Entregada'
};

async function onAppReady() {
  await cargarOrdenes();
  initFiltros();
  document.getElementById('btnNuevaOT')?.addEventListener('click', () => NuevaOT.abrir());
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
      `<div class="empty-state"><div class="empty-icon">⚠️</div><p>Error al cargar</p></div>`;
  }
}

function renderOrdenes(ordenes) {
  const el = document.getElementById('listaOrdenes');
  if (!ordenes.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><p>Sin resultados</p></div>`;
    return;
  }

  el.innerHTML = ordenes.map(ot => {
    const sColor = getComputedStyle(document.documentElement).getPropertyValue(`--state-${ot.estado}`).trim();
    const vencida = ot.fecha_prometida && new Date(ot.fecha_prometida) < new Date() && ot.estado !== 'entregada';
    const pronto  = !vencida && ot.estado !== 'entregada' && ot.fecha_prometida && (new Date(ot.fecha_prometida) - new Date()) < 86400000;

    let fechaBadge = '';
    if (vencida)                  fechaBadge = `<span class="badge-vencida">Vencida</span>`;
    else if (pronto)              fechaBadge = `<span class="badge-pronto">Vence hoy</span>`;
    else if (ot.fecha_prometida)  fechaBadge = `<span class="text-muted text-xs">Entrega: ${fmtDate(ot.fecha_prometida)}</span>`;

    return `<a href="/ot-detalle?id=${ot.id}" class="ot-card ${vencida ? 'alert-vencida' : ''}">
      <div class="ot-card-state-bar" style="background:${sColor}"></div>
      <div class="ot-card-body">
        <div class="ot-card-numero">${esc(ot.numero)}</div>
        <div class="ot-card-title">${esc(ot.patente)} — ${esc(ot.marca)} ${esc(ot.modelo)}</div>
        <div class="ot-card-meta">
          <span>👤 ${esc(ot.cliente_nombre)}</span>
          ${ot.prioridad ? `<span>${fmtPrioridad(ot)}</span>` : ''}
          <span>${fmtDate(ot.fecha_ingreso)}</span>
        </div>
      </div>
      <div class="ot-card-right">
        <span class="estado-badge estado-${ot.estado}">${esc(ESTADO_LABELS[ot.estado] || ot.estado)}</span>
        ${fechaBadge}
      </div>
    </a>`;
  }).join('');
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
