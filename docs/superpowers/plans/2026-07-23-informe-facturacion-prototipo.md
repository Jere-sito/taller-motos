# Informe de Facturación — Prototipo HTML Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir una maqueta estática autocontenida (`HTML PRUEBAS/informe-facturacion.html`) que muestre cómo quedaría la sección "Informe de facturación" del Dashboard, con datos de ejemplo, antes de tocar el proyecto real.

**Architecture:** Un único archivo HTML sin build step, que reutiliza `public/css/main.css` (link relativo) para los tokens visuales y clases ya existentes (`.chip`, `.stat-cards`, `.card`), más Chart.js cargado por CDN para el gráfico. Toda la lógica (selección de período, agrupación en buckets, datos de ejemplo, render del gráfico) vive en un único `<script>` inline al final del archivo — no hay backend en esta etapa.

**Tech Stack:** HTML5, CSS (reutilizando `public/css/main.css`), JavaScript vanilla (ES2020+), Chart.js 4.x vía CDN (`https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js`).

## Global Constraints

- Sin backend ni fetch a `/api/*` en esta etapa — todo dato es generado en el cliente (mock).
- Sin bundler, sin `npm install` — sólo `<script src>` a CDN, igual que Google Fonts en el resto del proyecto.
- Reutilizar clases CSS existentes de `public/css/main.css` en vez de crear estilos nuevos cuando ya exista un equivalente (`.chip`/`.chip.active` para tabs, `.stat-cards`/`.stat-card` para KPIs, `.card` para contenedores).
- Color primario del gráfico: `#EA580C` (variable `--primary` del proyecto).
- Formato de moneda: igual a `fmtMoney()` de `public/js/app.js` — `'$' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })`.
- Granularidad del eje X: rango ≤31 días → por día; 32–180 días → por semana; >180 días → por mes.
- Fuente de datos real futura (no implementada acá, sólo referencia para que el mock tenga la misma forma): `presupuesto_items` agrupado por `tipo` (`repuesto`/`mano_obra`), sólo órdenes `entregada`, filtradas por `fecha_entrega_real`, con `descuento` del presupuesto aplicado proporcionalmente.
- Archivo final único: `HTML PRUEBAS/informe-facturacion.html`. No crear otros archivos.

---

### Task 1: Esqueleto del archivo + motor de agrupación en buckets

**Files:**
- Create: `HTML PRUEBAS/informe-facturacion.html`

**Interfaces:**
- Produces: función global `bucketPeriod(desdeISO, hastaISO)` → `{ granularidad: 'dia'|'semana'|'mes', buckets: [{ desde: Date, hasta: Date, label: string }] }`. Usada por todas las tareas siguientes.

- [ ] **Step 1: Crear el esqueleto HTML con los includes reales del proyecto**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>Prototipo — Informe de facturación</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../public/css/main.css">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
</head>
<body>
<div class="main-wrapper">
  <div class="page" style="max-width:900px; margin:0 auto;">
    <div class="page-header">
      <h1 class="page-title">Informe de facturación</h1>
    </div>
    <div id="informeFacturacion"></div>
  </div>
</div>
<script>
// El resto de las tareas agrega código acá adentro.
</script>
</body>
</html>
```

- [ ] **Step 2: Agregar la función de agrupación en buckets**

Agregar dentro del `<script>` final:

```js
function bucketPeriod(desdeISO, hastaISO) {
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
}

// Self-checks (revisar consola del navegador — no debe haber "Assertion failed")
console.assert(bucketPeriod('2026-07-01', '2026-07-31').granularidad === 'dia', 'Un mes calendario debe agrupar por día');
console.assert(bucketPeriod('2026-07-01', '2026-07-31').buckets.length === 31, 'Julio tiene 31 buckets diarios');
console.assert(bucketPeriod('2026-06-01', '2026-08-15').granularidad === 'semana', '76 días deben agrupar por semana');
console.assert(bucketPeriod('2026-01-01', '2026-12-31').granularidad === 'mes', 'Un año debe agrupar por mes');
console.assert(bucketPeriod('2026-01-01', '2026-12-31').buckets.length === 12, 'Un año calendario debe dar 12 buckets mensuales');
```

- [ ] **Step 3: Verificar en el navegador**

Abrir `HTML PRUEBAS/informe-facturacion.html` directamente con doble clic (o `file://`) y abrir la consola de DevTools (F12).
Expected: cero líneas `Assertion failed`. Debe verse la página con el título "Informe de facturación" y el sidebar oscuro NO presente (es sólo la sección, según lo pedido).

