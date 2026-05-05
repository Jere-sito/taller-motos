let filtroEstado = new URLSearchParams(window.location.search).get('estado') || '';
let filtroMecanico = '';
let timerBusqueda;

const ESTADO_LABELS = {
  ingresada: 'Ingresada', en_diagnostico: 'En diagnóstico', presupuestada: 'Presupuestada',
  aprobada: 'Aprobada', en_reparacion: 'En reparación', esperando_repuesto: 'Esperando repuesto',
  lista: 'Lista ✓', entregada: 'Entregada', cancelada: 'Cancelada'
};

async function onAppReady() {
  await cargarMecanicos();
  await cargarOrdenes();
  initFiltros();

  document.getElementById('btnNuevaOT')?.addEventListener('click', () => NuevaOT.abrir());
}

async function cargarMecanicos() {
  if (!App.canEdit()) return;
  try {
    const mecs = await API.get('/api/mecanicos');
    const sel = document.getElementById('filtroMecanico');
    sel.innerHTML = '<option value="">Todos los mecánicos</option>' +
      mecs.map(m => `<option value="${m.id}">${esc(m.nombre)}</option>`).join('');
  } catch {}
}

async function cargarOrdenes() {
  const q = document.getElementById('searchQ').value.trim();
  let url = `/api/ordenes?`;
  if (filtroEstado) url += `estado=${filtroEstado}&`;
  if (filtroMecanico) url += `mecanico_id=${filtroMecanico}&`;
  if (q) url += `q=${encodeURIComponent(q)}`;

  try {
    const ordenes = await API.get(url);
    renderOrdenes(ordenes);
  } catch (e) {
    document.getElementById('listaOrdenes').innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>Error al cargar</p></div>`;
  }
}

function renderOrdenes(ordenes) {
  const el = document.getElementById('listaOrdenes');
  if (!ordenes.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><p>Sin resultados</p></div>`;
    return;
  }

  el.innerHTML = ordenes.map(ot => {
    const colorEstado = getComputedStyle(document.documentElement).getPropertyValue(`--state-${ot.estado}`).trim();
    const vencida = ot.fecha_prometida && new Date(ot.fecha_prometida) < new Date() && !['entregada','cancelada'].includes(ot.estado);
    const pronto = !vencida && ot.fecha_prometida && (new Date(ot.fecha_prometida) - new Date()) < 86400000;

    let fechaBadge = '';
    if (vencida) fechaBadge = `<span class="badge-vencida">Vencida</span>`;
    else if (pronto) fechaBadge = `<span class="badge-pronto">Vence hoy</span>`;
    else if (ot.fecha_prometida) fechaBadge = `<span class="text-muted text-sm">Entrega: ${fmtDate(ot.fecha_prometida)}</span>`;

    return `<a href="/ot-detalle?id=${ot.id}" class="ot-card ${vencida ? 'alert-vencida' : ''}">
      <div class="ot-card-state-bar" style="background:${colorEstado}"></div>
      <div class="ot-card-body">
        <div class="ot-card-numero">${esc(ot.numero)}</div>
        <div class="ot-card-title">${esc(ot.patente)} — ${esc(ot.marca)} ${esc(ot.modelo)}</div>
        <div class="ot-card-meta">
          <span>👤 ${esc(ot.cliente_nombre)}</span>
          ${ot.mecanico_nombre ? `<span>🔧 ${esc(ot.mecanico_nombre)}</span>` : ''}
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
  // Activar el chip correcto según filtroEstado
  document.querySelectorAll('#chipsEstado .chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.estado === filtroEstado);
    chip.addEventListener('click', () => {
      filtroEstado = chip.dataset.estado;
      document.querySelectorAll('#chipsEstado .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      cargarOrdenes();
    });
  });

  document.getElementById('filtroMecanico')?.addEventListener('change', e => {
    filtroMecanico = e.target.value;
    cargarOrdenes();
  });

  document.getElementById('searchQ')?.addEventListener('input', () => {
    clearTimeout(timerBusqueda);
    timerBusqueda = setTimeout(cargarOrdenes, 350);
  });
}
