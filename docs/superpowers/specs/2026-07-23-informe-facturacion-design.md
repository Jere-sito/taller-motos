# Informe de facturación en el Dashboard

**Fecha:** 2026-07-23

## Objetivo

Agregar al Dashboard un informe visual de lo facturado (mano de obra / repuestos / total) en un período elegible por el usuario, con un gráfico profesional y dinámico.

## Ubicación

Nueva sección "Informe de facturación" en `public/index.html`, entre "Resumen de hoy" y "Actividad reciente".

## Fuente de datos y regla de negocio

- Se basa en `presupuesto_items` (columna `tipo`: `repuesto` | `mano_obra`), **no** en `pagos` — la tabla `pagos` no distingue tipo de ítem.
- Sólo se incluyen órdenes con `estado = 'entregada'`.
- El filtro de período se aplica sobre `ordenes_trabajo.fecha_entrega_real`.
- El `descuento` (%) del presupuesto se aplica proporcionalmente a los subtotales de repuestos y mano de obra, de modo que la suma coincida con el total real facturado al cliente.

## Selector de período

- Dos modos por pestañas: **Mes** y **Rango personalizado**.
- Modo Mes: flechas ← → con etiqueta tipo "Julio 2026"; clic en la etiqueta abre un selector de mes/año.
- Modo Rango personalizado: mini-calendario propio (HTML/JS sin dependencias) para elegir fecha "desde" y "hasta".
- Por defecto: mes actual.

## Selector de vista

Pestañas **Total | Mano de obra | Repuestos** que cambian la serie activa del gráfico (no se muestran las tres series apiladas a la vez).

## Tarjetas KPI

Tres tarjetas sobre el gráfico: total del período, cantidad de órdenes entregadas, ticket promedio por orden.

## Gráfico

- Librería: **Chart.js vía CDN** (`<script>` externo, sin bundler, mismo patrón que Google Fonts).
- Tipo: área con degradé del color primario (`--primary: #EA580C`), curva suave, tooltip con fecha y monto.
- Granularidad automática del eje X: por día si el rango es ≤31 días; por semana si es de 32 a 180 días; por mes si supera los 180 días.

## Backend nuevo

`GET /api/admin/facturacion?desde=YYYY-MM-DD&hasta=YYYY-MM-DD` en `routes/admin.js`:
- Devuelve buckets ya agrupados (día/semana/mes) con `total`, `mano_obra`, `repuestos`.
- Devuelve KPIs: `total`, `cantidad_ordenes`, `ticket_promedio`.
- Aplica el descuento del presupuesto proporcionalmente antes de sumar.

## Plan de entrega

1. **Maqueta estática** en `HTML PRUEBAS/informe-facturacion.html`: datos de ejemplo hardcodeados, usando `public/css/main.css` real (link relativo) para que se vea igual que en producción. Sin backend todavía. Objetivo: validar la UI/UX antes de tocar el proyecto real.
2. **Integración real**: endpoint en `routes/admin.js`, sección agregada a `public/index.html` + lógica en `public/js/dashboard.js` (o archivo nuevo `public/js/facturacion.js`).
3. **Deploy**: commit + `git push` a Railway (confirmar con el usuario antes de pushear).

## Fuera de alcance

- No se toca la tabla `pagos` ni el flujo de registro de pagos existente.
- No se implementa exportación (PDF/Excel) del informe — sólo visualización en pantalla.
- No se agrega comparación contra período anterior (decisión explícita del usuario).