- [ ] **Step 4: Commit**

```bash
git add "HTML PRUEBAS/informe-facturacion.html"
git commit -m "prototipo: esqueleto y motor de agrupación en buckets del informe de facturación"
```

---

### Task 2: Generador de datos de ejemplo (mock)

**Files:**
- Modify: `HTML PRUEBAS/informe-facturacion.html`

**Interfaces:**
- Consumes: `bucketPeriod()` de la Tarea 1 (campos `buckets[].label`, `.desde`, `.hasta`).
- Produces: función global `generarDatosMock(buckets)` → `{ series: [{ label, mano_obra, repuestos, total }], kpis: { total, cantidad_ordenes, ticket_promedio } }`. Usada por las Tareas 3, 4 y 7.

- [ ] **Step 1: Agregar el generador de mock**

```js
function generarDatosMock(buckets) {
  let totalGeneral = 0;
  let cantidadOrdenes = 0;

  const series = buckets.map(b => {
    // Semilla determinística por fecha para que no "salte" al re-renderizar sin cambiar el período
    const seed = b.desde.getTime() / 86400000;
    const pseudo = Math.abs(Math.sin(seed)) ;
    const ordenesDelBucket = Math.round(1 + pseudo * 4);
    const manoObra = Math.round((3000 + pseudo * 15000) * ordenesDelBucket);
    const repuestos = Math.round((5000 + (1 - pseudo) * 25000) * ordenesDelBucket);

    cantidadOrdenes += ordenesDelBucket;
    totalGeneral += manoObra + repuestos;

    return { label: b.label, mano_obra: manoObra, repuestos: repuestos, total: manoObra + repuestos };
  });

  const kpis = {
    total: totalGeneral,
    cantidad_ordenes: cantidadOrdenes,
    ticket_promedio: cantidadOrdenes ? Math.round(totalGeneral / cantidadOrdenes) : 0
  };

  return { series, kpis };
}
```

- [ ] **Step 2: Verificar en el navegador**

Agregar temporalmente `console.table(generarDatosMock(bucketPeriod('2026-07-01','2026-07-31').buckets).series)` al final del script, recargar la página y confirmar en DevTools que la tabla tiene 31 filas con `mano_obra`, `repuestos` y `total` numéricos mayores a 0. Borrar esa línea de `console.table` antes de continuar (era sólo para verificar).

- [ ] **Step 3: Commit**

```bash
git add "HTML PRUEBAS/informe-facturacion.html"
git commit -m "prototipo: generador de datos de ejemplo (mock) para el informe"
```

---

### Task 3: Tarjetas KPI

**Files:**
- Modify: `HTML PRUEBAS/informe-facturacion.html`

**Interfaces:**
- Consumes: `kpis` de `generarDatosMock()` (Tarea 2), forma `{ total, cantidad_ordenes, ticket_promedio }`.
- Produces: función global `renderKPIs(kpis)`, llamada por la Tarea 8 (`actualizarInforme()`).

- [ ] **Step 1: Agregar el markup de las tarjetas dentro de `#informeFacturacion`**

Reemplazar el `<div id="informeFacturacion"></div>` del Step 1 de la Tarea 1 por:

```html
<div id="informeFacturacion">
  <div class="stat-cards" id="kpiCards" style="grid-template-columns:repeat(3,1fr);"></div>
  <div class="card" id="chartCard" style="margin-top:16px;">
    <canvas id="graficoFacturacion" height="90"></canvas>
  </div>
</div>
```

- [ ] **Step 2: Agregar `fmtMoney` (igual a `public/js/app.js`) y `renderKPIs`**

