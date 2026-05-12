const otId = Number(new URLSearchParams(window.location.search).get('id'));
let otActual = null;
let presupuestoActual = null;
let pagosActuales = [];
let editandoItemId = null;

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
const FLUJO_PRINCIPAL = ['recibida', 'en_reparacion', 'entregada'];

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
  const vencida = ot.fecha_prometida && new Date(ot.fecha_prometida) < new Date() && ot.estado !== 'entregada';

  document.title = `${ot.numero} — Taller Motos`;

  document.getElementById('paginaDetalle').innerHTML = `
    <div style="margin-bottom:14px">
      <a href="/ordenes" style="color:var(--text-muted); text-decoration:none; font-size:0.875rem; font-weight:500; display:inline-flex; align-items:center; gap:4px">
        ← Volver a órdenes
      </a>
    </div>

    <!-- Encabezado OT -->
    <div class="card" style="margin-bottom:14px">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
        <div>
          <div class="text-muted text-xs" style="font-weight:600; letter-spacing:0.04em; margin-bottom:4px">${esc(ot.numero)}</div>
          <h1 class="ot-detalle-title" style="font-size:1.375rem; font-weight:900; letter-spacing:-0.02em; margin-bottom:6px">${esc(ot.patente)} — ${esc(ot.marca)} ${esc(ot.modelo)}</h1>
          <div style="display:flex; gap:12px; flex-wrap:wrap; font-size:0.875rem; color:var(--text-2); align-items:center">
            <span>👤 ${esc(ot.cliente_nombre)}</span>
            ${ot.cliente_telefono ? `<a href="${waLink(ot.cliente_telefono)}" target="_blank" style="color:inherit; text-decoration:none">📞 ${esc(ot.cliente_telefono)}</a>` : ''}
            ${ot.color ? `<span>🎨 ${esc(ot.color)}</span>` : ''}
          </div>
        </div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap">
          <span class="estado-badge estado-${ot.estado}" style="font-size:0.8125rem; padding:5px 12px">${esc(ESTADO_LABELS[ot.estado])}</span>
          ${App.canEdit() ? `<button class="btn btn-secondary btn-sm" id="btnEditarOT">Editar</button>` : ''}
          ${ot.transiciones_validas?.length ? `<button class="btn btn-primary btn-sm" id="btnCambiarEstado">Cambiar estado</button>` : ''}
        </div>
      </div>

      <!-- Barra de progreso -->
      <div class="ot-progress" style="margin-top:18px">
        ${FLUJO_PRINCIPAL.map((est, i) => {
          const idxActual = FLUJO_PRINCIPAL.indexOf(ot.estado);
          const done    = i < idxActual;
          const current = est === ot.estado;
          const line    = i < FLUJO_PRINCIPAL.length - 1 ? `<div class="ot-progress-line ${done ? 'done' : ''}"></div>` : '';
          return `
            <div class="ot-progress-step">
              <div class="ot-progress-dot ${done ? 'done' : current ? 'current' : ''}"></div>
              <div class="ot-progress-label ${current ? 'active' : ''}">${esc(ESTADO_LABELS[est])}</div>
            </div>${line}`;
        }).join('')}
      </div>

      ${vencida ? `<div class="badge-vencida" style="display:inline-flex; align-items:center; gap:4px; margin-top:14px">⚠️ Fecha prometida vencida</div>` : ''}
    </div>

    <!-- Datos del ingreso -->
    <div class="card" style="margin-bottom:14px">
      <h3 style="font-weight:700; font-size:0.9375rem; margin-bottom:12px; color:var(--text)">Datos del ingreso</h3>
      <div style="display:flex; flex-direction:column; gap:6px">
        <div class="text-sm text-muted">Ingreso: <strong style="color:var(--text-2)">${fmtDateTime(ot.fecha_ingreso)}</strong></div>
        ${ot.fecha_prometida ? `<div class="text-sm text-muted">Prometida: <strong style="color:var(--text-2)">${fmtDate(ot.fecha_prometida)}</strong></div>` : ''}
        ${ot.prioridad ? `<div class="text-sm text-muted">⏱ Apuro: <strong style="color:var(--text-2)">${fmtPrioridad(ot)}</strong></div>` : ''}
        ${ot.cedula ? `<div class="text-sm text-muted">${ot.cedula === 'fisica' ? '🪪' : '📱'} Cédula: <strong style="color:var(--text-2)">${ot.cedula === 'fisica' ? 'Física' : 'Digital'}</strong></div>` : ''}
      </div>
      <div style="margin-top:14px; padding-top:12px; border-top:1px solid var(--border)">
        <div class="text-xs text-muted" style="font-weight:700; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:6px">Problema declarado</div>
        <div style="white-space:pre-wrap; font-size:0.9375rem; line-height:1.5; color:var(--text)">${esc(ot.problema_declarado || '—')}</div>
      </div>
      ${ot.observaciones_internas ? `
      <div style="margin-top:12px; background:var(--bg-subtle); border-radius:var(--radius-sm); padding:12px">
        <div class="text-xs text-muted" style="font-weight:700; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:6px">Obs. internas</div>
        <div style="white-space:pre-wrap; font-size:0.875rem; line-height:1.5; color:var(--text-2)">${esc(ot.observaciones_internas)}</div>
      </div>` : ''}
    </div>

    <!-- Presupuesto -->
    <div class="card" id="seccionPresupuesto" style="margin-bottom:14px">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:8px">
        <h3 style="font-weight:700; font-size:0.9375rem">Presupuesto</h3>
        <div style="display:flex; gap:8px; flex-wrap:wrap;" id="accionesPresupuesto"></div>
      </div>
      <div id="contenidoPresupuesto"><div class="text-muted text-sm">Sin presupuesto aún</div></div>
    </div>

    <!-- Pagos -->
    <div class="card" id="seccionPagos">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:8px">
        <h3 style="font-weight:700; font-size:0.9375rem">Pagos</h3>
        ${App.canEdit() ? `<button class="btn btn-secondary btn-sm" id="btnRegistrarPago">+ Registrar pago</button>` : ''}
      </div>
      <div id="contenidoPagos"><div class="text-muted text-sm">Cargando...</div></div>
    </div>
  `;

  document.getElementById('btnCambiarEstado')?.addEventListener('click', abrirCambiarEstado);
  document.getElementById('btnEditarOT')?.addEventListener('click', abrirEditarOT);
  document.getElementById('btnRegistrarPago')?.addEventListener('click', abrirModalPago);
}

