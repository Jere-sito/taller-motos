# Informe de Facturación — Integración Real Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Llevar el informe de facturación (ya aprobado como prototipo estático) al Dashboard real del sistema, con datos reales de la base de datos, sin escribir jamás en `data/taller.db`.

**Architecture:** Un endpoint nuevo de solo lectura en `routes/admin.js` devuelve la facturación real día por día (ya con el descuento aplicado). El navegador reutiliza `bucketPeriod()` — la función de agrupación día/semana/mes ya probada en el prototipo — para agrupar esos días reales según el rango elegido. Todo el frontend nuevo vive en `public/js/facturacion.js`, encapsulado en un único objeto global `Facturacion` (mismo patrón que `NuevaOT` en este proyecto) para no ensuciar el espacio global.

**Tech Stack:** Node.js/Express/`node:sqlite` (backend, ya existente), Chart.js 4.4.4 vía CDN (ya usado en el prototipo), JavaScript vanilla (frontend, sin bundler).

## Global Constraints

- **El endpoint nuevo es estrictamente de solo lectura** (`SELECT` únicamente). Ningún paso de este plan hace `INSERT`/`UPDATE`/`DELETE` sobre `data/taller.db`, ni siquiera para probar.
- Antes de correr el servidor local contra la base real, se hace un backup: `data/taller.db.backup-<fecha>` (no se commitea — `data/` y `*.db` ya están en `.gitignore`).
- Toda verificación contra el servidor real navega y observa únicamente — nunca hace clic en botones de crear/editar/borrar clientes, motos, órdenes, pagos, ni ningún otro flujo de escritura del sistema.
- Todo el trabajo se hace en la rama `feature/informe-facturacion`. Ningún commit va a `main` como parte de este plan — el merge queda para después de que el usuario apruebe el resultado corriendo en su sistema real.
- Fuente de datos: `presupuesto_items` (`tipo`: `repuesto`|`mano_obra`), solo órdenes con `estado = 'entregada'`, filtradas por `ordenes_trabajo.fecha_entrega_real` (mismo campo/criterio que ya usa `GET /api/admin/stats`: `>= desde` y `<= hasta + ' 23:59:59'`). El `descuento` (%) del presupuesto se aplica proporcionalmente a mano de obra y repuestos.
- Una orden entregada sin presupuesto/ítems igual cuenta como orden (con $0).
- Permisos del endpoint nuevo: igual que `routes/pagos.js`/`routes/presupuestos.js` — `if (req.session.role === 'mecanico') return res.status(403).json({ error: 'Sin permiso.' });`
- El navegador agrupa los datos (`bucketPeriod`), el servidor NO agrupa — devuelve filas diarias en crudo.
- Reutilizar `fmtMoney`/`fmtDate` ya existentes en `public/js/app.js` — no redefinirlas.
- Las llamadas al servidor usan `API.get()` (de `public/js/api.js`), no `fetch()` directo.
- CSS nuevo va en `public/css/main.css` como clases reutilizables — no en un `<style>` suelto.
- El informe **no** se auto-refresca cada 30s como el resto del dashboard — solo se carga al entrar a la página y cuando el usuario cambia período o vista.
- No se modifica `HTML PRUEBAS/informe-facturacion.html` (queda de referencia visual).
- No se toca la tabla `pagos` ni su flujo existente.

---

### Task 1: Preparación — rama y backup de la base

**Files:** ninguno (solo operaciones de git/filesystem).

**Interfaces:**
- Produces: la rama `feature/informe-facturacion` activa, y un archivo de backup en `data/`. Todas las tareas siguientes asumen que ya se está parado en esta rama.

- [ ] **Step 1: Crear y cambiar a la rama nueva**

```bash
cd "c:\Users\Gyver\Desktop\Proyectos Claude\- ORDENES MOTOS"
git checkout -b feature/informe-facturacion
```

Expected: `Switched to a new branch 'feature/informe-facturacion'`

- [ ] **Step 2: Backup de la base de datos real**

```bash
cp "data/taller.db" "data/taller.db.backup-$(date +%Y%m%d-%H%M%S)"
ls -la data/taller.db.backup-*
```

Expected: el `ls` muestra el archivo de backup recién creado, con un tamaño similar al de `data/taller.db`.