```js
function fmtMoney(n) {
  if (n == null || isNaN(n)) return '$0';
  return '$' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function renderKPIs(kpis) {
  const container = document.getElementById('kpiCards');
  container.innerHTML = `
    <div class="stat-card entregada">
      <div class="stat-number entregada">${fmtMoney(kpis.total)}</div>
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
}
```

- [ ] **Step 3: Verificar en el navegador**

Agregar temporalmente al final del script: `renderKPIs(generarDatosMock(bucketPeriod('2026-07-01','2026-07-31').buckets).kpis);` recargar y confirmar que aparecen 3 tarjetas con números formateados como `$123.456`. Dejar esta línea — será reemplazada por el llamado real en la Tarea 8.

- [ ] **Step 4: Commit**

```bash
git add "HTML PRUEBAS/informe-facturacion.html"
git commit -m "prototipo: tarjetas KPI del informe de facturación"
```

---

### Task 4: Selector de vista (Total / Mano de obra / Repuestos)

**Files:**
- Modify: `HTML PRUEBAS/informe-facturacion.html`

**Interfaces:**
- Produces: variable global `vistaActual` (`'total'|'mano_obra'|'repuestos'`, default `'total'`); función global `initSelectorVista(onChange)` que registra los clicks y llama `onChange()` cada vez que cambia `vistaActual`. Usada por la Tarea 8.

- [ ] **Step 1: Agregar el markup de las pestañas, antes de las tarjetas KPI**

```html
<div class="chips" id="chipsVista" style="margin-bottom:16px;">
  <button type="button" class="chip active" data-vista="total">Total</button>
  <button type="button" class="chip" data-vista="mano_obra">Mano de obra</button>
  <button type="button" class="chip" data-vista="repuestos">Repuestos</button>
</div>
```

- [ ] **Step 2: Agregar la lógica**

```js
let vistaActual = 'total';

function initSelectorVista(onChange) {
  document.querySelectorAll('#chipsVista .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      vistaActual = chip.dataset.vista;
      document.querySelectorAll('#chipsVista .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      onChange();
    });
  });
}
```

- [ ] **Step 3: Verificar en el navegador**

Llamar temporalmente `initSelectorVista(() => console.log('vista:', vistaActual));` al final del script, recargar, hacer clic en cada pestaña y confirmar en la consola que `vistaActual` cambia y que la clase `active` se mueve visualmente entre los chips.

- [ ] **Step 4: Commit**

```bash
git add "HTML PRUEBAS/informe-facturacion.html"
git commit -m "prototipo: selector de vista Total/Mano de obra/Repuestos"
```

---

### Task 5: Selector de período — modo Mes

**Files:**
- Modify: `HTML PRUEBAS/informe-facturacion.html`

**Interfaces:**
- Produces: variable global `modoPeriodo` (`'mes'|'rango'`, default `'mes'`); variable global `mesActual` (objeto `Date`, día 1 del mes, default primer día del mes actual); variables globales `rangoDesde`/`rangoHasta` (objetos `Date`, valor por defecto: hoy — la Tarea 6 las deja interactivas con el calendario, acá sólo se declaran para que `getRangoActual()` nunca lea `undefined`); función global `initSelectorPeriodo(onChange)` que registra los controles de ambos modos y llama `onChange()` en cada cambio; función global `getRangoActual()` → `{ desdeISO, hastaISO }` según el modo activo. Usadas por la Tarea 8. La Tarea 6 añade el calendario interactivo al modo `'rango'` del mismo `initSelectorPeriodo`.

- [ ] **Step 1: Agregar el markup del selector de modo + navegador de mes**

Agregar arriba del todo dentro de `#informeFacturacion` (antes de `#chipsVista`):

```html
<div class="chips" id="chipsModoPeriodo" style="margin-bottom:12px;">
  <button type="button" class="chip active" data-modo="mes">Mes</button>
  <button type="button" class="chip" data-modo="rango">Rango personalizado</button>
</div>

<div id="modoMes" style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
  <button type="button" class="btn btn-secondary btn-sm" id="btnMesAnterior">←</button>
  <span id="labelMesActual" style="font-weight:700; min-width:140px; text-align:center;"></span>
  <button type="button" class="btn btn-secondary btn-sm" id="btnMesSiguiente">→</button>
</div>

<div id="modoRango" style="display:none; margin-bottom:16px;"></div>
```

- [ ] **Step 2: Agregar la lógica del modo Mes**

