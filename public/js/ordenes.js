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
  recibida:      'Ingresada',
  en_reparacion: 'En reparación',
  entregada:     'Entregada'
};

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

function renderCard(ot) {
  const sColor = getComputedStyle(document.documentElement).getPropertyValue(`--state-${ot.estado}`).trim();
  const vencida = ot.fecha_prometida && new Date(ot.fecha_prometida) < new Date() && ot.estado !== 'entregada';
  const pronto  = !vencida && ot.estado !== 'entregada' && ot.fecha_prometida && (new Date(ot.fecha_prometida) - new Date()) < 86400000;

  let fechaBadge = '';
  if (vencida)                  fechaBadge = `<span class="badge-vencida">Vencida</span>`;
  else if (pronto)              fechaBadge = `<span class="badge-pronto">Vence hoy</span>`;
  else if (ot.fecha_prometida)  fechaBadge = `<span class="text-muted text-xs">Entrega: ${fmtDate(ot.fecha_prometida)}</span>`;

  const tieneAcciones = ot.estado !== 'entregada' && App.canEdit();
  const btnAtras  = tieneAcciones && RETROCEDER[ot.estado]
    ? `<button class="btn btn-secondary btn-sm" onclick="avanzarEstado(event,${ot.id},'${RETROCEDER[ot.estado]}')">${RETROCEDER_LABEL[ot.estado]}</button>`
    : '';
  const btnAdelan = tieneAcciones && AVANZAR[ot.estado]
    ? `<button class="btn btn-primary btn-sm" onclick="avanzarEstado(event,${ot.id},'${AVANZAR[ot.estado]}')">${AVANZAR_LABEL[ot.estado]}</button>`
    : '';

  const wrapClass = tieneAcciones ? 'ot-card-wrap' : '';

  return `<div class="${wrapClass}">
    <a href="/ot-detalle?id=${ot.id}" class="ot-card ${vencida ? 'alert-vencida' : ''}">
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
    </a>
    ${tieneAcciones ? `<div class="ot-card-actions">${btnAtras}${btnAdelan}</div>` : ''}
  </div>`;
}

function renderOrdenes(ordenes) {
  const el = document.getElementById('listaOrdenes');
  if (!ordenes.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><p>Sin resultados</p></div>`;
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
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><p>Sin resultados</p></div>`;
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