- [ ] **Step 3: Confirmar que el backup no queda trackeado por git**

```bash
git status --short
```

Expected: el backup NO aparece en la salida (porque `data/` y `*.db` ya están en `.gitignore`). Si por algún motivo apareciera, DETENERSE y reportar — no continuar sin confirmar que no se va a commitear un archivo de la base real.

- [ ] **Step 4: Confirmar la rama activa**

```bash
git branch --show-current
```

Expected: `feature/informe-facturacion`

(No hay commit en este task — no se creó ni modificó ningún archivo de código.)

---

### Task 2: Backend — endpoint de solo lectura `GET /api/admin/facturacion`

**Files:**
- Modify: `routes/admin.js`

**Interfaces:**
- Produces: `GET /api/admin/facturacion?desde=YYYY-MM-DD&hasta=YYYY-MM-DD` → `{ dias: [{ fecha: 'YYYY-MM-DD', mano_obra: number, repuestos: number, cantidad_ordenes: number }, ...] }`, ordenado por `fecha` ascendente. Usado por la Task 3 (`Facturacion.cargarInforme()`).

- [ ] **Step 1: Leer el archivo actual para ubicar dónde insertar la ruta nueva**

`routes/admin.js` actualmente termina así (después del handler de `/stats`):

```js
  res.json({ totales, por_mecanico: porMecanico });
});

module.exports = router;
```

- [ ] **Step 2: Agregar la ruta nueva, antes de `module.exports = router;`**

```js
// GET /api/admin/facturacion?desde=&hasta= — solo lectura
router.get('/facturacion', (req, res) => {
  if (req.session.role === 'mecanico') return res.status(403).json({ error: 'Sin permiso.' });

  const { desde, hasta } = req.query;
  if (!desde || !hasta) return res.status(400).json({ error: 'Los parámetros desde y hasta son requeridos.' });

  const db = getDb();
  const filas = db.prepare(`
    SELECT
      o.id as orden_id,
      date(o.fecha_entrega_real) as fecha,
      COALESCE(p.descuento, 0) as descuento,
      COALESCE(SUM(CASE WHEN pi.tipo = 'mano_obra' THEN pi.cantidad * pi.precio_unitario ELSE 0 END), 0) as bruto_mano_obra,
      COALESCE(SUM(CASE WHEN pi.tipo = 'repuesto'  THEN pi.cantidad * pi.precio_unitario ELSE 0 END), 0) as bruto_repuestos
    FROM ordenes_trabajo o
    LEFT JOIN presupuestos p ON p.orden_id = o.id
    LEFT JOIN presupuesto_items pi ON pi.presupuesto_id = p.id
    WHERE o.estado = 'entregada'
      AND o.fecha_entrega_real >= ?
      AND o.fecha_entrega_real <= ?
    GROUP BY o.id
  `).all(desde, hasta + ' 23:59:59');

  const porDia = new Map();
  for (const fila of filas) {
    const factor = 1 - (fila.descuento || 0) / 100;
    const manoObra = fila.bruto_mano_obra * factor;
    const repuestos = fila.bruto_repuestos * factor;

    if (!porDia.has(fila.fecha)) {
      porDia.set(fila.fecha, { fecha: fila.fecha, mano_obra: 0, repuestos: 0, cantidad_ordenes: 0 });
    }
    const acc = porDia.get(fila.fecha);
    acc.mano_obra += manoObra;
    acc.repuestos += repuestos;
    acc.cantidad_ordenes += 1;
  }

  const dias = Array.from(porDia.values())
    .map(d => ({ ...d, mano_obra: Math.round(d.mano_obra), repuestos: Math.round(d.repuestos) }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  res.json({ dias });
});

module.exports = router;
```

(El `module.exports = router;` que ya existía se reemplaza por el bloque de arriba, que lo incluye al final — no debe quedar duplicado.)

- [ ] **Step 2b: Sintaxis**

```bash
node --check routes/admin.js
```

Expected: sin salida (sin errores de sintaxis).

- [ ] **Step 3: Levantar el servidor local (solo lectura desde acá en adelante)**

```bash
npm start
```

Expected: el log de consola muestra `✅ Taller Motos corriendo en http://localhost:3001`. Dejar corriendo en background para los pasos siguientes.