```js
let modoPeriodo = 'mes';
const hoy = new Date();
let mesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
let rangoDesde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
let rangoHasta = hoy;

function pad2(n) { return String(n).padStart(2, '0'); }
function toISO(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

function labelMes(d) {
  return d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase());
}

function getRangoActual() {
  if (modoPeriodo === 'mes') {
    const inicio = new Date(mesActual.getFullYear(), mesActual.getMonth(), 1);
    const fin = new Date(mesActual.getFullYear(), mesActual.getMonth() + 1, 0);
    return { desdeISO: toISO(inicio), hastaISO: toISO(fin) };
  }
  return { desdeISO: toISO(rangoDesde), hastaISO: toISO(rangoHasta) };
}

function initSelectorPeriodo(onChange) {
  document.getElementById('labelMesActual').textContent = labelMes(mesActual);

  document.getElementById('btnMesAnterior').addEventListener('click', () => {
    mesActual = new Date(mesActual.getFullYear(), mesActual.getMonth() - 1, 1);
    document.getElementById('labelMesActual').textContent = labelMes(mesActual);
    onChange();
  });
  document.getElementById('btnMesSiguiente').addEventListener('click', () => {
    mesActual = new Date(mesActual.getFullYear(), mesActual.getMonth() + 1, 1);
    document.getElementById('labelMesActual').textContent = labelMes(mesActual);
    onChange();
  });

  document.querySelectorAll('#chipsModoPeriodo .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      modoPeriodo = chip.dataset.modo;
      document.querySelectorAll('#chipsModoPeriodo .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      document.getElementById('modoMes').style.display = modoPeriodo === 'mes' ? 'flex' : 'none';
      document.getElementById('modoRango').style.display = modoPeriodo === 'rango' ? 'block' : 'none';
      onChange();
    });
  });
}
```

Nota: `rangoDesde`/`rangoHasta` ya quedan declarados arriba (con valor por defecto "hoy"), así que el modo "Rango personalizado" es funcional desde ahora (sin tirar error), aunque todavía sin calendario interactivo para cambiarlos — eso lo agrega la Tarea 6.

- [ ] **Step 3: Verificar en el navegador**

Llamar temporalmente `initSelectorPeriodo(() => console.log('rango:', getRangoActual()));` recargar, y: (a) confirmar que el label muestra el mes actual (ej. "Julio 2026"); (b) hacer clic en ← y → y confirmar que el label y el console.log cambian de mes correctamente incluyendo el cambio de año (probar retrocediendo desde enero); (c) hacer clic en "Rango personalizado" y confirmar que el bloque de mes se oculta (el bloque de rango se completa en la Tarea 6).

- [ ] **Step 4: Commit**

```bash
git add "HTML PRUEBAS/informe-facturacion.html"
git commit -m "prototipo: selector de período modo Mes"
```

---

### Task 6: Selector de período — modo Rango personalizado (calendario)

**Files:**
- Modify: `HTML PRUEBAS/informe-facturacion.html`

**Interfaces:**
- Consumes: `toISO()`, `pad2()`, `hoy`, `labelMes()`, `onChange` pattern y las variables `rangoDesde`/`rangoHasta` ya declaradas en la Tarea 5 (`getRangoActual()` las lee).
- Produces: la lógica interactiva que modifica `rangoDesde`/`rangoHasta` mediante clicks en el calendario; rellena el contenido de `#modoRango`.

- [ ] **Step 1: Agregar el markup base del calendario dentro de `#modoRango`**

Reemplazar `<div id="modoRango" style="display:none; margin-bottom:16px;"></div>` por:

```html
<div id="modoRango" style="display:none; margin-bottom:16px;">
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
```

- [ ] **Step 2: Agregar la lógica del calendario**

