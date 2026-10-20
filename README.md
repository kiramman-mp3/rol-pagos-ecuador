# Rol de Pagos Ecuador 2026

Sistema demostrativo de nómina para Ecuador: API en **Express** y aplicación en **Angular**, con una página de inicio pública y el sistema detrás del botón **Ingresar al sistema**.

Requiere Node 24 o superior.

## Ejecutar

```bash
npm run instalar     # instala la raíz, el backend y el frontend
npm start            # compila Angular y levanta todo en http://localhost:3000
```

Para desarrollar con recarga automática:

```bash
npm run dev          # API en :3000 y Angular en http://localhost:4200
```

La base `backend/data/rol_pagos.db` se crea sola al arrancar. Borrarla reinicia todo.

| Comando | Qué hace |
|---|---|
| `npm run instalar` | Instala dependencias de los tres proyectos |
| `npm start` | Compila el frontend y sirve todo desde Express |
| `npm run dev` | Backend y frontend en modo desarrollo, con proxy de `/api` |
| `npm test` | Pruebas del backend (Node) y del frontend (Vitest) |
| `npm run lint` | Tipos y ESLint de ambos proyectos |

## Recorrido

1. **Página de inicio (`/`)**: explica el sistema, tiene un simulador que calcula un sueldo en vivo con el motor real y las reglas de 2026.
2. **Ingresar al sistema (`/sistema`)**: lleva a la lista de empleados.
3. **Empleados**: alta con cédula validada (módulo 10), edición, activar o desactivar, y datos de ejemplo con un clic.
4. **Roles de pago**: se elige el mes y se digitan las novedades (horas extras, comisiones, anticipos).
5. **Generar**: el backend calcula a cada empleado activo y guarda una foto en `roles_detalle`.
6. **Rol**: dos ecuaciones (`ingresos − descuentos = neto` e `ingresos + provisiones = costo empleador`), la planilla por empleado y el costo empleador aparte.
7. **Boleta individual** imprimible en una hoja, y **descarga en CSV**.

## Estructura

```
backend/                  API REST (Express 5, TypeScript, node:sqlite)
  src/calculos.ts         Reglas de negocio. Empezar a leer aquí.
  src/rutas/              empleados, roles, parámetros y simulación
  src/db.ts, schema.sql   SQLite sin ORM; 4 tablas
  src/validaciones.ts     Cédula, números y fechas
  test/                   node:test, incluida la API completa
frontend/                 Angular 22 (componentes standalone, señales, sin zone.js)
  src/app/landing/        Página de inicio con el simulador
  src/app/sistema/        Shell, empleados y roles
  src/app/core/           Cliente de la API, avisos, pipe de dinero y modelos
  src/styles.css          Sistema visual global
```

### API

| Método y ruta | Uso |
|---|---|
| `GET /api/parametros` | Reglas de ley 2026, tabla del IR y datos de la empresa |
| `POST /api/simulacion` | Calcula un rol de ejemplo sin guardar nada |
| `GET/POST /api/empleados` | Lista y alta |
| `GET/PUT/DELETE /api/empleados/:id` | Consulta, edición y baja |
| `PATCH /api/empleados/:id/estado` | Activa o desactiva |
| `POST /api/empleados/demo` | Carga los 6 empleados de ejemplo |
| `GET /api/roles` | Historial de roles |
| `GET /api/roles/periodo/:anio/:mes` | Empleados del mes y novedades ya digitadas |
| `POST /api/roles/generar` | Calcula y guarda el rol (reemplaza el del mes) |
| `GET /api/roles/:id` | Rol con su detalle por empleado |
| `GET /api/roles/:id/csv` | Exportación para Excel |
| `DELETE /api/roles/:id` | Elimina el rol |

Los errores de validación responden `400` con `{ "errores": [...] }`; una cédula repetida responde `409`.

## Reglas de cálculo

| Concepto | Regla |
|---|---|
| Valor hora | sueldo ÷ 240 |
| Horas suplementarias | hora × 1.5 |
| Horas extraordinarias (sáb., dom., feriados) | hora × 2 |
| Horas nocturnas | solo el recargo del 25% |
| Aporte personal IESS | 9.45% de los ingresos |
| Impuesto a la renta | `(ingresos − IESS) × 12` → tabla SRI 2026 (exento hasta $12,208) → ÷ 12 |
| Décimo tercero | total ingresos ÷ 12 |
| Décimo cuarto | SBU $482 ÷ 12 |
| Vacaciones | sueldo ÷ 24 |
| Fondos de reserva | 8.33% desde el mes 13 |
| Aporte patronal | 11.15% |
| Mes de ingreso | sueldo y décimo cuarto proporcionales a los días (base 30) |

Las provisiones **no** afectan el neto. Costo empleador = ingresos + provisiones.

Todo el dinero se calcula con `decimal.js` y se redondea a centavos en cada rubro. Las multiplicaciones se hacen antes de las divisiones para que un empate exacto (por ejemplo `16273.2 ÷ 240 = 67.805`) redondee siempre hacia arriba.

### Simplificaciones declaradas

- Sin autenticación: el botón de la landing entra directo al sistema.
- Sin gastos personales deducibles ni rebajas del IR.
- Sin décimos ni fondos de reserva mensualizados.
- Sin préstamos IESS, vacaciones gozadas ni liquidaciones por salida.
- Una sola empresa; su nombre y RUC están en `backend/src/config.ts`.

## Diseño

Cuatro colores con significado fijo en toda la app: azul para ingresos, ladrillo para descuentos, verde para el neto y ámbar para provisiones. La landing, el rol y las boletas los repiten, así que el recorrido se lee igual en cada pantalla.

Las tipografías (Bricolage Grotesque y Figtree) van incluidas en `frontend/public/fonts`; la aplicación funciona sin internet.

## Fuentes

Tabla del IR 2026: resolución NAC-DGERCGC25-00000043 del SRI. SBU 2026: $482. Verifica las cifras con el SRI antes de usar el sistema en una nómina real.