- [ ] **Step 4: Verificar el endpoint nuevo contra un rango amplio, y cruzarlo con `/api/admin/stats` (ya existente y confiable) como control**

Usando el navegador (Playwright) o `curl`, pedir AMBOS endpoints con el mismo rango — uno intencionalmente muy amplio para capturar toda la historia real del negocio sin necesidad de conocer fechas específicas:

```
GET http://localhost:3001/api/admin/facturacion?desde=2000-01-01&hasta=2030-12-31
GET http://localhost:3001/api/admin/stats?desde=2000-01-01&hasta=2030-12-31
```

Verificar a mano (sumando el campo `cantidad_ordenes` de todos los elementos de `dias` en la primera respuesta):

```
suma(dias[].cantidad_ordenes) === stats.totales.entregadas
```

Expected: ambos números coinciden exactamente. Si no coinciden, no continuar — revisar el `WHERE`/`JOIN` de la consulta SQL antes de seguir (probablemente una orden con `presupuesto_items` de un `tipo` inesperado, o un problema con el `LEFT JOIN`).

También confirmar: cada elemento de `dias` tiene `mano_obra` y `repuestos` como números (no `null`, no `NaN`), y `fecha` en formato `YYYY-MM-DD`.

- [ ] **Step 5: Detener el servidor**

Terminar el proceso de `npm start` (Ctrl+C o matar el proceso) antes de continuar — no debe quedar corriendo entre tasks.

- [ ] **Step 6: Commit**

```bash
git add routes/admin.js
git commit -m "feat: endpoint de solo lectura GET /api/admin/facturacion"
```

---

### Task 3: Frontend — crear `facturacion.js`, insertar markup y mover el CSS

**Files:**
- Create: `public/js/facturacion.js`
- Modify: `public/index.html`
- Modify: `public/css/main.css`