```js
let calMesVisible = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
let seleccionandoInicio = true;

function actualizarLabelRango() {
  document.getElementById('btnAbrirCalendario').textContent =
    `${toISO(rangoDesde).split('-').reverse().join('/')} – ${toISO(rangoHasta).split('-').reverse().join('/')}`;
}

function renderCalGrid() {
  document.getElementById('calLabelMes').textContent = labelMes(calMesVisible);
  const primerDia = new Date(calMesVisible.getFullYear(), calMesVisible.getMonth(), 1);
  const ultimoDia = new Date(calMesVisible.getFullYear(), calMesVisible.getMonth() + 1, 0);
  const offset = (primerDia.getDay() + 6) % 7; // lunes = 0

  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';
  ['L','M','X','J','V','S','D'].forEach(d => {
    grid.innerHTML += `<div style="font-weight:700; color:var(--text-muted);">${d}</div>`;
  });
  for (let i = 0; i < offset; i++) grid.innerHTML += '<div></div>';

  for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
    const fecha = new Date(calMesVisible.getFullYear(), calMesVisible.getMonth(), dia);
    const enRango = fecha >= rangoDesde && fecha <= rangoHasta;
    grid.innerHTML += `<button type="button" class="btn-day${enRango ? ' active' : ''}" data-fecha="${toISO(fecha)}"
      style="border:none; background:${enRango ? 'var(--primary)' : 'transparent'}; color:${enRango ? '#fff' : 'inherit'}; border-radius:6px; padding:4px 0; cursor:pointer;">${dia}</button>`;
  }

  grid.querySelectorAll('.btn-day').forEach(btn => {
    btn.addEventListener('click', () => onClickDia(btn.dataset.fecha));
  });
}

function onClickDia(fechaISO) {
  const fecha = new Date(fechaISO + 'T00:00:00');
  if (seleccionandoInicio) {
    rangoDesde = fecha;
    rangoHasta = fecha;
    seleccionandoInicio = false;
  } else if (fecha < rangoDesde) {
    rangoDesde = fecha;
    rangoHasta = fecha;
  } else {
    rangoHasta = fecha;
    seleccionandoInicio = true;
    document.getElementById('popoverCalendario').style.display = 'none';
    actualizarLabelRango();
    onCambioRangoCallback && onCambioRangoCallback();
  }
  actualizarLabelRango();
  renderCalGrid();
}

let onCambioRangoCallback = null;

function initCalendarioRango(onChange) {
  onCambioRangoCallback = onChange;
  actualizarLabelRango();
  renderCalGrid();

  document.getElementById('btnAbrirCalendario').addEventListener('click', () => {
    const pop = document.getElementById('popoverCalendario');
    pop.style.display = pop.style.display === 'none' ? 'block' : 'none';
  });
  document.getElementById('calMesAnterior').addEventListener('click', () => {
    calMesVisible = new Date(calMesVisible.getFullYear(), calMesVisible.getMonth() - 1, 1);
    renderCalGrid();
  });
  document.getElementById('calMesSiguiente').addEventListener('click', () => {
    calMesVisible = new Date(calMesVisible.getFullYear(), calMesVisible.getMonth() + 1, 1);
    renderCalGrid();
  });
}
```

- [ ] **Step 3: Llamar a `initCalendarioRango` desde `initSelectorPeriodo`**

Dentro de `initSelectorPeriodo(onChange)` (Tarea 5), justo antes del cierre de la función, agregar:

```js
  initCalendarioRango(onChange);
```

- [ ] **Step 4: Verificar en el navegador**

Recargar, hacer clic en "Rango personalizado", luego clic en el botón de fecha para abrir el popover. Confirmar: (a) el grid muestra los días del mes correctamente alineados (lunes primera columna); (b) al hacer clic en un día se marca en naranja como inicio; (c) al hacer clic en un día posterior se marca todo el rango y el popover se cierra solo, actualizando el label del botón a "DD/MM/AAAA – DD/MM/AAAA"; (d) las flechas del popover cambian de mes sin cerrar el popover.

- [ ] **Step 5: Commit**

```bash
git add "HTML PRUEBAS/informe-facturacion.html"
git commit -m "prototipo: calendario de rango personalizado"
```

---

### Task 7: Gráfico de área con degradé (Chart.js)

**Files:**
- Modify: `HTML PRUEBAS/informe-facturacion.html`

**Interfaces:**
- Consumes: `series` de `generarDatosMock()` (Tarea 2), `vistaActual` (Tarea 4).
- Produces: función global `renderGrafico(series, vista)`. Usada por la Tarea 8.

- [ ] **Step 1: Agregar la función de render del gráfico**

