const otId = Number(new URLSearchParams(window.location.search).get('id'));

const SVG_EDIT = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const SVG_CLOSE = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
let otActual = null;
let presupuestoActual = null;
let pagosActuales = [];
let editandoItemId = null;

const ESTADO_LABELS = {
  recibida:      'Recibida',
  en_reparacion: 'En reparación',
  entregada:     'Entregada'
};
const FLUJO_PRINCIPAL = ['recibida', 'en_reparacion', 'entregada'];

const PRIO_CHIP = {
  en_el_dia:        { cls: 'red',    label: 'En el día' },
  manana:           { cls: 'orange', label: 'Mañana' },
  esta_semana:      { cls: 'yellow', label: 'Esta semana' },
  sin_apuro:        { cls: 'green',  label: 'Sin apuro' },
  fecha_especifica: { cls: 'blue',   label: 'Fecha' }
};
const CLOCK_SVG = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;

function chipPrioridadHTML(ot) {
  if (!ot.prioridad) return '';
  const p = PRIO_CHIP[ot.prioridad];
  if (!p) return '';
  const label = ot.prioridad === 'fecha_especifica' ? `Fecha: ${fmtDate(ot.fecha_prometida)}` : p.label;
  return `<div class="chip-prioridad ${p.cls}">${CLOCK_SVG}${esc(label)}</div>`;
}