// ── Cambiar estado ────────────────────────────────────────────────────────
function abrirCambiarEstado() {
  const transiciones = otActual.transiciones_validas || [];
  document.getElementById('notasEstado').value = '';
  document.getElementById('listaBotonesEstado').innerHTML = transiciones.map(est =>
    `<button class="btn btn-secondary" style="width:100%; justify-content:flex-start; gap:10px"
             onclick="cambiarEstado('${est}')">
       <span class="estado-badge estado-${est}" style="font-size:0.8125rem">${esc(ESTADO_LABELS[est])}</span>
     </button>`
  ).join('');
  App.openModal('modalCambiarEstado');
}

async function cambiarEstado(nuevoEstado) {
  const notas = document.getElementById('notasEstado').value.trim();
  try {
    otActual = await API.patch(`/api/ordenes/${otId}/estado`, { estado: nuevoEstado, notas });
    App.closeModal('modalCambiarEstado');
    App.toast(`Estado: ${ESTADO_LABELS[nuevoEstado]}`, 'success');
    renderOT();
    await cargarPresupuesto();
  } catch (e) {
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
  } catch {
    const acciones = document.getElementById('accionesPresupuesto');
    if (acciones && App.canEdit() && otActual.estado !== 'entregada') {
      acciones.innerHTML = `<button class="btn btn-secondary btn-sm" id="btnCrearPresupuesto">Crear presupuesto</button>`;
      document.getElementById('btnCrearPresupuesto')?.addEventListener('click', crearPresupuesto);
    }
  }
}

async function crearPresupuesto() {
  try {
    presupuestoActual = await API.post(`/api/ordenes/${otId}/presupuesto`, {});
    renderPresupuesto();
    App.toast('Presupuesto creado', 'success');
  } catch (e) {
    App.toast(e.message || 'Error', 'error');
  }
}

