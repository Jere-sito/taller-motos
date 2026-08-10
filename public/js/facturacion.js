const VISTA_LABELS = { total: 'Total facturado', mano_obra: 'Mano de obra', repuestos: 'Repuestos' };

const Facturacion = {
  vistaActual: 'total',
  modoPeriodo: 'mes',
  hoy: null,
  mesActual: null,
  rangoDesde: null,
  rangoHasta: null,
  calMesVisible: null,
  seleccionandoInicio: true,
  chartInstance: null,
  onCambioRangoCallback: null,
  vistaGraficoActual: 'total',

  init() {
    this.hoy = new Date();
    this.mesActual = new Date(this.hoy.getFullYear(), this.hoy.getMonth(), 1);
    this.rangoDesde = new Date(this.hoy.getFullYear(), this.hoy.getMonth(), 1);
    this.rangoHasta = this.hoy;
    this.calMesVisible = new Date(this.hoy.getFullYear(), this.hoy.getMonth(), 1);

    this.initSelectorPeriodo(() => this.cargarInforme());
    this.initSelectorVista(() => this.cargarInforme());
    this.cargarInforme();
  },

  // ---- Agrupación día/semana/mes (idéntica a la ya probada en el prototipo) ----
  bucketPeriod(desdeISO, hastaISO) {
    const desde = new Date(desdeISO + 'T00:00:00');
    const hasta = new Date(hastaISO + 'T00:00:00');
    const dias = Math.round((hasta - desde) / 86400000) + 1;

    let granularidad;
    if (dias <= 31) granularidad = 'dia';
    else if (dias <= 180) granularidad = 'semana';
    else granularidad = 'mes';

    const buckets = [];
    const fmtLabelDia = d => d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
    const fmtLabelMes = d => d.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' });

    if (granularidad === 'dia') {
      for (let d = new Date(desde); d <= hasta; d.setDate(d.getDate() + 1)) {
        const inicio = new Date(d);
        const fin = new Date(d);
        buckets.push({ desde: inicio, hasta: fin, label: fmtLabelDia(inicio) });
      }
    } else if (granularidad === 'semana') {
      let cursor = new Date(desde);
      while (cursor <= hasta) {
        const inicio = new Date(cursor);
        const fin = new Date(cursor);
        fin.setDate(fin.getDate() + 6);
        if (fin > hasta) fin.setTime(hasta.getTime());
        buckets.push({ desde: inicio, hasta: fin, label: `${fmtLabelDia(inicio)}–${fmtLabelDia(fin)}` });
        cursor.setDate(cursor.getDate() + 7);
      }
    } else {
      let cursor = new Date(desde.getFullYear(), desde.getMonth(), 1);
      while (cursor <= hasta) {
        const inicio = new Date(Math.max(cursor, desde));
        const finMes = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
        const fin = new Date(Math.min(finMes, hasta));
        buckets.push({ desde: inicio, hasta: fin, label: fmtLabelMes(cursor) });
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      }
    }
    return { granularidad, buckets };
  },

  // ---- Suma los días reales del servidor dentro de cada bucket ----
  agregarDias(diasReales, buckets) {
    let totalGeneral = 0;
    let cantidadOrdenes = 0;

    const series = buckets.map(b => {
      let manoObra = 0;
      let repuestos = 0;
      let ordenes = 0;

      for (const d of diasReales) {
        const fecha = new Date(d.fecha + 'T00:00:00');
        if (fecha >= b.desde && fecha <= b.hasta) {
          manoObra += d.mano_obra;
          repuestos += d.repuestos;
          ordenes += d.cantidad_ordenes;
        }
      }

      cantidadOrdenes += ordenes;
      totalGeneral += manoObra + repuestos;

      return { label: b.label, mano_obra: manoObra, repuestos: repuestos, total: manoObra + repuestos };
    });

    const kpis = {
      total: totalGeneral,
      cantidad_ordenes: cantidadOrdenes,
      ticket_promedio: cantidadOrdenes ? Math.round(totalGeneral / cantidadOrdenes) : 0
    };

    return { series, kpis };
  },

  // Formato abreviado ("$8k") — solo para el eje Y. fmtMoney (de app.js) se usa en KPIs y tooltip.
  fmtMoneyCompacto(n) {
    if (n == null || isNaN(n)) return '$0k';
    return '$' + Math.round(n / 1000).toLocaleString('es-AR') + 'k';
  },

  getRangoActual() {
    if (this.modoPeriodo === 'mes') {
      const inicio = new Date(this.mesActual.getFullYear(), this.mesActual.getMonth(), 1);
      const fin = new Date(this.mesActual.getFullYear(), this.mesActual.getMonth() + 1, 0);
      return { desdeISO: this.toISO(inicio), hastaISO: this.toISO(fin) };
    }
    return { desdeISO: this.toISO(this.rangoDesde), hastaISO: this.toISO(this.rangoHasta) };
  },

  pad2(n) { return String(n).padStart(2, '0'); },
  toISO(d) { return `${d.getFullYear()}-${this.pad2(d.getMonth() + 1)}-${this.pad2(d.getDate())}`; },
  labelMes(d) {
    return d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
      .replace(/^\w/, c => c.toUpperCase());
  },

  initSelectorVista(onChange) {
    document.querySelectorAll('#chipsVista .chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this.vistaActual = chip.dataset.vista;
        document.querySelectorAll('#chipsVista .chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        onChange();
      });
    });
  },

  initSelectorPeriodo(onChange) {
    document.getElementById('labelMesActual').textContent = this.labelMes(this.mesActual);

    document.getElementById('btnMesAnterior').addEventListener('click', () => {
      this.mesActual = new Date(this.mesActual.getFullYear(), this.mesActual.getMonth() - 1, 1);
      document.getElementById('labelMesActual').textContent = this.labelMes(this.mesActual);
      onChange();
    });
    document.getElementById('btnMesSiguiente').addEventListener('click', () => {
      this.mesActual = new Date(this.mesActual.getFullYear(), this.mesActual.getMonth() + 1, 1);
      document.getElementById('labelMesActual').textContent = this.labelMes(this.mesActual);
      onChange();
    });

    document.querySelectorAll('#chipsModoPeriodo .chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this.modoPeriodo = chip.dataset.modo;
        document.querySelectorAll('#chipsModoPeriodo .chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        document.getElementById('modoMes').style.display = this.modoPeriodo === 'mes' ? 'flex' : 'none';
        document.getElementById('modoRango').style.display = this.modoPeriodo === 'rango' ? 'block' : 'none';
        onChange();
      });
    });

    this.initCalendarioRango(onChange);
  },

  actualizarLabelRango() {
    document.getElementById('btnAbrirCalendario').textContent =
      `${this.toISO(this.rangoDesde).split('-').reverse().join('/')} – ${this.toISO(this.rangoHasta).split('-').reverse().join('/')}`;
  },

  renderCalGrid() {
    document.getElementById('calLabelMes').textContent = this.labelMes(this.calMesVisible);
    const primerDia = new Date(this.calMesVisible.getFullYear(), this.calMesVisible.getMonth(), 1);
    const ultimoDia = new Date(this.calMesVisible.getFullYear(), this.calMesVisible.getMonth() + 1, 0);
    const offset = (primerDia.getDay() + 6) % 7;

    const grid = document.getElementById('calGrid');
    grid.innerHTML = '';
    ['L', 'M', 'X', 'J', 'V', 'S', 'D'].forEach(d => {
      grid.innerHTML += `<div style="font-weight:700; color:var(--text-muted);">${d}</div>`;
    });
    for (let i = 0; i < offset; i++) grid.innerHTML += '<div></div>';

    for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
      const fecha = new Date(this.calMesVisible.getFullYear(), this.calMesVisible.getMonth(), dia);
      const enRango = fecha >= this.rangoDesde && fecha <= this.rangoHasta;
      grid.innerHTML += `<button type="button" class="btn-day${enRango ? ' active' : ''}" data-fecha="${this.toISO(fecha)}"
        style="border:none; background:${enRango ? 'var(--primary)' : 'transparent'}; color:${enRango ? '#fff' : 'inherit'}; border-radius:6px; padding:4px 0; cursor:pointer;">${dia}</button>`;
    }

    grid.querySelectorAll('.btn-day').forEach(btn => {
      btn.addEventListener('click', () => this.onClickDia(btn.dataset.fecha));
    });
  },

  onClickDia(fechaISO) {
    const fecha = new Date(fechaISO + 'T00:00:00');
    if (this.seleccionandoInicio) {
      this.rangoDesde = fecha;
      this.rangoHasta = fecha;
      this.seleccionandoInicio = false;
    } else if (fecha < this.rangoDesde) {
      this.rangoDesde = fecha;
      this.rangoHasta = fecha;
    } else {
      this.rangoHasta = fecha;
      this.seleccionandoInicio = true;
      document.getElementById('popoverCalendario').style.display = 'none';
      this.actualizarLabelRango();
      this.onCambioRangoCallback && this.onCambioRangoCallback();
    }
    this.actualizarLabelRango();
    this.renderCalGrid();
  },

  initCalendarioRango(onChange) {
    this.onCambioRangoCallback = onChange;
    this.actualizarLabelRango();
    this.renderCalGrid();

    document.getElementById('btnAbrirCalendario').addEventListener('click', () => {
      const pop = document.getElementById('popoverCalendario');
      pop.style.display = pop.style.display === 'none' ? 'block' : 'none';
    });
    document.getElementById('calMesAnterior').addEventListener('click', () => {
      this.calMesVisible = new Date(this.calMesVisible.getFullYear(), this.calMesVisible.getMonth() - 1, 1);
      this.renderCalGrid();
    });
    document.getElementById('calMesSiguiente').addEventListener('click', () => {
      this.calMesVisible = new Date(this.calMesVisible.getFullYear(), this.calMesVisible.getMonth() + 1, 1);
      this.renderCalGrid();
    });
  },

  renderKPIs(kpis) {
    const container = document.getElementById('kpiCards');
    container.innerHTML = `
      <div class="stat-card brand">
        <div class="stat-number brand">${fmtMoney(kpis.total)}</div>
        <div class="stat-label">Total facturado</div>
      </div>
      <div class="stat-card recibida">
        <div class="stat-number recibida">${kpis.cantidad_ordenes}</div>
        <div class="stat-label">Órdenes entregadas</div>
      </div>
      <div class="stat-card en_reparacion">
        <div class="stat-number en_reparacion">${fmtMoney(kpis.ticket_promedio)}</div>
        <div class="stat-label">Ticket promedio</div>
      </div>`;
  },

  crosshairPlugin: {
    id: 'crosshair',
    afterDraw(chart) {
      const active = chart.getActiveElements();
      if (!active || !active.length) return;
      const { ctx, chartArea } = chart;
      const x = active[0].element.x;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(15,23,42,0.35)';
      ctx.stroke();
      ctx.restore();
    }
  },

  externalTooltipHandler(context) {
    const { chart, tooltip } = context;
    const tooltipEl = document.getElementById('chartTooltip');
    if (!tooltipEl) return;

    if (tooltip.opacity === 0) {
      tooltipEl.style.opacity = 0;
      return;
    }

    const dataPoint = tooltip.dataPoints && tooltip.dataPoints[0];
    if (!dataPoint) return;

    const fecha = dataPoint.label;
    const valor = dataPoint.parsed.y;
    const label = VISTA_LABELS[this.vistaGraficoActual] || VISTA_LABELS.total;

    tooltipEl.innerHTML =
      `<div class="tt-fecha">${fecha}</div>` +
      `<div class="tt-valor">${label} : ${fmtMoney(valor)}</div>`;

    const canvasEl = chart.canvas;
    const chartCardEl = document.getElementById('chartCard');
    tooltipEl.style.opacity = 1;

    let left = canvasEl.offsetLeft + tooltip.caretX + 14;
    let top = canvasEl.offsetTop + tooltip.caretY - tooltipEl.offsetHeight - 10;

    const maxLeft = chartCardEl.clientWidth - tooltipEl.offsetWidth - 8;
    if (left > maxLeft) left = canvasEl.offsetLeft + tooltip.caretX - tooltipEl.offsetWidth - 14;
    if (left < 8) left = 8;
    if (top < 8) top = canvasEl.offsetTop + tooltip.caretY + 14;

    tooltipEl.style.transform = `translate(${left}px, ${top}px)`;
  },

  renderGrafico(series, vista) {
    this.vistaGraficoActual = vista;
    const ctx = document.getElementById('graficoFacturacion').getContext('2d');
    const labels = series.map(s => s.label);
    const data = series.map(s => s[vista]);

    const config = {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data,
          borderColor: '#EA580C',
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: '#FFFFFF',
          pointHoverBorderColor: '#EA580C',
          pointHoverBorderWidth: 2,
          borderWidth: 2.5
        }]
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        hover: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: false,
            external: (context) => this.externalTooltipHandler(context)
          }
        },
        scales: {
          y: {
            ticks: { callback: v => this.fmtMoneyCompacto(v), color: '#94A3B8', font: { size: 11 } },
            grid: { color: 'rgba(15,23,42,0.08)', drawTicks: false, borderDash: [4, 4] },
            border: { display: false }
          },
          x: {
            ticks: { color: '#94A3B8', font: { size: 11 }, maxRotation: 0, autoSkip: true },
            grid: { display: false },
            border: { display: false }
          }
        }
      },
      plugins: [this.crosshairPlugin]
    };

    if (this.chartInstance) {
      this.chartInstance.data = config.data;
      this.chartInstance.options = config.options;
      this.chartInstance.update();
    } else {
      this.chartInstance = new Chart(ctx, config);
    }
  },

  async cargarInforme() {
    const { desdeISO, hastaISO } = this.getRangoActual();
    try {
      const { dias } = await API.get(`/api/admin/facturacion?desde=${desdeISO}&hasta=${hastaISO}`);
      const { buckets } = this.bucketPeriod(desdeISO, hastaISO);
      const { series, kpis } = this.agregarDias(dias, buckets);
      this.renderKPIs(kpis);
      this.renderGrafico(series, this.vistaActual);
    } catch (e) {
      console.error(e);
      const container = document.getElementById('kpiCards');
      if (container) {
        container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:24px; color:var(--text-muted); font-size:0.875rem">Error al cargar el informe de facturación</div>`;
      }
    }
  }
};
