const otId = Number(new URLSearchParams(window.location.search).get('id'));
let otActual = null;
let presupuestoActual = null;
let pagosActuales = [];

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
    document.getElementById('paginaDetalle').innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>Orden no encontrada</p></div>`;
  }
}

function renderOT() {
  const ot = otActual;
  const vencida = ot.fecha_prometida && new Date(ot.fecha_prometida) < new Date() && !['entregada','cancelada'].includes(ot.estado);

  document.title = `${ot.numero} — Taller Motos`;

  document.getElementById('paginaDetalle').innerHTML = `
    <div style="margin-bottom:12px">
      <a href="/ordenes" style="color:var(--text-muted); text-decoration:none; font-size:0.85rem">← Volver</a>
    </div>

    <!-- Encabezado OT -->
    <div class="card" style="margin-bottom:16px">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
        <div>
          <div class="text-muted text-sm">${esc(ot.numero)}</div>
          <h1 style="font-size:1.4rem; font-weight:800; margin:4px 0">${esc(ot.patente)} — ${esc(ot.marca)} ${esc(ot.modelo)}</h1>
          <div style="display:flex; gap:12px; flex-wrap:wrap; font-size:0.875rem; color:var(--text-muted)">
            <span>👤 <a href="/clientes" style="color:inherit">${esc(ot.cliente_nombre)}</a></span>
            <span>📞 ${esc(ot.cliente_telefono || '—')}</span>
            ${ot.anio ? `<span>📅 ${ot.anio}</span>` : ''}
            ${ot.color ? `<span>🎨 ${ot.color}</span>` : ''}
            <span>🔢 ${ot.km_ingreso || 0} km</span>
          </div>
        </div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap">
          <span class="estado-badge estado-${ot.estado}" style="font-size:0.85rem; padding:5px 14px">${esc(ESTADO_LABELS[ot.estado])}</span>
          ${App.canEdit() ? `<button class="btn btn-secondary btn-sm" id="btnEditarOT">Editar</button>` : ''}
          ${ot.transiciones_validas?.length ? `<button class="btn btn-primary btn-sm" id="btnCambiarEstado">Cambiar estado</button>` : ''}
        </div>
      </div>

      <!-- Barra de progreso -->
      <div class="ot-progress mt-2" style="margin-top:16px">
        ${FLUJO_PRINCIPAL.map((est, i) => {
          const idxActual = FLUJO_PRINCIPAL.indexOf(ot.estado);
          const done = i < idxActual;
          const current = est === ot.estado || (ot.estado === 'esperando_repuesto' && est === 'en_reparacion');
          const line = i < FLUJO_PRINCIPAL.length - 1 ? `<div class="ot-progress-line ${done ? 'done' : ''}"></div>` : '';
          return `
            <div class="ot-progress-step">
              <div class="ot-progress-dot ${done ? 'done' : current ? 'current' : ''}"></div>
              <div class="ot-progress-label ${current ? 'active' : ''}">${esc(ESTADO_LABELS[est])}</div>
            </div>${line}`;
        }).join('')}
      </div>

      ${vencida ? `<div class="badge-vencida" style="margin-top:12px; display:inline-block">⚠️ Fecha prometida vencida</div>` : ''}
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px">
      <!-- Info del ingreso -->
      <div class="card">
        <h3 style="font-weight:700; margin-bottom:12px">Datos del ingreso</h3>
        <div class="text-sm text-muted mb-1">Ingreso: ${fmtDateTime(ot.fecha_ingreso)}</div>
        ${ot.fecha_prometida ? `<div class="text-sm text-muted mb-1">Prometida: ${fmtDate(ot.fecha_prometida)}</div>` : ''}
        ${ot.mecanico_nombre ? `<div class="text-sm text-muted mb-1">🔧 Mecánico: <strong>${esc(ot.mecanico_nombre)}</strong></div>` : '<div class="text-sm text-muted mb-1">Sin mecánico asignado</div>'}
        ${ot.cedula ? `<div class="text-sm text-muted mb-1">${ot.cedula === 'fisica' ? '🪪' : '📱'} Cédula: <strong>${ot.cedula === 'fisica' ? 'Física' : 'Digital'}</strong></div>` : ''}
        <div style="margin-top:12px">
          <div class="text-sm fw-bold">Problema declarado:</div>
          <div style="margin-top:4px; white-space:pre-wrap; font-size:0.9rem">${esc(ot.problema_declarado || '—')}</div>
        </div>
        ${ot.observaciones_internas ? `
        <div style="margin-top:12px; background:var(--bg); border-radius:8px; padding:10px">
          <div class="text-sm fw-bold text-muted">Observaciones internas:</div>
          <div style="margin-top:4px; white-space:pre-wrap; font-size:0.85rem; color:var(--text-muted)">${esc(ot.observaciones_internas)}</div>
        </div>` : ''}
      </div>

      <!-- Historial de estados -->
      <div class="card">
        <h3 style="font-weight:700; margin-bottom:12px">Historial</h3>
        <ul class="historial-list" id="historialList">
          ${(ot.historial || []).map(h => `
            <li class="historial-item">
              <div class="historial-dot"></div>
              <div>
                <div>${h.estado_anterior ? `<span class="estado-badge estado-${h.estado_anterior}" style="font-size:0.68rem">${esc(ESTADO_LABELS[h.estado_anterior] || h.estado_anterior)}</span> → ` : ''}
                <span class="estado-badge estado-${h.estado_nuevo}" style="font-size:0.68rem">${esc(ESTADO_LABELS[h.estado_nuevo] || h.estado_nuevo)}</span></div>
                <div class="historial-meta">${esc(h.display_name || '—')} · ${fmtDateTime(h.created_at)}${h.notas ? `<br><em>${esc(h.notas)}</em>` : ''}</div>
              </div>
            </li>`).join('')}
        </ul>
      </div>
    </div>

    <!-- Presupuesto -->
    <div class="card" id="seccionPresupuesto">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px">
        <h3 style="font-weight:700">Presupuesto</h3>
        <div style="display:flex; gap:8px;" id="accionesPresupuesto"></div>
      </div>
      <div id="contenidoPresupuesto"><div class="text-muted text-sm">Sin presupuesto aún</div></div>
    </div>

    <!-- Pagos -->
    <div class="card" id="seccionPagos" style="margin-top:16px">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px">
        <h3 style="font-weight:700">Pagos</h3>
        ${App.canEdit() ? `<button class="btn btn-secondary btn-sm" id="btnRegistrarPago">+ Registrar pago</button>` : ''}
      </div>
      <div id="contenidoPagos"><div class="text-muted text-sm">Cargando...</div></div>
    </div>
  `;

  // Eventos
  document.getElementById('btnCambiarEstado')?.addEventListener('click', abrirCambiarEstado);
  document.getElementById('btnEditarOT')?.addEventListener('click', abrirEditarOT);
  document.getElementById('btnRegistrarPago')?.addEventListener('click', abrirModalPago);
}

// ── Cambiar estado ─────────────────────────────────────────────────────────
function abrirCambiarEstado() {
  const transiciones = otActual.transiciones_validas || [];
  document.getElementById('notasEstado').value = '';
  document.getElementById('listaBotonesEstado').innerHTML = transiciones.map(est =>
    `<button class="btn btn-secondary" style="width:100%; margin-bottom:8px; justify-content:flex-start"
             onclick="cambiarEstado('${est}')">
       <span class="estado-badge estado-${est}" style="font-size:0.75rem">${esc(ESTADO_LABELS[est])}</span>
     </button>`
  ).join('');
  App.openModal('modalCambiarEstado');
}

async function cambiarEstado(nuevoEstado) {
  const notas = document.getElementById('notasEstado').value.trim();
  try {
    otActual = await API.patch(`/api/ordenes/${otId}/estado`, { estado: nuevoEstado, notas });
    App.closeModal('modalCambiarEstado');
    App.toast(`Estado actualizado: ${ESTADO_LABELS[nuevoEstado]}`, 'success');
    renderOT();
    await cargarPresupuesto();
  } catch (e) {
    App.toast(e.message || 'Error al cambiar estado', 'error');
  }
}

// ── Editar OT ─────────────────────────────────────────────────────────────
async function abrirEditarOT() {
  // Cargar mecánicos
  try {
    const mecs = await API.get('/api/mecanicos');
    const sel = document.getElementById('editMecanico');
    sel.innerHTML = '<option value="">— Sin asignar —</option>' +
      mecs.map(m => `<option value="${m.id}" ${m.id === otActual.mecanico_id ? 'selected' : ''}>${esc(m.nombre)}</option>`).join('');
  } catch {}
  document.getElementById('editKm').value = otActual.km_ingreso || 0;
  document.getElementById('editProblema').value = otActual.problema_declarado || '';
  document.getElementById('editObservaciones').value = otActual.observaciones_internas || '';
  document.getElementById('editFechaPrometida').value = otActual.fecha_prometida?.slice(0,10) || '';
  App.openModal('modalEditarOT');

  document.getElementById('btnGuardarEdicion').onclick = async () => {
    try {
      otActual = await API.patch(`/api/ordenes/${otId}`, {
        mecanico_id: document.getElementById('editMecanico').value || null,
        km_ingreso: document.getElementById('editKm').value || 0,
        problema_declarado: document.getElementById('editProblema').value,
        observaciones_internas: document.getElementById('editObservaciones').value,
        fecha_prometida: document.getElementById('editFechaPrometida').value || null
      });
      App.closeModal('modalEditarOT');
      App.toast('OT actualizada', 'success');
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
    // No existe aún
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

const PRES_ESTADO_LABELS = { borrador: 'Borrador', presentado: 'Presentado', aprobado: 'Aprobado ✓', rechazado: 'Rechazado' };
const PRES_ESTADO_COLORS = { borrador: '#6B7280', presentado: '#3B82F6', aprobado: '#059669', rechazado: '#EF4444' };

function renderPresupuesto() {
  const pres = presupuestoActual;
  const items = pres.items || [];
  const canEdit = App.canEdit();

  const subtotal = items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);
  const descMonto = (subtotal * (pres.descuento || 0)) / 100;
  const total = subtotal - descMonto;

  const acciones = document.getElementById('accionesPresupuesto');
  if (acciones) {
    let btns = `<span style="font-size:0.8rem; font-weight:600; color:${PRES_ESTADO_COLORS[pres.estado]}">${esc(PRES_ESTADO_LABELS[pres.estado])}</span>`;
    if (canEdit) {
      btns += ` <button class="btn btn-secondary btn-sm" id="btnAgregarItem">+ Ítem</button>`;
      btns += ` <button class="btn btn-secondary btn-sm" id="btnWA">📱 WhatsApp</button>`;
      if (pres.estado === 'borrador') btns += ` <button class="btn btn-secondary btn-sm" id="btnPresentar">Presentar</button>`;
      if (pres.estado === 'presentado') btns += ` <button class="btn btn-success btn-sm" id="btnAprobar">Aprobar</button>`;
    }
    if (otActual.estado === 'lista' || otActual.estado === 'entregada') {
      btns += ` <button class="btn btn-secondary btn-sm" onclick="window.print()">🖨️ Imprimir</button>`;
    }
    acciones.innerHTML = btns;
    document.getElementById('btnAgregarItem')?.addEventListener('click', abrirModalItem);
    document.getElementById('btnWA')?.addEventListener('click', compartirWhatsApp);
    document.getElementById('btnPresentar')?.addEventListener('click', () => cambiarEstadoPres('presentado'));
    document.getElementById('btnAprobar')?.addEventListener('click', aprobarPresupuesto);
  }

  const contenido = document.getElementById('contenidoPresupuesto');
  if (!items.length) {
    contenido.innerHTML = `<div class="text-muted text-sm">Sin ítems. ${canEdit ? 'Usá "+ Ítem" para agregar.' : ''}</div>`;
    return;
  }

  contenido.innerHTML = `
    <div class="table-wrapper">
      <table class="presupuesto-table">
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Descripción</th>
            <th style="text-align:right">Cant.</th>
            <th style="text-align:right">Precio unit.</th>
            <th style="text-align:right">Subtotal</th>
            ${canEdit ? '<th></th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
            <tr>
              <td><span style="font-size:0.72rem; font-weight:600; padding:2px 8px; border-radius:99px; background:${item.tipo==='repuesto'?'#EDE9FE':'#FFF7ED'}; color:${item.tipo==='repuesto'?'#5B21B6':'#C2410C'}">${item.tipo==='repuesto'?'Repuesto':'M. de obra'}</span></td>
              <td>${esc(item.descripcion)}</td>
              <td style="text-align:right">${item.cantidad}</td>
              <td style="text-align:right">${fmtMoney(item.precio_unitario)}</td>
              <td style="text-align:right; font-weight:600">${fmtMoney(item.cantidad * item.precio_unitario)}</td>
              ${canEdit ? `<td><button class="btn btn-sm" style="color:#EF4444; background:none; border:none; cursor:pointer" onclick="eliminarItem(${pres.id},${item.id})">✕</button></td>` : ''}
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="presupuesto-totales">
      <div class="presupuesto-total-row"><label>Subtotal</label><span>${fmtMoney(subtotal)}</span></div>
      ${pres.descuento > 0 ? `<div class="presupuesto-total-row"><label>Descuento (${pres.descuento}%)</label><span>-${fmtMoney(descMonto)}</span></div>` : ''}
      <div class="presupuesto-total-row grand-total"><label>Total</label><span>${fmtMoney(total)}</span></div>
    </div>
    ${pres.aprobado_por ? `<div class="text-sm text-muted mt-2">Aprobado por: ${esc(pres.aprobado_por)} el ${fmtDate(pres.aprobado_at)}</div>` : ''}
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
  document.getElementById('itemTipo').value = 'repuesto';
  document.getElementById('itemDescripcion').value = '';
  document.getElementById('itemCantidad').value = '1';
  document.getElementById('itemPrecio').value = '0';
  _actualizarCamposCantidad('repuesto');
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
    const subtotal = items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);
    const descMonto = (subtotal * (presupuestoActual.descuento || 0)) / 100;
    saldo = (subtotal - descMonto) - totalPagado;
  }

  contenido.innerHTML = `
    ${pagosActuales.length ? `
      <table style="width:100%; border-collapse:collapse; font-size:0.875rem">
        <thead>
          <tr>
            <th style="text-align:left; padding:6px 10px; color:var(--text-muted); font-size:0.75rem; text-transform:uppercase; border-bottom:2px solid var(--border)">Medio</th>
            <th style="text-align:left; padding:6px 10px; color:var(--text-muted); font-size:0.75rem; text-transform:uppercase; border-bottom:2px solid var(--border)">Notas</th>
            <th style="text-align:right; padding:6px 10px; color:var(--text-muted); font-size:0.75rem; text-transform:uppercase; border-bottom:2px solid var(--border)">Monto</th>
            ${App.canEdit() ? '<th style="border-bottom:2px solid var(--border)"></th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${pagosActuales.map(p => `
            <tr>
              <td style="padding:8px 10px; border-bottom:1px solid var(--border)">
                ${esc(MEDIO_LABELS[p.medio] || p.medio)}
                ${p.proveedor ? `<br><span style="font-size:0.75rem; color:var(--text-muted)">${esc(p.proveedor)}</span>` : ''}
              </td>
              <td style="padding:8px 10px; border-bottom:1px solid var(--border); color:var(--text-muted)">${esc(p.notas || '—')}</td>
              <td style="padding:8px 10px; border-bottom:1px solid var(--border); text-align:right; font-weight:600">${fmtMoney(p.monto)}</td>
              ${App.canEdit() ? `<td style="padding:8px 10px; border-bottom:1px solid var(--border)"><button class="btn btn-sm" style="color:#EF4444; background:none; border:none; cursor:pointer" onclick="eliminarPago(${p.id})">✕</button></td>` : ''}
            </tr>`).join('')}
        </tbody>
      </table>
    ` : '<div class="text-muted text-sm">Sin pagos registrados.</div>'}
    <div style="margin-top:12px; border-top:2px solid var(--border); padding-top:12px; display:flex; justify-content:flex-end; gap:24px; font-size:0.9rem">
      <span style="color:var(--text-muted)">Total pagado:</span>
      <span style="font-weight:700; min-width:100px; text-align:right">${fmtMoney(totalPagado)}</span>
    </div>
    ${saldo !== null && saldo > 0 ? `
    <div style="display:flex; justify-content:flex-end; gap:24px; font-size:0.9rem; margin-top:4px">
      <span style="color:var(--text-muted)">Saldo pendiente:</span>
      <span style="font-weight:700; color:#EF4444; min-width:100px; text-align:right">${fmtMoney(saldo)}</span>
    </div>` : saldo !== null && saldo <= 0 && totalPagado > 0 ? `
    <div style="display:flex; justify-content:flex-end; font-size:0.9rem; margin-top:4px">
      <span style="color:#059669; font-weight:600">✓ Pago completo</span>
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
  const medio = document.getElementById('pagoMedio').value;
  const proveedor = document.getElementById('pagoProveedor').value.trim();
  const monto = parseFloat(document.getElementById('pagoMonto').value) || 0;
  const notas = document.getElementById('pagoNotas').value.trim();

  if (medio === 'puente' && !proveedor) return App.toast('Ingresá el proveedor destino', 'error');
  if (!monto || monto <= 0) return App.toast('Ingresá un monto válido', 'error');

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

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('itemTipo')?.addEventListener('change', e => {
    _actualizarCamposCantidad(e.target.value);
  });
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

async function guardarItem() {
  const tipo = document.getElementById('itemTipo').value;
  const descripcion = document.getElementById('itemDescripcion').value.trim();
  const cantidad = parseFloat(document.getElementById('itemCantidad').value) || 1;
  const precio_unitario = parseFloat(document.getElementById('itemPrecio').value) || 0;

  if (!descripcion) return App.toast('La descripción es requerida', 'error');

  const btn = document.getElementById('btnGuardarItem');
  btn.disabled = true;
  try {
    await API.post(`/api/presupuestos/${presupuestoActual.id}/items`, {
      tipo, descripcion, cantidad, precio_unitario
    });
    presupuestoActual = await API.get(`/api/ordenes/${otId}/presupuesto`);
    renderPresupuesto();
    App.closeModal('modalAgregarItem');
    App.toast('Ítem agregado', 'success');
  } catch (e) {
    App.toast(e.message || 'Error', 'error');
  } finally {
    btn.disabled = false;
  }
}