function renderPresupuesto() {
  const pres    = presupuestoActual;
  const items   = pres.items || [];
  const canEdit = App.canEdit();

  const subtotal  = items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);
  const descMonto = (subtotal * (pres.descuento || 0)) / 100;
  const total     = subtotal - descMonto;

  const acciones = document.getElementById('accionesPresupuesto');
  if (acciones) {
    let btns = '';
    if (canEdit) {
      btns += `<button class="btn btn-secondary btn-sm" id="btnAgregarItem">+ Ítem</button>`;
      btns += ` <button class="btn btn-secondary btn-sm" id="btnWA">📱 WhatsApp</button>`;
    }
    if (otActual.estado === 'entregada') {
      btns += ` <button class="btn btn-secondary btn-sm" onclick="window.print()">🖨️ Imprimir</button>`;
    }
    acciones.innerHTML = btns;
    document.getElementById('btnAgregarItem')?.addEventListener('click', abrirModalItem);
    document.getElementById('btnWA')?.addEventListener('click', compartirWhatsApp);
  }

  const contenido = document.getElementById('contenidoPresupuesto');
  if (!items.length) {
    contenido.innerHTML = `<div class="text-muted text-sm">Sin ítems. ${canEdit ? 'Usá "+ Ítem" para agregar.' : ''}</div>`;
    return;
  }

  const repuestos = items.filter(i => i.tipo === 'repuesto');
  const manoObra  = items.filter(i => i.tipo === 'mano_obra');
  const subRep    = repuestos.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);
  const subMO     = manoObra.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);

  function renderItems(lista) {
    return lista.map(item => `
      <div class="presup-item" style="padding:7px 0">
        <div style="display:flex; align-items:center; gap:8px">
          <span style="font-size:0.875rem; font-weight:600; flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${esc(item.descripcion)}</span>
          <span style="font-weight:700; font-size:0.875rem; flex-shrink:0">${fmtMoney(item.cantidad * item.precio_unitario)}</span>
          ${canEdit ? `
            <button onclick="abrirEditarItem(${item.id})" style="background:none;border:none;cursor:pointer;padding:2px 4px;color:var(--text-muted);font-size:0.875rem;flex-shrink:0;line-height:1">✏️</button>
            <button onclick="eliminarItem(${pres.id},${item.id})" style="background:none;border:none;cursor:pointer;padding:2px 4px;color:#EF4444;font-size:0.875rem;flex-shrink:0;line-height:1">✕</button>
          ` : ''}
        </div>
        <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px">
          ${item.tipo !== 'mano_obra' ? `x${item.cantidad} · ` : ''}${fmtMoney(item.precio_unitario)} c/u
        </div>
      </div>`).join('');
  }

  function seccion(titulo, color, lista, subtotalMonto) {
    if (!lista.length) return '';
    return `
      <div style="margin-bottom:4px">
        <div style="display:flex; align-items:center; justify-content:space-between; padding:6px 0 4px; border-bottom:2px solid ${color}20">
          <span style="font-size:0.75rem; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; color:${color}">${titulo}</span>
        </div>
        <div class="presup-items">${renderItems(lista)}</div>
        <div style="display:flex; justify-content:flex-end; gap:16px; padding:6px 0; border-top:1px solid var(--border); font-size:0.875rem">
          <span style="color:var(--text-muted)">Subtotal ${titulo.toLowerCase()}</span>
          <span style="font-weight:700">${fmtMoney(subtotalMonto)}</span>
        </div>
      </div>`;
  }

  contenido.innerHTML = `
    ${seccion('Repuestos', '#5B21B6', repuestos, subRep)}
    ${repuestos.length && manoObra.length ? '<div style="height:8px"></div>' : ''}
    ${seccion('Mano de obra', '#EA580C', manoObra, subMO)}
    <div class="presupuesto-totales" style="margin-top:8px">
      ${pres.descuento > 0 ? `<div class="presupuesto-total-row"><label>Descuento (${pres.descuento}%)</label><span>-${fmtMoney(descMonto)}</span></div>` : ''}
      <div class="presupuesto-total-row grand-total"><label>Total</label><span>${fmtMoney(total)}</span></div>
    </div>
  `;
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
    window.open(`${base}?text=${encodeURIComponent(texto)}`, '_blank');
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

  const totalPagado = pagosActuales.reduce((s, p) => s + p.monto, 0);
  let saldo = null;
  if (presupuestoActual) {
    const items = presupuestoActual.items || [];
    const subtotal  = items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);
    const descMonto = (subtotal * (presupuestoActual.descuento || 0)) / 100;
    saldo = (subtotal - descMonto) - totalPagado;
  }

  contenido.innerHTML = `
    ${pagosActuales.length ? `
      <div class="presup-items">
        ${pagosActuales.map(p => `
          <div class="presup-item">
            <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:8px">
              <div>
                <div style="font-weight:600; font-size:0.9375rem">${esc(MEDIO_LABELS[p.medio] || p.medio)}</div>
                ${p.proveedor ? `<div class="text-sm text-muted">${esc(p.proveedor)}</div>` : ''}
                ${p.notas ? `<div class="text-sm text-muted">${esc(p.notas)}</div>` : ''}
              </div>
              <div style="display:flex; align-items:center; gap:6px; flex-shrink:0">
                <span style="font-weight:700; font-size:0.9375rem">${fmtMoney(p.monto)}</span>
                ${App.canEdit() ? `<button class="btn btn-sm" style="color:#EF4444;background:none;border:none;cursor:pointer;padding:4px 6px;height:32px" onclick="eliminarPago(${p.id})">✕</button>` : ''}
              </div>
            </div>
          </div>`).join('')}
      </div>` : `<div class="text-muted text-sm">Sin pagos registrados.</div>`}
    <div style="margin-top:14px; border-top:2px solid var(--border); padding-top:12px; display:flex; justify-content:flex-end; gap:24px; font-size:0.9375rem">
      <span style="color:var(--text-muted)">Total pagado:</span>
      <span style="font-weight:700; min-width:100px; text-align:right">${fmtMoney(totalPagado)}</span>
    </div>
    ${saldo !== null && saldo > 0 ? `
    <div style="display:flex; justify-content:flex-end; gap:24px; font-size:0.9375rem; margin-top:4px">
      <span style="color:var(--text-muted)">Saldo pendiente:</span>
      <span style="font-weight:700; color:#991B1B; min-width:100px; text-align:right">${fmtMoney(saldo)}</span>
    </div>` : saldo !== null && saldo <= 0 && totalPagado > 0 ? `
    <div style="display:flex; justify-content:flex-end; font-size:0.875rem; margin-top:6px">
      <span style="color:var(--state-entregada-fg); font-weight:700">✓ Pago completo</span>
    </div>` : ''}
  `;
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
