# Informe de facturación — Integración al sistema real (Fase 2)

**Fecha:** 2026-08-04

## Objetivo

Llevar el prototipo aprobado (`HTML PRUEBAS/informe-facturacion.html`) al Dashboard real (`public/index.html`), con datos reales de la base de datos, sin romper nada existente y sin escribir jamás en `data/taller.db` (los datos son del negocio real y están actualizados).

## Restricción dura: datos reales

- El endpoint nuevo es **estrictamente de solo lectura** (`SELECT` únicamente). No se agrega, modifica ni borra ninguna fila.
- Antes de correr el servidor local contra la base real para probar, se hace un backup manual: `data/taller.db.backup-<fecha>` (no se commitea, es una red de seguridad local).
- Verificación: se levanta el servidor local (`npm start`) y se navega el dashboard real en el navegador, sin invocar ningún endpoint de escritura (crear/editar/borrar clientes, motos, órdenes, pagos, etc.) — solo se mira y se interactúa con la sección nueva.
- Todo el trabajo se hace en la rama `feature/informe-facturacion`. `main` no se toca hasta que el usuario apruebe explícitamente el resultado corriendo en su sistema real.

## Fuente de datos y regla de negocio (sin cambios respecto al diseño original)

- Base: `presupuesto_items` (`tipo`: `repuesto` | `mano_obra`), solo órdenes con `estado = 'entregada'`.
- Filtro de período sobre `ordenes_trabajo.fecha_entrega_real` (mismo campo y mismo criterio de rango que ya usa `GET /api/admin/stats`: `fecha_entrega_real >= desde` y `<= hasta + ' 23:59:59'`).
- El `descuento` (%) del presupuesto se aplica proporcionalmente a mano de obra y repuestos.
- Una orden entregada sin presupuesto/ítems igual cuenta como orden (con $0), para que "cantidad de órdenes" coincida con el criterio que ya usa el resto del sistema (no solo las que tienen presupuesto cargado).

## Backend

**Nuevo endpoint:** `GET /api/admin/facturacion?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`, agregado en `routes/admin.js` junto al `/stats` existente.

**Permisos:** igual que `routes/pagos.js`/`routes/presupuestos.js` — `if (req.session.role === 'mecanico') return res.status(403).json({ error: 'Sin permiso.' });`

**Consulta SQL** (una fila por orden entregada en el rango, con sus subtotales brutos por tipo):

```sql
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
```

**Post-procesamiento en JS** (dentro del route handler): por cada fila, `factor = 1 - descuento/100`; `mano_obra_neta = bruto_mano_obra * factor`; `repuestos_neta = bruto_repuestos * factor`. Se acumulan en un `Map` por `fecha` (`{ mano_obra, repuestos, cantidad_ordenes }`, sumando 1 orden por fila) y se devuelve como array ordenado por fecha.

**Respuesta:**
```json
{ "dias": [ { "fecha": "2026-07-16", "mano_obra": 12000, "repuestos": 8500, "cantidad_ordenes": 2 }, ... ] }
```

No se devuelven KPIs pre-calculados ni buckets — el cliente deriva todo de `dias` (una sola fuente de verdad para la agregación, ya probada del lado del cliente).

## Frontend

**Archivo nuevo:** `public/js/facturacion.js`. Todo el estado y las funciones quedan agrupadas en un objeto `Facturacion` (mismo patrón que `NuevaOT` en `public/js/nueva-ot.js`), para no ensuciar el global con ~20 nombres sueltos como hacía el prototipo standalone.

**Reutiliza sin cambios:**
- `bucketPeriod(desdeISO, hastaISO)` — la agrupación día/semana/mes, ya probada, se copia tal cual.
- El selector de período (modo Mes + modo Rango con calendario propio), el selector de vista (Total/Mano de obra/Repuestos), el gráfico Chart.js con crosshair y tooltip custom, el formato `fmtMoneyCompacto` — todo se porta igual que en el prototipo.
- `fmtMoney` y `fmtDate`: se usan las que ya existen en `public/js/app.js` (no se redefinen).
- Las llamadas al servidor usan `API.get('/api/admin/facturacion?desde=...&hasta=...')` (el wrapper que ya usa todo el resto del sistema), no `fetch()` directo.

**Función nueva:** `agregarDias(dias, buckets)` reemplaza a `generarDatosMock(buckets)` del prototipo — mismo shape de salida (`{ series, kpis }`), pero suma los `dias` reales (ya traídos del servidor) dentro de cada bucket en vez de generar valores pseudo-aleatorios.

**Markup:** se inserta la sección "Informe de facturación" en `public/index.html`, entre "Resumen de hoy" y "Actividad reciente" (según el diseño original). Se agrega el `<script>` de Chart.js (CDN) y de `facturacion.js` al final de la página, después de `dashboard.js`.

**CSS:** los estilos que en el prototipo vivían en un `<style>` suelto (tarjeta KPI en color de marca, tooltip custom, título/subtítulo del gráfico) se mueven a `public/css/main.css` como clases reutilizables, siguiendo la convención del proyecto (todo el sistema de diseño vive ahí).

**Sin auto-refresh:** a diferencia del resto del dashboard (que refresca cada 30s), este informe se carga al entrar a la página y se vuelve a pedir solo cuando el usuario cambia el período o la vista — para no interrumpir si tiene el calendario abierto o está pasando el mouse por el gráfico.

**Punto de entrada:** `dashboard.js`'s `onAppReady()` llama a `Facturacion.init()` además de lo que ya hace (`cargarDashboard()`). Al igual que en el prototipo, el período por defecto al cargar la página es el mes actual, y la vista por defecto es "Total".

## Manejo de errores

Mismo patrón que ya usa `dashboard.js`: `try/catch` alrededor del `API.get()`, mensaje de error inline en el contenedor de la sección si falla (no rompe el resto del dashboard).

## Plan de entrega

1. Crear rama `feature/informe-facturacion`.
2. Backup de `data/taller.db`.
3. Implementar backend (endpoint) + frontend (`facturacion.js`, markup, CSS).
4. Probar en local contra el servidor real (solo lectura) y mostrar el resultado al usuario.
5. Con aprobación del usuario: merge a `main`.
6. Si el usuario lo pide: `git push` a Railway.

## Fuera de alcance

- No se toca la tabla `pagos` ni el flujo de pagos existente.
- No se implementa exportación (PDF/Excel).
- No se agrega comparación contra período anterior (ya descartado en el diseño original).
- No se modifica el prototipo standalone (`HTML PRUEBAS/informe-facturacion.html`) — queda como referencia visual, no se borra.