// Iconos
const ICON_CHECK = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const ICON_ESTADO = {
  recibida:      `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>`,
  en_reparacion: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>`,
  entregada:     `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`
};
const ARROW_R = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
const ARROW_L = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>`;
const MOTO_SVG = `<svg width="28" height="22" viewBox="0 0 48 34" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="25" r="7"/><circle cx="38" cy="25" r="7"/><path d="M17 25h14"/><path d="M24 25V14l-6-6h-5l-3 4"/><path d="M24 14h10l4 6"/><path d="M30 10h6l2 4"/></svg>`;
const PERSON_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
const PHONE_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;
const WA_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>`;
const PLUS_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
const EDIT_HDR_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const NOTE_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const BACK_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>`;
const BILL_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/></svg>`;
const CARD_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>`;

async function onAppReady() {
  if (!otId) { window.location.href = '/ordenes'; return; }
  await cargarOT();
}

async function cargarOT() {
  try {
    otActual = await API.get(`/api/ordenes/${otId}`);
    renderOT();
    await Promise.all([cargarPresupuesto(), cargarPagos()]);
  } catch {
    document.getElementById('paginaDetalle').innerHTML =
      `<div class="empty-state"><div class="empty-icon">⚠️</div><p>Orden no encontrada</p></div>`;
  }
}

function renderOT() {
  const ot = otActual;
  const idxActual   = FLUJO_PRINCIPAL.indexOf(ot.estado);
  const prevEstado  = idxActual > 0 ? FLUJO_PRINCIPAL[idxActual - 1] : null;
  const nextEstado  = idxActual < FLUJO_PRINCIPAL.length - 1 ? FLUJO_PRINCIPAL[idxActual + 1] : null;
  const puedeAtras  = App.canEdit() && prevEstado && ot.transiciones_validas?.includes(prevEstado);
  const puedeAdelan = App.canEdit() && nextEstado && ot.transiciones_validas?.includes(nextEstado);

  document.title = `${ot.numero} — Taller Motos`;

  const lineCls = idxActual >= 2 ? 'full' : idxActual === 1 ? 'half' : '';
  const steps = FLUJO_PRINCIPAL.map((est, i) => {
    const done    = i < idxActual;
    const current = i === idxActual;
    const status  = done ? 'completed' : current ? 'current' : 'pending';
    const icon    = (done || (current && est === 'entregada')) ? ICON_CHECK : ICON_ESTADO[est];
    const labelCls = done ? 'done' : current ? 'active' : '';
    return `
      <div class="step-item">
        <div class="step-circle ${status}">${icon}</div>
        <span class="step-label ${labelCls}">${esc(ESTADO_LABELS[est])}</span>
      </div>`;
  }).join('');

  const moto      = [ot.marca, ot.modelo].filter(Boolean).join(' ');
  const motoLinea = ot.color ? `${moto} — ${ot.color}` : moto;
  const telDigits = (ot.cliente_telefono || '').replace(/[^0-9+]/g, '');

  document.getElementById('paginaDetalle').innerHTML = `
  <div class="otd">

    <!-- Header -->
    <div class="otd-header">
      <div class="otd-header-row">
        <a class="otd-icon-btn" href="/ordenes" aria-label="Volver">${BACK_SVG}</a>
        <span class="otd-title">${esc(ot.numero)}</span>
        ${App.canEdit() ? `<button class="otd-icon-btn" id="btnEditarOT" aria-label="Editar">${EDIT_HDR_SVG}</button>` : `<span style="width:36px"></span>`}
      </div>
      <div class="otd-meta">
        <div class="badge-estado ${ot.estado}"><span class="dot"></span>${esc(ESTADO_LABELS[ot.estado])}</div>
        ${chipPrioridadHTML(ot)}
        <div class="otd-fecha">Ingreso: ${fmtDateTime(ot.fecha_ingreso)} hs</div>
      </div>
    </div>

    <!-- Moto + Cliente -->
    <div class="card"><div class="card-body">
      <div class="moto-header">
        <div class="moto-icon-wrap">${MOTO_SVG}</div>
        <div class="moto-info">
          <div class="patente">${esc(ot.patente)}</div>
          <div class="moto-modelo">${esc(motoLinea || '—')}</div>
        </div>
      </div>
      <div class="divider"></div>
      <div class="cliente-row">
        <div class="cliente-icon">${PERSON_SVG}</div>
        <div>
          <div class="cliente-nombre">${esc(ot.cliente_nombre || '—')}</div>
          ${ot.cedula ? `<div class="cliente-subtag">Cédula ${ot.cedula === 'fisica' ? 'física' : 'digital'}</div>` : ''}
        </div>
      </div>
      ${ot.cliente_telefono ? `<a href="tel:${esc(telDigits)}" class="phone-link">${PHONE_SVG}${esc(ot.cliente_telefono)}</a>` : ''}
      ${ot.cliente_telefono ? `<button class="btn-whatsapp" id="btnWAtop">${WA_SVG}Enviar presupuesto por WhatsApp</button>` : ''}
    </div></div>

    <!-- Estado de la orden -->
    <div class="card"><div class="card-body">
      <div class="card-header-row"><span class="card-title">Estado de la orden</span></div>
      <div class="steps-container">
        <div class="steps-line ${lineCls}"></div>
        ${steps}
      </div>
      ${(puedeAtras || puedeAdelan) ? `
      <div class="steps-nav">
        ${puedeAtras  ? `<button class="btn-state-outline" onclick="cambiarEstado('${prevEstado}')">${ARROW_L}${esc(ESTADO_LABELS[prevEstado])}</button>` : ''}
        ${puedeAdelan ? `<button class="btn-state-filled" onclick="cambiarEstado('${nextEstado}')">${esc(ESTADO_LABELS[nextEstado])}${ARROW_R}</button>` : ''}
      </div>` : ''}
    </div></div>

    <!-- Presupuesto -->
    <div class="card" id="seccionPresupuesto"><div class="card-body" id="contenidoPresupuesto">
      <div class="text-muted text-sm">Cargando...</div>
    </div></div>

    <!-- Pagos -->
    <div class="card" id="seccionPagos"><div class="card-body" id="contenidoPagos">
      <div class="text-muted text-sm">Cargando...</div>
    </div></div>

    <!-- Problema + notas -->
    <div class="card"><div class="card-body">
      <div class="problema-title">Problema declarado</div>
      <div class="problema-text">${esc(ot.problema_declarado || '—')}</div>
      ${ot.observaciones_internas ? `
      <div class="notas-block">
        <div class="notas-label">${NOTE_SVG}Notas internas</div>
        <div class="notas-text">${esc(ot.observaciones_internas)}</div>
      </div>` : ''}
      ${ot.fecha_prometida ? `
      <div class="otd-extra">
        <span>Prometida: <strong>${fmtDate(ot.fecha_prometida)}</strong></span>
      </div>` : ''}
    </div></div>

  </div>`;

  document.getElementById('btnEditarOT')?.addEventListener('click', abrirEditarOT);
  document.getElementById('btnWAtop')?.addEventListener('click', compartirWhatsApp);
}

// ── Animación inmediata del progreso (optimista) ──────────────────────────
function animarProgresoDom(nuevoIdx) {
  document.querySelectorAll('.ot-progress-dot').forEach((dot, i) => {
    dot.className = 'ot-progress-dot' + (i < nuevoIdx ? ' done' : i === nuevoIdx ? ' current' : '');
  });
  document.querySelectorAll('.ot-progress-line').forEach((line, i) => {
    line.className = 'ot-progress-line' + (i < nuevoIdx ? ' done' : '');
  });
}

// ── Cambiar estado ────────────────────────────────────────────────────────
async function cambiarEstado(nuevoEstado) {
  document.querySelectorAll('.btn-state-outline, .btn-state-filled').forEach(b => { b.disabled = true; });
  try {
    otActual = await API.patch(`/api/ordenes/${otId}/estado`, { estado: nuevoEstado });
    App.toast(ESTADO_LABELS[nuevoEstado], 'success');
    renderOT();
    await cargarPresupuesto();
    renderPagos();
  } catch (e) {
    document.querySelectorAll('.btn-state-outline, .btn-state-filled').forEach(b => { b.disabled = false; });
    App.toast(e.message || 'Error al cambiar estado', 'error');
  }
}

// ── Editar OT ─────────────────────────────────────────────────────────────
async function abrirEditarOT() {
  document.getElementById('editPrioridad').value = otActual.prioridad || '';
  document.getElementById('editProblema').value = otActual.problema_declarado || '';
  document.getElementById('editObservaciones').value = otActual.observaciones_internas || '';
  document.getElementById('editFechaPrometida').value = otActual.fecha_prometida?.slice(0,10) || '';
  App.openModal('modalEditarOT');

  document.getElementById('btnGuardarEdicion').onclick = async () => {
    try {
      otActual = await API.patch(`/api/ordenes/${otId}`, {
        prioridad:              document.getElementById('editPrioridad').value || null,
        problema_declarado:     document.getElementById('editProblema').value,
        observaciones_internas: document.getElementById('editObservaciones').value,
        fecha_prometida:        document.getElementById('editFechaPrometida').value || null
      });
      App.closeModal('modalEditarOT');
      App.toast('Orden actualizada', 'success');
      renderOT();
    } catch (e) {
      App.toast(e.message || 'Error al guardar', 'error');
    }
  };
}

// ── Presupuesto ───────────────────────────────────────────────────────────
async function cargarPresupuesto() {
  try {
    presupuestoActual = await API.get(`/api/ordenes/${otId}/presupuesto`);
    renderPresupuesto();
    renderPagos();
  } catch {
    const contenido = document.getElementById('contenidoPresupuesto');
    if (contenido) contenido.innerHTML = `<div class="text-muted text-sm">Sin ítems aún.</div>`;
  }
}

function renderPresupuesto() {
  const pres    = presupuestoActual;
  const items   = pres?.items || [];
  const canEdit = App.canEdit();
  const contenido = document.getElementById('contenidoPresupuesto');
  if (!contenido) return;

  const subtotal  = items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);
  const descMonto = (subtotal * (pres?.descuento || 0)) / 100;
  const total     = subtotal - descMonto;

  // Agrupar siempre: primero repuestos, después mano de obra (solo visual)
  const repuestos = items.filter(i => i.tipo !== 'mano_obra');
  const manoObra  = items.filter(i => i.tipo === 'mano_obra');
  const subRep = repuestos.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);
  const subMO  = manoObra.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);

  function renderItemRow(item) {
    const esMO    = item.tipo === 'mano_obra';
    const tipoCls = esMO ? 'chip-mo' : 'chip-repuesto';
    const tipoLbl = esMO ? 'M. Obra' : 'Repuesto';
    const qty     = esMO ? '—' : `x${item.cantidad}`;
    return `
      <div class="item-row">
        <div class="item-left">
          <span class="chip-tipo ${tipoCls}">${tipoLbl}</span>
          <div>
            <div class="item-desc">${esc(item.descripcion)}</div>
            <div class="item-qty">${qty} · ${fmtMoney(item.precio_unitario)} c/u</div>
          </div>
        </div>
        <div class="item-right">
          <div class="item-price">${fmtMoney(item.cantidad * item.precio_unitario)}</div>
          ${canEdit ? `<div class="item-actions">
            <button onclick="abrirEditarItem(${item.id})" title="Editar" style="color:var(--text-muted)">${SVG_EDIT}</button>
            <button onclick="eliminarItem(${pres.id},${item.id})" title="Eliminar" style="color:#EF4444">${SVG_CLOSE}</button>
          </div>` : ''}
        </div>
      </div>`;
  }

  function renderGrupo(titulo, lista, subtotalGrupo) {
    if (!lista.length) return '';
    return `
      <div class="presup-grupo">
        ${lista.map(renderItemRow).join('')}
        <div class="subtotal-row">
          <span class="subtotal-label">Subtotal ${titulo}</span>
          <span class="subtotal-val">${fmtMoney(subtotalGrupo)}</span>
        </div>
      </div>`;
  }

  contenido.innerHTML = `
    <div class="presupuesto-header">
      <span class="presupuesto-title">Presupuesto</span>
    </div>
    ${items.length ? `
      <div class="item-list">
        ${renderGrupo('repuestos', repuestos, subRep)}
        ${renderGrupo('mano de obra', manoObra, subMO)}
      </div>
      ${pres.descuento > 0 ? `<div class="total-row descuento"><span class="total-label">Descuento (${pres.descuento}%)</span><span class="total-value" style="font-size:14px">-${fmtMoney(descMonto)}</span></div>` : ''}
      <div class="total-row"><span class="total-label">Total</span><span class="total-value">${fmtMoney(total)}</span></div>
    ` : `<div class="text-muted text-sm" style="padding:2px 0 8px">Sin ítems aún.${canEdit ? ' Usá el botón para agregar.' : ''}</div>`}
    ${canEdit ? `<button class="btn-outline-full" id="btnAgregarItem">${PLUS_SVG}Agregar ítem</button>` : ''}
    ${otActual.estado === 'entregada' ? `<button class="btn-outline-full" onclick="window.print()" style="margin-top:8px">Imprimir</button>` : ''}
  `;

  document.getElementById('btnAgregarItem')?.addEventListener('click', abrirModalItem);
}

