const NuevaOT = {
  motoId: null,
  clienteId: null,
  motoNueva: false,

  abrir() {
    this.motoId = null;
    this.clienteId = null;
    this.motoNueva = false;
    ['inputPatente','newMotoMarca','newMotoModelo','newMotoColor',
     'searchCliente','ncNombre','ncTelefono','otProblema','otObservaciones','otFechaPrometida']
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.querySelectorAll('input[name="otCedula"]').forEach(r => r.checked = false);
    document.querySelectorAll('input[name="otPrioridad"]').forEach(r => r.checked = false);
    document.getElementById('grupoPrioridadFecha')?.classList.add('hidden');
    document.getElementById('otFechaPrioridad') && (document.getElementById('otFechaPrioridad').value = '');
    document.getElementById('patenteStatus').textContent = '';
    document.getElementById('motoEncontrada').classList.add('hidden');
    document.getElementById('motoNuevaAlert').classList.add('hidden');
    document.getElementById('clienteSeleccionado').classList.add('hidden');
    document.getElementById('formNuevoCliente').classList.add('hidden');
    document.getElementById('clienteResults').classList.add('hidden');
    this._goTo(1);
    App.openModal('modalNuevaOT');
    setTimeout(() => document.getElementById('inputPatente').focus(), 100);
  },

  _goTo(step) {
    [1,2,3,4].forEach(n => document.getElementById(`wizardStep${n}`)?.classList.add('hidden'));
    const panel = document.getElementById(`wizardStep${step}`);
    if (panel) panel.classList.remove('hidden');
    const titles = {
      1: 'Nueva Orden',
      2: 'Datos de la moto',
      3: 'Titular de la moto',
      4: 'Datos del ingreso'
    };
    document.getElementById('wizardTitle').textContent = titles[step] || 'Nueva Orden';
    this._renderDots(step);
  },

  _renderDots(activeStep) {
    const flow = this.motoNueva ? [1,2,3,4] : [1,4];
    const pos = flow.indexOf(activeStep);
    const el = document.getElementById('wizardDots');
    if (!el) return;
    el.innerHTML = flow.map((s, i) => {
      const cls = i < pos ? 'wdot done' : i === pos ? 'wdot active' : 'wdot';
      return `<div class="${cls}"></div>${i < flow.length - 1 ? '<div class="wdot-line"></div>' : ''}`;
    }).join('');
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
      document.getElementById('motoNuevaAlert').classList.add('hidden');
      document.getElementById('motoEncontradaTitle').textContent = `${moto.patente} — ${moto.marca} ${moto.modelo} ${moto.anio || ''}`.trim();
      document.getElementById('motoEncontradaMeta').textContent = `Cliente: ${moto.cliente_nombre}${moto.ots_recientes?.length ? ` · ${moto.ots_recientes.length} visita(s) anterior(es)` : ''}`;
      document.getElementById('patenteStatus').textContent = '';
      this._renderDots(1);
    } catch {
      this.motoId = null;
      this.motoNueva = true;
      document.getElementById('motoEncontrada').classList.add('hidden');
      document.getElementById('motoNuevaAlert').classList.remove('hidden');
      document.getElementById('patenteStatus').textContent = '';
      this._renderDots(1);
    }
  },

  _shake(inputId, msg) {
    App.toast(msg, 'error');
    const el = document.getElementById(inputId);
    if (!el) return;
    el.classList.add('input-error', 'shake');
    setTimeout(() => el.classList.remove('shake'), 500);
    el.focus();
  },

  async paso1Siguiente() {
    const patente = document.getElementById('inputPatente').value.trim().toUpperCase().replace(/\s+/g, '');
    if (!patente || patente.length < 3) return this._shake('inputPatente', 'Ingresá la patente');

    if (!this.motoId && !this.motoNueva && patente.length >= 4) {
      await this.buscarPatente(patente);
    }
    if (!this.motoId && !this.motoNueva) return this._shake('inputPatente', 'Esperá el resultado de la búsqueda');

    if (this.motoNueva) {
      this._goTo(2);
      setTimeout(() => document.getElementById('newMotoMarca')?.focus(), 100);
    } else {
      this._goTo(4);
      setTimeout(() => document.getElementById('otProblema')?.focus(), 100);
    }
  },

  paso2Siguiente() {
    this._goTo(3);
    setTimeout(() => document.getElementById('searchCliente')?.focus(), 100);
  },

  async paso3Siguiente() {
    if (!this.clienteId) return this._shake('searchCliente', 'Seleccioná o creá el cliente');
    this._goTo(4);
    setTimeout(() => document.getElementById('otProblema')?.focus(), 100);
  },

  async crearOT() {
    const problema = document.getElementById('otProblema').value.trim();
    if (!problema) return this._shake('otProblema', 'Describí el problema declarado por el cliente');
    const prioridad = document.querySelector('input[name="otPrioridad"]:checked')?.value;
    if (!prioridad) return App.toast('Indicá el apuro del cliente', 'error');
    const fechaPrioridad = document.getElementById('otFechaPrioridad').value;
    if (prioridad === 'fecha_especifica' && !fechaPrioridad) return App.toast('Seleccioná la fecha específica', 'error');
    const cedula = document.querySelector('input[name="otCedula"]:checked')?.value;
    if (!cedula) return App.toast('Indicá si la cédula es física o digital', 'error');

    if (this.motoNueva) {
      const patente = document.getElementById('inputPatente').value.trim().toUpperCase().replace(/\s+/g, '');
      try {
        const moto = await API.post('/api/motos', {
          patente,
          marca: document.getElementById('newMotoMarca').value.trim(),
          modelo: document.getElementById('newMotoModelo').value.trim(),
          color: document.getElementById('newMotoColor').value.trim(),
          cliente_id: this.clienteId
        });
        this.motoId = moto.id;
      } catch (e) {
        return App.toast(e.message || 'Error al crear la moto', 'error');
      }
    }

    if (!this.motoId) return App.toast('Error: moto no identificada', 'error');

    const btn = document.getElementById('btnCrearOT');
    btn.disabled = true; btn.textContent = 'Creando...';
    try {
      const ot = await API.post('/api/ordenes', {
        moto_id: this.motoId,
        problema_declarado: problema,
        observaciones_internas: document.getElementById('otObservaciones').value.trim(),
        fecha_prometida: prioridad === 'fecha_especifica'
          ? fechaPrioridad
          : (document.getElementById('otFechaPrometida').value || null),
        prioridad,
        cedula
      });
      App.closeModal('modalNuevaOT');
      App.toast(`Orden ${ot.numero} creada`, 'success');
      window.location.href = `/ot-detalle?id=${ot.id}`;
    } catch (e) {
      App.toast(e.message || 'Error al crear la orden', 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Crear Orden';
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
    if (!nombre) return this._shake('ncNombre', 'El nombre es requerido');
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
  // Auto-uppercase para campos marcados
  document.querySelectorAll('.input-uppercase').forEach(input => {
    input.addEventListener('input', () => {
      const pos = input.selectionStart;
      input.value = input.value.toUpperCase();
      try { input.setSelectionRange(pos, pos); } catch {}
    });
  });

  // Limpiar estado de error al tipear
  document.querySelectorAll('input, textarea, select').forEach(el => {
    el.addEventListener('input', () => el.classList.remove('input-error'));
  });

  // Patente con debounce
  let timer;
  document.getElementById('inputPatente')?.addEventListener('input', e => {
    clearTimeout(timer);
    NuevaOT.motoId = null;
    NuevaOT.motoNueva = false;
    document.getElementById('motoEncontrada').classList.add('hidden');
    document.getElementById('motoNuevaAlert').classList.add('hidden');
    document.getElementById('patenteStatus').textContent = '';
    const v = e.target.value;
    if (v.replace(/\s/g,'').length >= 4) {
      document.getElementById('patenteStatus').textContent = 'Buscando...';
      timer = setTimeout(() => NuevaOT.buscarPatente(v), 400);
    }
  });

  document.getElementById('btnPaso1Siguiente')?.addEventListener('click', () => NuevaOT.paso1Siguiente());
  document.getElementById('btnPaso2Atras')?.addEventListener('click', () => NuevaOT._goTo(1));
  document.getElementById('btnPaso2Siguiente')?.addEventListener('click', () => NuevaOT.paso2Siguiente());
  document.getElementById('btnPaso3Atras')?.addEventListener('click', () => NuevaOT._goTo(2));
  document.getElementById('btnPaso3Siguiente')?.addEventListener('click', () => NuevaOT.paso3Siguiente());
  document.getElementById('btnPaso4Atras')?.addEventListener('click', () => {
    NuevaOT.motoNueva ? NuevaOT._goTo(3) : NuevaOT._goTo(1);
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

  // Mostrar/ocultar date picker según prioridad seleccionada
  document.querySelectorAll('input[name="otPrioridad"]').forEach(r => {
    r.addEventListener('change', () => {
      const grupo = document.getElementById('grupoPrioridadFecha');
      if (r.value === 'fecha_especifica') {
        grupo.classList.remove('hidden');
        document.getElementById('otFechaPrioridad').focus();
      } else {
        grupo.classList.add('hidden');
      }
    });
  });
});