**Interfaces:**
- Consumes: `GET /api/admin/facturacion` (Task 2); `fmtMoney` (de `public/js/app.js`, ya existente); `API.get` (de `public/js/api.js`, ya existente).
- Produces: objeto global `Facturacion` con método público `Facturacion.init()`. Usado por la Task 4 (`dashboard.js`'s `onAppReady`). En esta tarea `init()` NO se llama todavía desde ningún lado — solo se define el archivo.

- [ ] **Step 1: Crear `public/js/facturacion.js` con el contenido completo**

```js
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
```

- [ ] **Step 2: Sintaxis**

```bash
node --check public/js/facturacion.js
```

Expected: sin salida (sin errores de sintaxis).

- [ ] **Step 3: Agregar el `<script>` de Chart.js en `public/index.html`, dentro de `<head>`**

Ubicar esta línea existente (línea 10 de `public/index.html`):

```html
  <link rel="stylesheet" href="/css/main.css">
```

Y agregar justo después:

```html
  <link rel="stylesheet" href="/css/main.css">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
```

- [ ] **Step 4: Insertar el markup de la sección, entre "Resumen de hoy" y "Actividad reciente"**

Ubicar este bloque existente en `public/index.html`:

```html
  <p class="section-title">Resumen de hoy</p>
  <div class="stat-cards" id="statCards">
    <div style="grid-column:1/-1; text-align:center; padding:24px; color:var(--text-muted); font-size:0.875rem">Cargando...</div>
  </div>

  <p class="section-title">Actividad reciente</p>
```

Y reemplazarlo por (agrega la sección nueva entre medio, sin tocar las dos que ya estaban):

```html
  <p class="section-title">Resumen de hoy</p>
  <div class="stat-cards" id="statCards">
    <div style="grid-column:1/-1; text-align:center; padding:24px; color:var(--text-muted); font-size:0.875rem">Cargando...</div>
  </div>

  <p class="section-title">Facturación</p>
  <div id="informeFacturacion">
    <div class="chips" id="chipsModoPeriodo" style="margin-bottom:12px;">
      <button type="button" class="chip active" data-modo="mes">Mes</button>
      <button type="button" class="chip" data-modo="rango">Rango personalizado</button>
    </div>

    <div id="modoMes" style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
      <button type="button" class="btn btn-secondary btn-sm" id="btnMesAnterior">←</button>
      <span id="labelMesActual" style="font-weight:700; min-width:140px; text-align:center;"></span>
      <button type="button" class="btn btn-secondary btn-sm" id="btnMesSiguiente">→</button>
    </div>

    <div id="modoRango" style="display:none; margin-bottom:16px; position:relative;">
      <button type="button" class="btn btn-secondary" id="btnAbrirCalendario"></button>
      <div class="card" id="popoverCalendario" style="display:none; position:absolute; z-index:10; margin-top:8px; width:260px;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
          <button type="button" class="btn btn-secondary btn-sm" id="calMesAnterior">←</button>
          <span id="calLabelMes" style="font-weight:700;"></span>
          <button type="button" class="btn btn-secondary btn-sm" id="calMesSiguiente">→</button>
        </div>
        <div id="calGrid" style="display:grid; grid-template-columns:repeat(7,1fr); gap:4px; text-align:center; font-size:0.8125rem;"></div>
        <div class="text-muted" style="font-size:0.75rem; margin-top:8px;">Elegí la fecha "desde" y después la fecha "hasta".</div>
      </div>
    </div>

    <div class="chips" id="chipsVista" style="margin-bottom:16px;">
      <button type="button" class="chip active" data-vista="total">Total</button>
      <button type="button" class="chip" data-vista="mano_obra">Mano de obra</button>
      <button type="button" class="chip" data-vista="repuestos">Repuestos</button>
    </div>
    <div class="stat-cards" id="kpiCards" style="grid-template-columns:repeat(3,1fr);"></div>
    <div class="card" id="chartCard" style="margin-top:16px;">
      <h3 class="chart-title">Evolución de la facturación</h3>
      <p class="chart-subtitle">Cómo cambió lo facturado día a día en el período.</p>
      <canvas id="graficoFacturacion" height="90"></canvas>
      <div id="chartTooltip"></div>
    </div>
  </div>

  <p class="section-title">Actividad reciente</p>
```

- [ ] **Step 5: Agregar el `<script>` de `facturacion.js`, después del de `dashboard.js`**

Ubicar (cerca del final de `public/index.html`):

```html
<script src="/js/api.js"></script>
<script src="/js/app.js"></script>
<script src="/js/dashboard.js"></script>
<script src="/js/nueva-ot.js"></script>
```

Y reemplazar por:

```html
<script src="/js/api.js"></script>
<script src="/js/app.js"></script>
<script src="/js/dashboard.js"></script>
<script src="/js/facturacion.js"></script>
<script src="/js/nueva-ot.js"></script>
```

- [ ] **Step 6: Mover el CSS al final de `public/css/main.css`**

Agregar al final del archivo (después de la última línea existente):

```css

/* ── Informe de facturación (Dashboard) ──────────────────────────────── */
.stat-card.brand::before { background: var(--primary); }
.stat-number.brand { color: var(--primary); }

#chartCard { position: relative; }
#chartCard .chart-title {
  color: var(--text);
  font-weight: 700;
  font-size: 16px;
  margin: 0 0 4px 0;
}
#chartCard .chart-subtitle {
  color: var(--text-muted);
  font-size: 13px;
  margin: 0 0 16px 0;
}
#chartTooltip {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  background: #1E293B;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
  line-height: 1.6;
  white-space: nowrap;
  opacity: 0;
  transform: translate(-9999px, -9999px);
  transition: opacity 0.1s ease;
  z-index: 10;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
#chartTooltip .tt-fecha { color: #FFFFFF; font-weight: 700; }
#chartTooltip .tt-valor { color: var(--primary); margin-top: 2px; }
```

- [ ] **Step 7: Verificación visual — la sección aparece, pero todavía no carga datos (eso es esperado, se conecta en la Task 4)**

Levantar el servidor (`npm start`), abrir `http://localhost:3001/` en el navegador. Confirmar:
- La consola del navegador no tiene errores de JS.
- Se ve el título "Facturación" con los chips ("Mes"/"Rango personalizado" y "Total"/"Mano de obra"/"Repuestos") entre "Resumen de hoy" y "Actividad reciente".
- El navegador de mes (← Julio 2026 →) muestra el mes actual — esto SÍ funciona ya, porque `initSelectorPeriodo` corre apenas se llama `Facturacion.init()`... pero **`init()` todavía no se llama desde ningún lado en esta tarea**, así que en este punto la sección se ve con los chips pero SIN los datos ni el gráfico poblados (contenedores `#kpiCards`/`#graficoFacturacion` vacíos). Esto es el resultado esperado de esta tarea — no es un bug. La carga completa se verifica en la Task 4.

Detener el servidor al terminar (no debe quedar corriendo entre tasks).

- [ ] **Step 8: Commit**

```bash
git add public/js/facturacion.js public/index.html public/css/main.css
git commit -m "feat: módulo Facturacion (frontend) + markup + estilos del informe de facturación"
```

---

### Task 4: Integración final — conectar al Dashboard y verificar contra datos reales

**Files:**
- Modify: `public/js/dashboard.js`

**Interfaces:**
- Consumes: `Facturacion.init()` (Task 3).
- Produces: el informe de facturación funcionando end-to-end en el Dashboard real. Es el resultado final de este plan — no hay una Task 5.

- [ ] **Step 1: Conectar `Facturacion.init()` en `onAppReady`**

`public/js/dashboard.js` actualmente empieza así:

```js
async function onAppReady() {
  await cargarDashboard();
  setInterval(cargarDashboard, 30000);
  document.getElementById('btnNuevaOT')?.addEventListener('click', () => NuevaOT.abrir());
}
```

Reemplazar por:

```js
async function onAppReady() {
  await cargarDashboard();
  setInterval(cargarDashboard, 30000);
  document.getElementById('btnNuevaOT')?.addEventListener('click', () => NuevaOT.abrir());
  Facturacion.init();
}
```

(Nota: `Facturacion.init()` NO entra en el `setInterval` de 30s — el informe no se auto-refresca, por diseño.)

- [ ] **Step 2: Sintaxis**

```bash
node --check public/js/dashboard.js
```

Expected: sin salida.

- [ ] **Step 3: Verificación end-to-end contra el servidor real (solo lectura)**

Levantar el servidor (`npm start`) y, usando el navegador (Playwright recomendado, con capturas como evidencia), abrir `http://localhost:3001/` y verificar en orden — **sin hacer clic en ningún botón de crear/editar/borrar nada del sistema**:

1. Al cargar, la sección "Facturación" muestra el mes actual seleccionado, las 3 tarjetas KPI con números reales (no `$NaN`, no vacío), y el gráfico con la línea naranja.
2. Los números de la tarjeta "Órdenes entregadas" para el mes actual coinciden con lo que se puede corroborar mirando `/ordenes?estado=entregada` filtrado a ese mes (chequeo cruzado visual, no hace falta contar exhaustivamente si el orden de magnitud coincide).
3. Cambiar la vista a "Mano de obra" y "Repuestos" → el gráfico y las tarjetas cambian de valores.
4. Navegar con ← al mes anterior → los datos cambian a ese mes (si hay órdenes entregadas en ese mes; si no hay, las tarjetas deben mostrar $0 y "0 órdenes", no un error).
5. Cambiar a "Rango personalizado", elegir un rango amplio (ej. últimos 6 meses) → el gráfico pasa a granularidad semanal o mensual según corresponda.
6. Pasar el mouse sobre el gráfico → aparece el crosshair y el tooltip con la fecha y el valor real, con la etiqueta correcta según la vista activa.
7. Confirmar que el resto del dashboard (tarjetas de "Resumen de hoy", "Actividad reciente", botón "+ Nueva Orden") sigue funcionando exactamente igual que antes — no se rompió nada.
8. Cero errores en la consola del navegador en todos los pasos anteriores.
9. Confirmar en la terminal donde corre `npm start` que no se registró ningún log de escritura inesperado (este sistema no tiene logging de queries, pero confirmar visualmente que en ningún momento se navegó a una pantalla de edición/creación).

Detener el servidor al terminar.

- [ ] **Step 4: Commit**

```bash
git add public/js/dashboard.js
git commit -m "feat: conectar el informe de facturación al Dashboard real"
```

---

## Después de este plan

**No hacer merge a `main` ni push a Railway como parte de la ejecución de este plan.** Una vez completadas las 4 tareas (con sus revisiones), el resultado debe mostrarse al usuario corriendo en su propio sistema real (rama `feature/informe-facturacion`) para que lo apruebe explícitamente. Recién con esa aprobación se hace el merge; el push a Railway solo si el usuario lo pide.
