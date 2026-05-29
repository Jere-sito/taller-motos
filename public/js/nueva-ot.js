const NuevaOT = {
  motoId: null,
  clienteId: null,
  motoNueva: false,

  abrir() {
    this.motoId = null;
    this.clienteId = null;
    this.motoNueva = false;
    this._motoLabel = '';
    this._clienteLabel = '';
    document.querySelectorAll('#modalNuevaOT .urgency-btn, #modalNuevaOT .cedula-btn').forEach(b => b.classList.remove('selected'));
    ['inputPatente','newMotoMarca','newMotoModelo','newMotoColor',
     'searchCliente','ncNombre','ncTelefono','otProblema','otObservaciones',
     'otFechaIngreso','otHoraIngreso']
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.querySelectorAll('input[name="otCedula"]').forEach(r => r.checked = false);
    document.querySelectorAll('input[name="otPrioridad"]').forEach(r => r.checked = false);
    const chkManual = document.getElementById('otFechaManual');
    if (chkManual) chkManual.checked = false;
    document.getElementById('grupoFechaManual')?.classList.add('hidden');
    document.getElementById('grupoPrioridadFecha')?.classList.add('hidden');
    const elFP = document.getElementById('otFechaPrioridad');
    if (elFP) elFP.value = '';
    document.getElementById('patenteStatus').textContent = '';
    document.getElementById('motoEncontrada').classList.add('hidden');
    document.getElementById('motoNuevaAlert').classList.add('hidden');
    this._ocultarSugerencias();
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

    const resumen = document.getElementById('wizardResumen');
    if (resumen) {
      if (step === 4) { this._renderResumen(); resumen.classList.remove('hidden'); }
      else resumen.classList.add('hidden');
    }
  },

  _renderDots(activeStep) {
    const flow = this.motoNueva ? [1,2,3,4] : [1,4];
    const STEP_LABELS = { 1: 'Patente', 2: 'Moto', 3: 'Titular', 4: 'Ingreso' };
    const pos = flow.indexOf(activeStep);
    const el = document.getElementById('wizardDots');
    if (!el) return;
    const checkSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

    const circles = flow.map((s, i) => {
      const done    = i < pos;
      const current = i === pos;
      const cls     = done ? 'done' : current ? 'active' : 'pending';
      const inner   = done ? checkSvg : (i + 1);
      const line    = i < flow.length - 1 ? `<div class="step-line${i < pos ? ' done' : ''}"></div>` : '';
      return `<div class="step-circle ${cls}">${inner}</div>${line}`;
    }).join('');

    const labels = flow.map((s, i) => {
      const done    = i < pos;
      const current = i === pos;
      const cls     = done ? 'wizard-label done' : current ? 'wizard-label active' : 'wizard-label';
      const sep     = i < flow.length - 1 ? `<span class="wizard-label-spacer"></span>` : '';
      return `<span class="${cls}">${STEP_LABELS[s]}</span>${sep}`;
    }).join('');

    el.innerHTML = `<div class="wizard-steps">${circles}</div><div class="wizard-labels">${labels}</div>`;
  },

  _renderResumen() {
    const el = document.getElementById('wizardResumen');
    if (!el) return;
    const patente = (document.getElementById('inputPatente')?.value || '').toUpperCase().trim();
    let moto = this._motoLabel || '';
    if (this.motoNueva) {
      moto = [document.getElementById('newMotoMarca')?.value, document.getElementById('newMotoModelo')?.value]
        .filter(v => v && v.trim()).join(' ').toUpperCase();
    }
    const cliente = this._clienteLabel || (document.getElementById('searchCliente')?.value || '').trim();
    const MOTO_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="3"/><circle cx="18.5" cy="17.5" r="3"/><path d="M8.5 17.5h7M15 6h-4l-2.5 5.5H2"/><path d="M15 6l3.5 5.5"/><path d="M10 6l-1 5.5"/></svg>`;
    const PERSON_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    el.innerHTML = `
      <div class="summary-row">${MOTO_SVG}<span class="summary-text">${esc(patente || '—')}</span>${moto ? `<span class="summary-sep">—</span><span class="summary-text">${esc(moto)}</span>` : ''}</div>
      ${cliente ? `<div class="summary-row">${PERSON_SVG}<span class="summary-text">${esc(cliente)}</span></div>` : ''}
    `;
  },

  async buscarPatente(patente) {
    const p = patente.toUpperCase().replace(/\s+/g, '');
    if (p.length < 2) return;
    document.getElementById('patenteStatus').textContent = 'Buscando...';
    try {
      const moto = await API.get(`/api/motos/patente/${encodeURIComponent(p)}`);
      this.motoId = moto.id;
      this.clienteId = moto.cliente_id;
      this.motoNueva = false;
      this._motoLabel = `${moto.marca || ''} ${moto.modelo || ''}`.trim();
      this._clienteLabel = moto.cliente_nombre || '';
      document.getElementById('motoEncontrada').classList.remove('hidden');
      document.getElementById('motoNuevaAlert').classList.add('hidden');
      document.getElementById('motoEncontradaTitle').textContent = `${moto.patente} — ${moto.marca} ${moto.modelo}`.trim();
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

    if (!this.motoId && !this.motoNueva && patente.length >= 2) {
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

    const usaFechaManual = document.getElementById('otFechaManual')?.checked;
    const fechaIngreso = usaFechaManual
      ? (document.getElementById('otFechaIngreso')?.value && document.getElementById('otHoraIngreso')?.value
          ? `${document.getElementById('otFechaIngreso').value}T${document.getElementById('otHoraIngreso').value}`
          : null)
      : null;

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
        fecha_prometida: prioridad === 'fecha_especifica' ? fechaPrioridad : null,
        fecha_ingreso: fechaIngreso,
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

  async _buscarSugerencias(q) {
    clearTimeout(this._timerSug);
    this._timerSug = setTimeout(async () => {
      const p = q.toUpperCase().replace(/\s+/g, '');
      if (p.length < 2) { this._ocultarSugerencias(); return; }
      try {
        const motos = await API.get(`/api/motos/sugerencias?q=${encodeURIComponent(p)}`);
        const container = document.getElementById('patenteSugerencias');
        if (!container) return;
        if (!motos.length) { this._ocultarSugerencias(); return; }
        container.innerHTML = motos.map(m =>
          `<div style="padding:10px 14px; cursor:pointer; border-bottom:1px solid var(--border); font-size:0.875rem"
                onmousedown="NuevaOT._elegirSugerencia('${esc(m.patente)}')">
            <span style="font-weight:800; letter-spacing:2px">${esc(m.patente)}</span>
            <span style="color:var(--text-muted); font-size:0.8125rem; margin-left:10px">${esc(m.marca || '')} ${esc(m.modelo || '')}${m.cliente_nombre ? ` — ${esc(m.cliente_nombre)}` : ''}</span>
          </div>`
        ).join('');
        container.classList.remove('hidden');
      } catch {}
    }, 200);
  },

  _ocultarSugerencias() {
    clearTimeout(this._timerSug);
    document.getElementById('patenteSugerencias')?.classList.add('hidden');
  },

  async _elegirSugerencia(patente) {
    const input = document.getElementById('inputPatente');
    if (input) input.value = patente;
    this._ocultarSugerencias();
    document.getElementById('patenteStatus').textContent = 'Buscando...';
    await this.buscarPatente(patente);
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
    this._clienteLabel = nombre;
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

  // Crear dropdown de sugerencias de patente dinámicamente
  const patenteInput = document.getElementById('inputPatente');
  if (patenteInput) {
    const patenteGroup = patenteInput.closest('.form-group') || patenteInput.parentElement;
    patenteGroup.style.position = 'relative';
    const dropdown = document.createElement('div');
    dropdown.id = 'patenteSugerencias';
    dropdown.className = 'hidden';
    dropdown.style.cssText = 'position:absolute;left:0;right:0;top:100%;z-index:500;background:#fff;border:1.5px solid var(--border);border-top:none;border-radius:0 0 var(--radius-sm) var(--radius-sm);max-height:200px;overflow-y:auto;box-shadow:var(--shadow-md)';
    patenteGroup.appendChild(dropdown);

    patenteInput.addEventListener('blur', () => {
      setTimeout(() => NuevaOT._ocultarSugerencias(), 150);
    });
  }

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
    if (v.replace(/\s/g,'').length >= 2) {
      NuevaOT._buscarSugerencias(v);
      document.getElementById('patenteStatus').textContent = 'Buscando...';
      timer = setTimeout(() => NuevaOT.buscarPatente(v), 500);
    } else {
      NuevaOT._ocultarSugerencias();
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

  // Mostrar/ocultar campos de fecha manual
  document.getElementById('otFechaManual')?.addEventListener('change', e => {
    const grupo = document.getElementById('grupoFechaManual');
    if (grupo) grupo.classList.toggle('hidden', !e.target.checked);
  });

  // Mostrar/ocultar date picker según prioridad seleccionada + marcar selección
  document.querySelectorAll('input[name="otPrioridad"]').forEach(r => {
    r.addEventListener('change', () => {
      document.querySelectorAll('#modalNuevaOT .urgency-btn').forEach(b => b.classList.remove('selected'));
      r.closest('.urgency-btn')?.classList.add('selected');
      const grupo = document.getElementById('grupoPrioridadFecha');
      if (r.value === 'fecha_especifica') {
        grupo.classList.remove('hidden');
        document.getElementById('otFechaPrioridad').focus();
      } else {
        grupo.classList.add('hidden');
      }
    });
  });

  // Marcar selección de cédula
  document.querySelectorAll('input[name="otCedula"]').forEach(r => {
    r.addEventListener('change', () => {
      document.querySelectorAll('#modalNuevaOT .cedula-btn').forEach(b => b.classList.remove('selected'));
      r.closest('.cedula-btn')?.classList.add('selected');
    });
  });
});
