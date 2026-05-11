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
  ingresada: 'Ingresada', en_diagnostico: 'En diagnóstico', presupuestada: 'Presupuestada',
  aprobada: 'Aprobada', en_reparacion: 'En reparación', esperando_repuesto: 'Esperando repuesto',
  lista: 'Lista', entregada: 'Entregada', cancelada: 'Cancelada'
};
const FLUJO_PRINCIPAL = ['ingresada','en_diagnostico','presupuestada','aprobada','en_reparacion','lista','entregada'];

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
  const vencida = ot.fecha_prometida && new Date(ot.fecha_prometida) < new Date() && !['entregada','cancelada'].includes(ot.estado);

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
            ${ot.cliente_telefono ? `<span>📞 ${esc(ot.cliente_telefono)}</span>` : ''}
            ${ot.anio ? `<span>📅 ${ot.anio}</span>` : ''}
            ${ot.color ? `<span>🎨 ${esc(ot.color)}</span>` : ''}
            <span>🔢 ${ot.km_ingreso || 0} km</span>
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
          const current = est === ot.estado || (ot.estado === 'esperando_repuesto' && est === 'en_reparacion');
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

    <div class="grid-2" style="gap:14px; margin-bottom:14px">
      <!-- Datos del ingreso -->
      <div class="card">
        <h3 style="font-weight:700; font-size:0.9375rem; margin-bottom:12px; color:var(--text)">Datos del ingreso</h3>
        <div style="display:flex; flex-direction:column; gap:6px">
          <div class="text-sm text-muted">Ingreso: <strong style="color:var(--text-2)">${fmtDateTime(ot.fecha_ingreso)}</strong></div>
          ${ot.fecha_prometida ? `<div class="text-sm text-muted">Prometida: <strong style="color:var(--text-2)">${fmtDate(ot.fecha_prometida)}</strong></div>` : ''}
          ${ot.mecanico_nombre
            ? `<div class="text-sm text-muted">🔧 <strong style="color:var(--text-2)">${esc(ot.mecanico_nombre)}</strong></div>`
            : `<div class="text-sm text-muted">Sin mecánico asignado</div>`}
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

      <!-- Historial de estados -->
      <div class="card">
        <h3 style="font-weight:700; font-size:0.9375rem; margin-bottom:12px; color:var(--text)">Historial</h3>
        <ul class="historial-list" id="historialList">
          ${(ot.historial || []).map(h => `
            <li class="historial-item">
              <div class="historial-dot"></div>
              <div>
                <div style="line-height:1.4">
                  ${h.estado_anterior
                    ? `<span class="estado-badge estado-${h.estado_anterior}" style="font-size:0.6875rem">${esc(ESTADO_LABELS[h.estado_anterior] || h.estado_anterior)}</span> → `
                    : ''}
                  <span class="estado-badge estado-${h.estado_nuevo}" style="font-size:0.6875rem">${esc(ESTADO_LABELS[h.estado_nuevo] || h.estado_nuevo)}</span>
                </div>
                <div class="historial-meta">${esc(h.display_name || '—')} · ${fmtDateTime(h.created_at)}${h.notas ? `<br><em style="color:var(--text-2)">${esc(h.notas)}</em>` : ''}</div>
              </div>
            </li>`).join('')}
        </ul>
      </div>
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
  try {
    const mecs = await API.get('/api/mecanicos');
    const sel = document.getElementById('editMecanico');
    sel.innerHTML = '<option value="">— Sin asignar —</option>' +
      mecs.map(m => `<option value="${m.id}" ${m.id === otActual.mecanico_id ? 'selected' : ''}>${esc(m.nombre)}</option>`).join('');
  } catch {}
  document.getElementById('editKm').value = otActual.km_ingreso || 0;
  document.getElementById('editPrioridad').value = otActual.prioridad || '';
  document.getElementById('editProblema').value = otActual.problema_declarado || '';
  document.getElementById('editObservaciones').value = otActual.observaciones_internas || '';
  document.getElementById('editFechaPrometida').value = otActual.fecha_prometida?.slice(0,10) || '';
  App.openModal('modalEditarOT');

  document.getElementById('btnGuardarEdicion').onclick = async () => {
    try {
      otActual = await API.patch(`/api/ordenes/${otId}`, {
        mecanico_id:          document.getElementById('editMecanico').value || null,
        km_ingreso:           document.getElementById('editKm').value || 0,
        prioridad:            document.getElementById('editPrioridad').value || null,
        problema_declarado:   document.getElementById('editProblema').value,
        observaciones_internas: document.getElementById('editObservaciones').value,
        fecha_prometida:      document.getElementById('editFechaPrometida').value || null
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
    if (acciones && App.canEdit() && !['entregada','cancelada'].includes(otActual.estado)) {
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

const PRES_ESTADO_LABELS  = { borrador: 'Borrador', presentado: 'Presentado', aprobado: 'Aprobado ✓', rechazado: 'Rechazado' };
const PRES_ESTADO_COLORS  = { borrador: 'var(--text-muted)', presentado: '#1D4ED8', aprobado: '#065F46', rechazado: '#EF4444' };

function renderPresupuesto() {
  const pres    = presupuestoActual;
  const items   = pres.items || [];
  const canEdit = App.canEdit();

  const subtotal  = items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);
  const descMonto = (subtotal * (pres.descuento || 0)) / 100;
  const total     = subtotal - descMonto;

  const acciones = document.getElementById('accionesPresupuesto');
  if (acciones) {
    let btns = `<span style="font-size:0.8125rem; font-weight:700; color:${PRES_ESTADO_COLORS[pres.estado]}">${esc(PRES_ESTADO_LABELS[pres.estado])}</span>`;
    if (canEdit) {
      btns += ` <button class="btn btn-secondary btn-sm" id="btnAgregarItem">+ Ítem</button>`;
      btns += ` <button class="btn btn-secondary btn-sm" id="btnWA">📱 WhatsApp</button>`;
      if (pres.estado === 'borrador')    btns += ` <button class="btn btn-secondary btn-sm" id="btnPresentar">Presentar</button>`;
      if (pres.estado === 'presentado')  btns += ` <button class="btn btn-secondary btn-sm" id="btnVolvBorrador">← Borrador</button>`;
      if (pres.estado === 'presentado')  btns += ` <button class="btn btn-success btn-sm" id="btnAprobar">✓ Aprobar</button>`;
    }
    if (['lista','entregada'].includes(otActual.estado)) {
      btns += ` <button class="btn btn-secondary btn-sm" onclick="window.print()">🖨️ Imprimir</button>`;
    }
    acciones.innerHTML = btns;
    document.getElementById('btnAgregarItem')?.addEventListener('click', abrirModalItem);
    document.getElementById('btnWA')?.addEventListener('click', compartirWhatsApp);
    document.getElementById('btnPresentar')?.addEventListener('click', () => cambiarEstadoPres('presentado'));
    document.getElementById('btnVolvBorrador')?.addEventListener('click', () => cambiarEstadoPres('borrador'));
    document.getElementById('btnAprobar')?.addEventListener('click', aprobarPresupuesto);
  }

  const contenido = document.getElementById('contenidoPresupuesto');
  if (!items.length) {
    contenido.innerHTML = `<div class="text-muted text-sm">Sin ítems. ${canEdit ? 'Usá "+ Ítem" para agregar.' : ''}</div>`;
    return;
  }

  contenido.innerHTML = `
    <div class="presup-items">
      ${items.map(item => `
        <div class="presup-item">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:5px">
            <span style="font-size:0.6875rem; font-weight:700; padding:3px 8px; border-radius:99px;
              background:${item.tipo==='repuesto'?'#EDE9FE':'#FFF4EE'};
              color:${item.tipo==='repuesto'?'#5B21B6':'#EA580C'}">${item.tipo==='repuesto'?'Repuesto':'M. de obra'}</span>
            <span style="font-weight:700; font-size:0.9375rem">${fmtMoney(item.cantidad * item.precio_unitario)}</span>
          </div>
          <div style="font-size:0.9375rem; margin-bottom:5px; color:var(--text)">${esc(item.descripcion)}</div>
          <div style="display:flex; align-items:center; justify-content:space-between">
            <span class="text-sm text-muted">${item.tipo !== 'mano_obra' ? `x${item.cantidad} · ` : ''}${fmtMoney(item.precio_unitario)} c/u</span>
            ${canEdit ? `<div style="display:flex; gap:2px">
              <button class="btn btn-sm" style="color:var(--primary);background:none;border:none;cursor:pointer;padding:4px 8px;height:32px" onclick="abrirEditarItem(${item.id})">✏️</button>
              <button class="btn btn-sm" style="color:#EF4444;background:none;border:none;cursor:pointer;padding:4px 8px;height:32px" onclick="eliminarItem(${pres.id},${item.id})">✕</button>
            </div>` : ''}
          </div>
        </div>`).join('')}
    </div>
    <div class="presupuesto-totales">
      <div class="presupuesto-total-row"><label>Subtotal</label><span>${fmtMoney(subtotal)}</span></div>
      ${pres.descuento > 0 ? `<div class="presupuesto-total-row"><label>Descuento (${pres.descuento}%)</label><span>-${fmtMoney(descMonto)}</span></div>` : ''}
      <div class="presupuesto-total-row grand-total"><label>Total</label><span>${fmtMoney(total)}</span></div>
    </div>
    ${pres.aprobado_por ? `<div class="text-sm text-muted mt-2">✓ Aprobado por: <strong>${esc(pres.aprobado_por)}</strong> el ${fmtDate(pres.aprobado_at)}</div>` : ''}
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

async function cambiarEstadoPres(estado) {
  try {
    presupuestoActual = await API.patch(`/api/presupuestos/${presupuestoActual.id}`, { estado });
    renderPresupuesto();
  } catch (e) { App.toast(e.message || 'Error', 'error'); }
}

async function aprobarPresupuesto() {
  const quien = prompt('Nombre de quien aprueba el presupuesto:');
  if (!quien) return;
  try {
    presupuestoActual = await API.patch(`/api/presupuestos/${presupuestoActual.id}`, { estado: 'aprobado', aprobado_por: quien });
    renderPresupuesto();
    App.toast('Presupuesto aprobado', 'success');
  } catch (e) { App.toast(e.message || 'Error', 'error'); }
}

async function compartirWhatsApp() {
  try {
    const { texto } = await API.get(`/api/presupuestos/${presupuestoActual.id}/whatsapp`);
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
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
      <span style="color:var(--state-lista-fg); font-weight:700">✓ Pago completo</span>
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