```js
let chartInstance = null;

function renderGrafico(series, vista) {
  const ctx = document.getElementById('graficoFacturacion').getContext('2d');
  const labels = series.map(s => s.label);
  const data = series.map(s => s[vista]);

  const gradient = ctx.createLinearGradient(0, 0, 0, 260);
  gradient.addColorStop(0, 'rgba(234,88,12,0.35)');
  gradient.addColorStop(1, 'rgba(234,88,12,0.02)');

  const config = {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data,
        borderColor: '#EA580C',
        backgroundColor: gradient,
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: '#EA580C',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => fmtMoney(ctx.parsed.y) }
        }
      },
      scales: {
        y: { ticks: { callback: v => fmtMoney(v) }, grid: { color: '#F1F5F9' } },
        x: { grid: { display: false } }
      }
    }
  };

  if (chartInstance) {
    chartInstance.data = config.data;
    chartInstance.options = config.options;
    chartInstance.update();
  } else {
    chartInstance = new Chart(ctx, config);
  }
}
```

- [ ] **Step 2: Verificar en el navegador**

Agregar temporalmente al final del script:
```js
renderGrafico(generarDatosMock(bucketPeriod('2026-07-01','2026-07-31').buckets).series, 'total');
```
Recargar y confirmar: el gráfico se ve como un área con degradé naranja que se desvanece hacia abajo, curva suave, y al pasar el mouse sobre un punto aparece un tooltip con el monto formateado en pesos. Dejar esta línea — se reemplaza por el llamado real en la Tarea 8.

- [ ] **Step 3: Commit**

```bash
git add "HTML PRUEBAS/informe-facturacion.html"
git commit -m "prototipo: gráfico de área con degradé usando Chart.js"
```

---

### Task 8: Integración final — wiring de todos los controles

**Files:**
- Modify: `HTML PRUEBAS/informe-facturacion.html`

**Interfaces:**
- Consumes: todas las funciones/variables de las Tareas 1–7 (`bucketPeriod`, `generarDatosMock`, `renderKPIs`, `renderGrafico`, `getRangoActual`, `initSelectorPeriodo`, `initSelectorVista`).
- Produces: función global `actualizarInforme()` — punto central que recalcula y re-renderiza todo. Es el resultado final visible del prototipo.

- [ ] **Step 1: Quitar las líneas de verificación temporal de las Tareas 2, 3 y 7**

Eliminar del script: la línea `console.table(...)` (Tarea 2), la línea `renderKPIs(generarDatosMock(...))` suelta (Tarea 3), la línea `initSelectorVista(() => console.log(...))` (Tarea 4) y la línea `renderGrafico(generarDatosMock(...), 'total')` suelta (Tarea 7).

- [ ] **Step 2: Agregar la función central y el arranque**

```js
function actualizarInforme() {
  const { desdeISO, hastaISO } = getRangoActual();
  const { buckets } = bucketPeriod(desdeISO, hastaISO);
  const { series, kpis } = generarDatosMock(buckets);
  renderKPIs(kpis);
  renderGrafico(series, vistaActual);
}

initSelectorPeriodo(actualizarInforme);
initSelectorVista(actualizarInforme);
actualizarInforme();
```

- [ ] **Step 3: Verificación manual completa**

Abrir `HTML PRUEBAS/informe-facturacion.html` en el navegador y confirmar, en orden:
1. Al cargar, se ve el mes actual seleccionado, las 3 tarjetas KPI con números, y el gráfico de área naranja con datos del mes.
2. Cambiar la pestaña a "Mano de obra" → el gráfico y las tarjetas cambian de valores (sin recargar la página).
3. Cambiar a "Repuestos" → ídem.
4. Volver a "Total" → los valores vuelven a coincidir con el paso 1.
5. Navegar con ← al mes anterior → el label y el gráfico cambian a datos de ese mes.
6. Cambiar a "Rango personalizado", elegir un rango de ~3 meses con el calendario → el gráfico pasa a mostrar buckets semanales (menos puntos que días).
7. Elegir un rango de más de 6 meses → el gráfico pasa a mostrar buckets mensuales.
8. Verificar que no hay errores en la consola de DevTools en ningún paso anterior.

- [ ] **Step 4: Commit final**

```bash
git add "HTML PRUEBAS/informe-facturacion.html"
git commit -m "prototipo: integración final del informe de facturación (mock funcional completo)"
```

---

## Después de este plan

Este plan termina en un prototipo 100% visual con datos falsos, para que el usuario lo revise en el navegador. **No continuar con la Tarea 2 del plan de entrega (backend real + integración a `public/index.html` + deploy a Railway) sin aprobación explícita del usuario sobre este prototipo.**