async function eliminarItem(presId, itemId) {
  if (!App.confirm('¿Eliminar este ítem?')) return;
  try {
    await API.del(`/api/presupuestos/${presId}/items/${itemId}`);
    presupuestoActual = await API.get(`/api/ordenes/${otId}/presupuesto`);
    renderPresupuesto();
    App.toast('Ítem eliminado', 'success');
  } catch (e) { App.toast(e.message || 'Error', 'error'); }
}

async function compartirWhatsApp() {
  try {
    const { texto } = await API.get(`/api/presupuestos/${presupuestoActual.id}/whatsapp`);
    const base = waLink(otActual?.cliente_telefono) || 'https://wa.me/';
    // iOS Safari convierte %2B → + antes de pasar la URL a WhatsApp,
    // y WhatsApp interpreta + como espacio (form-encoding). Usamos ＋ (U+FF0B)
    // que es visualmente idéntico pero no tiene significado especial en URLs.
    const textoWA = texto.replace(/\+/g, '＋');
    window.open(`${base}?text=${encodeURIComponent(textoWA)}`, '_blank');
  } catch (e) { App.toast('Error al generar el mensaje', 'error'); }
}

// ── Modal agregar ítem ─────────────────────────────────────────────────────
function _actualizarCamposCantidad(tipo) {
  const grupo = document.getElementById('grupoCantidad');
  if (!grupo) return;
  if (tipo === 'mano_obra') {
    grupo.style.display = 'none';
    document.getElementById('itemCantidad').value = '1';
  } else {
    grupo.style.display = '';
  }
}

