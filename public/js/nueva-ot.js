const NuevaOT = {
  motoId: null,
  clienteId: null,
  motoNueva: false,

  abrir() {
    this.motoId = null;
    this.clienteId = null;
    this.motoNueva = false;
    document.getElementById('inputPatente').value = '';
    document.getElementById('patenteStatus').textContent = '';
    document.getElementById('motoEncontrada').classList.add('hidden');
    document.getElementById('motoNueva').classList.add('hidden');
    document.getElementById('wizardStep1').classList.remove('hidden');
    document.getElementById('wizardStep2').classList.add('hidden');
    document.getElementById('clienteSeleccionado').classList.add('hidden');
    document.getElementById('formNuevoCliente').classList.add('hidden');
    document.getElementById('searchCliente').value = '';
    App.openModal('modalNuevaOT');
    setTimeout(() => document.getElementById('inputPatente').focus(), 100);
  },

  async buscarPatente(patente) {
    const p = patente.toUpperCase().replace(/\s+/g, '');
    if (p.length < 4) return;
    document.getElementById('patenteStatus').textContent = 'Buscando...';
    try {
      const moto = await API.get(`/api/motos/patente/${encodeURIComponent(p)}`);
      this.motoId = moto.id;
      this.clienteId = moto.cliente_id;
      this.motoNueva = false;
      document.getElementById('motoEncontrada').classList.remove('hidden');
      document.getElementById('motoNueva').classList.add('hidden');
      document.getElementById('motoEncontradaTitle').textContent = `${moto.patente} — ${moto.marca} ${moto.modelo} ${moto.anio || ''}`.trim();
      document.getElementById('motoEncontradaMeta').textContent = `Cliente: ${moto.cliente_nombre}${moto.ots_recientes?.length ? ` · ${moto.ots_recientes.length} visita(s) anterior(es)` : ''}`;
      document.getElementById('patenteStatus').textContent = '';
    } catch {
      this.motoId = null;
      this.motoNueva = true;
      document.getElementById('motoEncontrada').classList.add('hidden');
      document.getElementById('motoNueva').classList.remove('hidden');
      document.getElementById('patenteStatus').textContent = '✦ Moto nueva';
    }
  },

  async paso1Siguiente() {
    const patente = document.getElementById('inputPatente').value.trim().toUpperCase().replace(/\s+/g, '');
    if (!patente) return App.toast('Ingresá la patente', 'error');

    // Si el usuario apretó rápido antes de que termine el debounce, buscar ahora
    if (!this.motoId && !this.motoNueva && patente.length >= 4) {
      await this.buscarPatente(patente);
    }

    if (this.motoNueva) {
      if (!this.clienteId) return App.toast('Seleccioná o creá el cliente', 'error');
      // Crear moto nueva
      try {
        const moto = await API.post('/api/motos', {
          patente,
          marca: document.getElementById('newMotoMarca').value.trim(),
          modelo: document.getElementById('newMotoModelo').value.trim(),
          anio: document.getElementById('newMotoAnio').value || null,
          color: document.getElementById('newMotoColor').value.trim(),
          cliente_id: this.clienteId
        });
        this.motoId = moto.id;
      } catch (e) {
        return App.toast(e.message || 'Error al crear la moto', 'error');
      }
    }

    if (!this.motoId) return App.toast('Ingresá la patente y esperá la búsqueda', 'error');

    // Ir al paso 2
    document.getElementById('wizardStep1').classList.add('hidden');
    document.getElementById('wizardStep2').classList.remove('hidden');
    document.getElementById('wizardTitle').textContent = 'Datos del ingreso';

    // Cargar mecánicos
    await this._cargarMecanicos();
  },

  async _cargarMecanicos() {
    try {
      const mecs = await API.get('/api/mecanicos');
      const sel = document.getElementById('otMecanico');
      sel.innerHTML = '<option value="">— Sin asignar —</option>' +
        mecs.map(m => `<option value="${m.id}">${esc(m.nombre)}</option>`).join('');
    } catch {}
  },

  async crearOT() {
    const problema = document.getElementById('otProblema').value.trim();
    if (!problema) return App.toast('Describí el problema declarado por el cliente', 'error');

    const btn = document.getElementById('btnCrearOT');
    btn.disabled = true; btn.textContent = 'Creando...';
    try {
      const ot = await API.post('/api/ordenes', {
        moto_id: this.motoId,
        mecanico_id: document.getElementById('otMecanico').value || null,
        km_ingreso: document.getElementById('otKm').value || 0,
        problema_declarado: problema,
        observaciones_internas: document.getElementById('otObservaciones').value.trim(),
        fecha_prometida: document.getElementById('otFechaPrometida').value || null
      });
      App.closeModal('modalNuevaOT');
      App.toast(`OT ${ot.numero} creada`, 'success');
      window.location.href = `/ot-detalle?id=${ot.id}`;
    } catch (e) {
      App.toast(e.message || 'Error al crear la OT', 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Crear OT';
    }
  },

  async buscarCliente(q) {
    if (q.trim().length < 2) {
      document.getElementById('clienteResults').classList.add('hidden');
      return;
    }
    try {
      const clientes = await API.get(`/api/clientes?q=${encodeURIComponent(q)}&limit=8`);
      const res = document.getElementById('clienteResults');
      if (!clientes.length) { res.classList.add('hidden'); return; }
      res.innerHTML = clientes.map(c =>
        `<div style="padding:8px 12px; cursor:pointer; font-size:0.875rem; border-bottom:1px solid var(--border);"
              onmousedown="NuevaOT.seleccionarCliente(${c.id},'${esc(c.nombre)}')">${esc(c.nombre)} ${c.telefono ? `· ${esc(c.telefono)}` : ''}</div>`
      ).join('');
      res.classList.remove('hidden');
    } catch {}
  },

  seleccionarCliente(id, nombre) {
    this.clienteId = id;
    document.getElementById('searchCliente').value = nombre;
    document.getElementById('clienteResults').classList.add('hidden');
    document.getElementById('clienteSeleccionado').classList.remove('hidden');
    document.getElementById('clienteSeleccionado').textContent = `✓ ${nombre}`;
    document.getElementById('formNuevoCliente').classList.add('hidden');
  },

  async guardarNuevoCliente() {
    const nombre = document.getElementById('ncNombre').value.trim();
    const telefono = document.getElementById('ncTelefono').value.trim();
    if (!nombre) return App.toast('El nombre es requerido', 'error');
    try {
      const c = await API.post('/api/clientes', { nombre, telefono });
      this.seleccionarCliente(c.id, c.nombre);
      App.toast('Cliente creado', 'success');
    } catch (e) {
      App.toast(e.message || 'Error al crear el cliente', 'error');
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  // Patente con debounce
  let timer;
  document.getElementById('inputPatente')?.addEventListener('input', e => {
    clearTimeout(timer);
    const v = e.target.value;
    timer = setTimeout(() => NuevaOT.buscarPatente(v), 400);
  });

  document.getElementById('btnPaso1Siguiente')?.addEventListener('click', () => NuevaOT.paso1Siguiente());
  document.getElementById('btnPaso2Atras')?.addEventListener('click', () => {
    document.getElementById('wizardStep2').classList.add('hidden');
    document.getElementById('wizardStep1').classList.remove('hidden');
    document.getElementById('wizardTitle').textContent = 'Nueva Orden de Trabajo';
  });
  document.getElementById('btnCrearOT')?.addEventListener('click', () => NuevaOT.crearOT());

  // Búsqueda de cliente
  let timerCli;
  document.getElementById('searchCliente')?.addEventListener('input', e => {
    clearTimeout(timerCli);
    timerCli = setTimeout(() => NuevaOT.buscarCliente(e.target.value), 300);
  });
  document.getElementById('searchCliente')?.addEventListener('blur', () => {
    setTimeout(() => document.getElementById('clienteResults')?.classList.add('hidden'), 150);
  });

  document.getElementById('btnNuevoCliente')?.addEventListener('click', () => {
    document.getElementById('formNuevoCliente').classList.toggle('hidden');
  });
  document.getElementById('btnGuardarNuevoCliente')?.addEventListener('click', () => NuevaOT.guardarNuevoCliente());
});