function abrirModalItem() {
  editandoItemId = null;
  document.querySelector('#modalAgregarItem .modal-title').textContent = 'Agregar ítem';
  document.getElementById('itemTipo').value = 'repuesto';
  document.getElementById('itemTipo').disabled = false;
  document.getElementById('itemDescripcion').value = '';
  document.getElementById('itemCantidad').value = '1';
  document.getElementById('itemPrecio').value = '';
  document.getElementById('btnGuardarItem').textContent = 'Agregar';
  _actualizarCamposCantidad('repuesto');
  App.openModal('modalAgregarItem');
}

function abrirEditarItem(itemId) {
  const item = (presupuestoActual?.items || []).find(i => i.id === itemId);
  if (!item) return;
  editandoItemId = itemId;
  document.querySelector('#modalAgregarItem .modal-title').textContent = 'Editar ítem';
  document.getElementById('itemTipo').value = item.tipo;
  document.getElementById('itemTipo').disabled = false;
  document.getElementById('itemDescripcion').value = item.descripcion;
  document.getElementById('itemCantidad').value = item.cantidad;
  const p = Math.round(item.precio_unitario || 0);
  document.getElementById('itemPrecio').value = p > 0 ? p.toLocaleString('es-AR') : '';
  document.getElementById('btnGuardarItem').textContent = 'Guardar';
  _actualizarCamposCantidad(item.tipo);
  App.openModal('modalAgregarItem');
}

// ── Pagos ─────────────────────────────────────────────────────────────────
const MEDIO_LABELS = {
  efectivo: 'Efectivo', mercadopago: 'MercadoPago', puente: 'Puente',
  credito: 'Tarjeta crédito', debito: 'Tarjeta débito'
};

async function cargarPagos() {
  try {
    pagosActuales = await API.get(`/api/ordenes/${otId}/pagos`);
  } catch {
    pagosActuales = [];
  }
  renderPagos();
}

function renderPagos() {
  const contenido = document.getElementById('contenidoPagos');
  if (!contenido) return;
  const canEdit = App.canEdit();

  const totalPagado = pagosActuales.reduce((s, p) => s + p.monto, 0);
  let total = null, saldo = null, pct = 0;
  if (presupuestoActual) {
    const items     = presupuestoActual.items || [];
    const subtotal  = items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);
    const descMonto = (subtotal * (presupuestoActual.descuento || 0)) / 100;
    total = subtotal - descMonto;
    saldo = total - totalPagado;
    pct   = total > 0 ? Math.min(100, Math.round((totalPagado / total) * 100)) : (totalPagado > 0 ? 100 : 0);
  }

  const pagosHTML = pagosActuales.map(p => {
    const iconCls = p.medio === 'efectivo' ? 'efectivo' : p.medio === 'mercadopago' ? 'mp' : 'otro';
    const icon    = p.medio === 'efectivo' ? BILL_SVG : CARD_SVG;
    const sub     = [fmtDate(p.created_at), p.proveedor, p.notas].filter(Boolean).join(' · ');
    return `
      <div class="pago-row">
        <div class="pago-left">
          <div class="pago-icon ${iconCls}">${icon}</div>
          <div>
            <div class="pago-metodo">${esc(MEDIO_LABELS[p.medio] || p.medio)}</div>
            ${sub ? `<div class="pago-fecha">${esc(sub)}</div>` : ''}
          </div>
        </div>
        <div class="pago-monto">${fmtMoney(p.monto)}${canEdit ? `<button class="pago-del" onclick="eliminarPago(${p.id})" title="Eliminar">✕</button>` : ''}</div>
      </div>`;
  }).join('');

  contenido.innerHTML = `
    <div class="pagos-header-row">
      <span class="pagos-title">Pagos registrados</span>
      <div class="pagos-amounts">
        <div class="pagos-pagado">${fmtMoney(totalPagado)}</div>
        ${total !== null ? `<div class="pagos-total-ref">de ${fmtMoney(total)}</div>` : ''}
      </div>
    </div>
    ${total !== null && total > 0 ? `<div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${pct}%"></div></div>` : ''}
    ${pagosActuales.length ? `<div class="pago-list">${pagosHTML}</div>` : `<div class="text-muted text-sm" style="margin-bottom:12px">Sin pagos registrados.</div>`}
    ${saldo !== null && saldo > 0 ? `<div class="saldo-row"><span class="saldo-label">Saldo pendiente</span><span class="saldo-monto">${fmtMoney(saldo)}</span></div>` : ''}
    ${saldo !== null && saldo <= 0 && totalPagado > 0 ? `<div class="pago-completo">✓ Pago completo</div>` : ''}
    ${canEdit ? `<button class="btn-outline-naranja" id="btnRegistrarPago">${PLUS_SVG}Registrar pago</button>` : ''}
  `;

  document.getElementById('btnRegistrarPago')?.addEventListener('click', abrirModalPago);
}

async function eliminarPago(pagoId) {
  if (!App.confirm('¿Eliminar este pago?')) return;
  try {
    await API.del(`/api/ordenes/${otId}/pagos/${pagoId}`);
    await cargarPagos();
    App.toast('Pago eliminado', 'success');
  } catch (e) { App.toast(e.message || 'Error', 'error'); }
}

function abrirModalPago() {
  document.getElementById('pagoMedio').value = 'efectivo';
  document.getElementById('grupoProveedor').classList.add('hidden');
  document.getElementById('pagoProveedor').value = '';
  document.getElementById('pagoMonto').value = '';
  document.getElementById('pagoNotas').value = '';
  App.openModal('modalPago');
}

async function guardarPago() {
  const medio     = document.getElementById('pagoMedio').value;
  const proveedor = document.getElementById('pagoProveedor').value.trim();
  const monto     = parseInt(document.getElementById('pagoMonto').value.replace(/\./g, '').replace(/[^0-9]/g, '')) || 0;
  const notas     = document.getElementById('pagoNotas').value.trim();

  if (medio === 'puente' && !proveedor) return App.toast('Ingresá el proveedor destino', 'error');
  if (!monto || monto <= 0)             return App.toast('Ingresá un monto válido', 'error');

  const btn = document.getElementById('btnGuardarPago');
  btn.disabled = true;
  try {
    await API.post(`/api/ordenes/${otId}/pagos`, { medio, proveedor, monto, notas });
    App.closeModal('modalPago');
    await cargarPagos();
    App.toast('Pago registrado', 'success');
  } catch (e) {
    App.toast(e.message || 'Error al registrar el pago', 'error');
  } finally {
    btn.disabled = false;
  }
}

async function guardarItem() {
  const tipo            = document.getElementById('itemTipo').value;
  const descripcion     = document.getElementById('itemDescripcion').value.trim();
  const cantidad        = parseFloat(document.getElementById('itemCantidad').value) || 1;
  const precio_unitario = parseInt(document.getElementById('itemPrecio').value.replace(/\./g, '').replace(/[^0-9]/g, '')) || 0;

  if (!descripcion) return App.toast('La descripción es requerida', 'error');

  const btn = document.getElementById('btnGuardarItem');
  btn.disabled = true;
  try {
    if (editandoItemId) {
      await API.patch(`/api/presupuestos/${presupuestoActual.id}/items/${editandoItemId}`, {
        tipo, descripcion, cantidad, precio_unitario
      });
      App.toast('Ítem actualizado', 'success');
    } else {
      await API.post(`/api/presupuestos/${presupuestoActual.id}/items`, {
        tipo, descripcion, cantidad, precio_unitario
      });
      App.toast('Ítem agregado', 'success');
    }
    presupuestoActual = await API.get(`/api/ordenes/${otId}/presupuesto`);
    renderPresupuesto();
    App.closeModal('modalAgregarItem');
  } catch (e) {
    App.toast(e.message || 'Error', 'error');
  } finally {
    btn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('itemTipo')?.addEventListener('change', e => _actualizarCamposCantidad(e.target.value));
  document.getElementById('btnGuardarItem')?.addEventListener('click', guardarItem);

  document.getElementById('pagoMedio')?.addEventListener('change', e => {
    const grupoProveedor = document.getElementById('grupoProveedor');
    if (e.target.value === 'puente') {
      grupoProveedor.classList.remove('hidden');
    } else {
      grupoProveedor.classList.add('hidden');
      document.getElementById('pagoProveedor').value = '';
    }
  });
  document.getElementById('btnGuardarPago')?.addEventListener('click', guardarPago);
});
