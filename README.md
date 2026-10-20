# Rol de Pagos Ecuador 2026

Sistema de nómina para Ecuador con reglas de ley **parametrizables**: API en **Express** y aplicación en **Angular**, con una página de inicio pública, una página de información con la investigación y el sistema detrás del botón **Ingresar al sistema**.

Se hizo como práctica de la guía APE, que pide un rol de pagos parametrizable: escoger el régimen laboral (Código del Trabajo, LOSEP o LOEP), el salario básico, la escala salarial, si el trabajador recibe décimo tercero, décimo cuarto y horas extras, y ver si el IESS, que se hace a mano en Excel, se puede automatizar.

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

La base `backend/data/rol_pagos.db` se crea sola al arrancar. Si ya existía de una versión anterior, se actualiza sin perder datos (ver [Migraciones](#migraciones)). Borrarla reinicia todo.

| Comando | Qué hace |
|---|---|
| `npm run instalar` | Instala dependencias de los tres proyectos |
| `npm start` | Compila el frontend y sirve todo desde Express |
| `npm run dev` | Backend y frontend en modo desarrollo, con proxy de `/api` |
| `npm test` | Pruebas del backend (Node) y del frontend (Vitest) |
| `npm run lint` | Tipos y ESLint de ambos proyectos |

## Qué pide la guía y cómo se cumple

| La guía pide | Cómo lo hace el sistema | Dónde |
|---|---|---|
| Hacer un rol de pagos | Empleados, novedades del mes, rol con neto y costo empleador, boleta imprimible y CSV | Roles de pago |
| Que sea parametrizable | SBU, tabla del IR, regímenes y escala salarial se editan en pantalla, sin tocar el código | Parámetros |
| Escoger el régimen: Código del Trabajo, LOSEP o LOEP | Cada empleado tiene su régimen; en la LOEP se indica además si es servidor u obrero | Empleados |
| Salario básico | Se guarda por año; avisa si un sueldo queda por debajo y define el décimo cuarto | Parámetros, pestaña del año |
| Escala salarial | Grados con su remuneración; al elegir uno se propone el sueldo y el cargo | Parámetros y Empleados |
| Si recibe décimo tercero y décimo cuarto | Por empleado: no lo recibe, se paga cada mes en el rol o lo acumula | Empleados, sección de beneficios |
| Si recibe horas extras | Por empleado y por régimen, con el recargo y el tope de cada uno | Empleados y novedades |
| IESS, manual en Excel: ver si se automatiza | El aporte personal y el patronal se calculan solos; además se entrega un cuadro de conciliación con el comprobante del IESS | Detalle del rol |

## Recorrido

1. **Página de inicio (`/`)**: explica el sistema y tiene un simulador que calcula un sueldo en vivo con el motor real. Se elige el régimen y si los décimos se pagan, se acumulan o no se reciben.
2. **Información (`/informacion`)**: de qué trata el proyecto, lo que encontró la investigación y los enlaces de todas las fuentes.
3. **Parámetros (`/sistema/parametros`)**: tres pestañas. *Año*: SBU y tabla del impuesto a la renta, con la opción de agregar un año nuevo copiando otro. *Regímenes laborales*: aportes, recargos, topes, vacaciones y beneficios de cada uno. *Escala salarial*: los grados de cada régimen.
4. **Empleados**: alta con cédula validada (módulo 10), régimen, grado de la escala, beneficios y horas extras. Un clic carga seis empleados de ejemplo que cubren los tres regímenes.
5. **Roles de pago**: se elige el mes y se digitan las novedades (horas suplementarias, extraordinarias, de sábado, domingo o feriado, y nocturnas; comisiones; anticipos). Quien no recibe horas extras tiene esas columnas deshabilitadas.
6. **Generar**: el backend calcula a cada empleado activo con las reglas de su régimen y guarda una foto en `roles_detalle`. Avisa, sin bloquear, si alguien pasa el tope mensual de horas.
7. **Rol**: dos ecuaciones (`ingresos − descuentos = neto` e `ingresos + provisiones = costo empleador`), la planilla por empleado, el costo empleador aparte y la **conciliación con el IESS**.
8. **Boleta individual** imprimible en una hoja, y **descarga en CSV** del rol y de los aportes al IESS.

## Estructura

```
backend/                  API REST (Express 5, TypeScript, node:sqlite)
  src/calculos.ts         Motor de cálculo: funciones puras. Empezar a leer aquí.
  src/regimenes.ts        Regímenes laborales, reglas por régimen y opciones por empleado
  src/parametros.ts       SBU y tabla del IR por año
  src/escala.ts           Escala salarial
  src/iess.ts             Cuadro de conciliación con el IESS
  src/rutas/              empleados, roles, parámetros, regímenes y escala
  src/migraciones/        Esquema versionado: 001 a 006 (SQL numerado)
  src/db.ts               SQLite sin ORM y ejecutor de migraciones
  src/validaciones.ts     Cédula, números y fechas
  test/                   node:test, incluida la API completa
frontend/                 Angular 22 (componentes standalone, señales, sin zone.js)
  src/app/landing/        Página de inicio con el simulador
  src/app/informacion/    Página de información: acerca de, investigación y fuentes
  src/app/sistema/        Shell, empleados, roles y parámetros
  src/app/core/           Cliente de la API, avisos, pipe de dinero, modelos y fuentes
  src/styles.css          Sistema visual global
```

### API

| Método y ruta | Uso |
|---|---|
| `GET /api/parametros?anio=` | Reglas de ley del año, tabla del IR, regímenes y datos de la empresa |
| `PUT /api/parametros/:anio` | Crea o actualiza el SBU y la tabla del IR de un año |
| `POST /api/simulacion` | Calcula un rol de ejemplo sin guardar nada (`regimen`, `categoriaLoep`, `decimos`) |
| `GET /api/regimenes`, `GET /api/regimenes/:codigo` | Regímenes con todas sus reglas |
| `PUT /api/regimenes/:codigo` | Edita las reglas de un régimen |
| `GET /api/escala?regimen=` | Grados de la escala salarial |
| `POST /api/escala`, `PUT/DELETE /api/escala/:id` | Alta, edición y baja de un grado |
| `GET/POST /api/empleados` | Lista y alta |
| `GET/PUT/DELETE /api/empleados/:id` | Consulta, edición y baja |
| `PATCH /api/empleados/:id/estado` | Activa o desactiva |
| `POST /api/empleados/demo` | Carga los 6 empleados de ejemplo |
| `GET /api/roles` | Historial de roles |
| `GET /api/roles/periodo/:anio/:mes` | Empleados del mes, su régimen y las novedades ya digitadas |
| `POST /api/roles/generar` | Calcula y guarda el rol (reemplaza el del mes) y devuelve los avisos |
| `GET /api/roles/:id` | Rol con su detalle por empleado |
| `GET /api/roles/:id/csv` | Exportación para Excel |
| `GET /api/roles/:id/iess`, `GET /api/roles/:id/iess.csv` | Aportes por empleado para conciliar con el IESS |
| `DELETE /api/roles/:id` | Elimina el rol |

Los errores de validación responden `400` con `{ "errores": [...] }`; una cédula o un grado repetidos responden `409`.

## Reglas de cálculo

Todo lo que fija la ley está en la base de datos y se edita desde **Parámetros**: lo que cambia cada año (SBU y tabla del IR) y lo que cambia con el régimen (aportes, recargos, topes, vacaciones y beneficios). Los valores iniciales son estos.

| | Código del Trabajo | LOSEP |
|---|---|---|
| Aporte personal al IESS | 9,45 % | 11,45 % (**por confirmar**) |
| Aporte patronal al IESS | 11,15 % | 9,15 % (**por confirmar**) |
| Horas suplementarias | +50 %, referencia de 48 al mes (art. 55) | +25 %, hasta 60 al mes (art. 114) |
| Horas extraordinarias (24h00 a 06h00) | +100 % (art. 55) | +60 %, hasta 60 al mes (art. 114) |
| Sábado, domingo y feriado | +100 % | +100 % |
| Recargo nocturno | +25 % (art. 49) | +25 % (por confirmar: el art. 114 no lo menciona) |
| Vacaciones | 15 días (art. 69) | 30 días (art. 29) |
| Fondos de reserva | 8,33 % desde el mes 13 | 8,33 % desde el mes 13 |

La **LOEP** no tiene tasas propias: sus servidores de carrera se rigen por la LOSEP y sus obreros por el Código del Trabajo (LOEP arts. 17 a 19). Por eso, al elegirla, el empleado indica su categoría y el rol usa las reglas del régimen que corresponde.

| Concepto | Regla |
|---|---|
| Valor hora | sueldo ÷ 240 |
| Horas con recargo | hora × (1 + recargo del régimen); en las nocturnas solo se suma el recargo, porque la hora ya está en el sueldo |
| Ingreso aportable | sueldo + horas extras + comisiones: la base del IESS, del impuesto, del décimo tercero y de las vacaciones |
| Aporte personal IESS | tasa del régimen × ingreso aportable |
| Impuesto a la renta | `(aportable − IESS) × 12` → tabla SRI del año (exento hasta $12.208 en 2026) → ÷ 12 |
| Décimo tercero | ingreso aportable ÷ 12 |
| Décimo cuarto | SBU ÷ 12 |
| Vacaciones (provisión) | ingreso aportable × días de vacaciones ÷ 360 (15 días = 1/24, art. 71) |
| Fondos de reserva | 8,33 % del aportable desde el mes 13 |
| Mes de ingreso | sueldo y décimo cuarto proporcionales a los días (base 30) |

### Décimos y fondos: no, mensual o acumulado

Cada beneficio (décimo tercero, décimo cuarto y fondos de reserva) tiene tres modalidades por empleado:

- **Mensual** (lo que pasa si no se cambia nada, porque así lo dicen los arts. 111 y 113 del Código del Trabajo y 97 y 98 de la LOSEP): se paga dentro del rol y sube el neto. No suma al ingreso aportable: no paga IESS ni impuesto a la renta (Código del Trabajo arts. 112 y 114).
- **Acumulado**: el trabajador lo pidió por escrito; el empleador lo provisiona y aparece en el costo empleador.
- **No**: no lo recibe.

Si el empleado deja la opción en «según el régimen», vale lo que conceda su régimen. Lo mismo con las horas extras: quien no las recibe no las cobra, aunque se hayan digitado, y se avisa.

Las provisiones **no** afectan el neto. Costo empleador = ingresos + provisiones (acumulados, vacaciones y aporte patronal).

Todo el dinero se calcula con `decimal.js` y se redondea a centavos en cada rubro. Las multiplicaciones se hacen antes de las divisiones para que un empate exacto (por ejemplo `16273.2 ÷ 240 = 67.805`) redondee siempre hacia arriba.

### Escala salarial

Una escala por régimen. La de la LOSEP trae 22 grados, de $527 a $4.500, tomados de una fuente secundaria (ecu11.com) que dice «20 grados» pero lista 22 y no cita el acuerdo ministerial: está **por confirmar**. Si el régimen aplicado a un empleado tiene escala, el grado se **escoge obligatoriamente de la tabla** y el sueldo es la remuneración de ese grado: el formulario lo llena y no se escribe a mano, y la API rechaza un sueldo distinto. El cargo se propone con la denominación del grado y se puede cambiar. El **Código del Trabajo** trae 11 niveles ocupacionales (A jefatura; B1-B3 supervisión; C1-C3 operación; D1-D2 asistencia; E1-E2 soporte) cuya remuneración es un **mínimo**: el sueldo puede ser mayor, nunca menor, y se guarda también el tope del rango de mínimos entre ramas como referencia. Esa tabla salió de material de clase, sin acuerdo ministerial citado: está **por confirmar**. Los regímenes sin escala siguen con sueldo libre. Un grado solo puede asignarse a un empleado cuyo régimen aplicado use esa escala.

### Orgánico funcional

Antes de asignar un sueldo se identifica el **puesto**. Cada puesto dice de quién depende, qué **función** cumple, de qué **responde**, en qué **sector económico** está y qué **nivel de la escala salarial** le sirve de referencia. El orgánico de ejemplo es: gerente/propietario → administrador/contador → supervisor de instalaciones, operaciones de instalaciones y auxiliar de guardalmacén (nivel A, B1, B3, C2 y E2 de la tabla del Código del Trabajo). Se ve y se edita en **Orgánico**.

En el formulario del empleado, si el régimen aplicado tiene puestos, el puesto es obligatorio: al elegirlo se muestra su ficha, se preselecciona en un select el **nivel de la tabla que le toca** (con su mínimo y el tope del rango), se propone ese mínimo como sueldo y el nombre del puesto como cargo. El nivel se puede cambiar por otro de la tabla si al trabajador le toca uno distinto (se avisa que difiere del puesto), y la API rechaza un sueldo menor al mínimo del nivel. Los regímenes sin puestos (la LOSEP) siguen eligiendo directamente el grado. El **sector económico** de los puestos de ejemplo está en «Por definir» hasta saber la rama de la empresa, y los niveles asignados a cada puesto son una propuesta sobre una tabla de clase, por confirmar.

### Conciliación con el IESS

El IESS no recibe un archivo de aportes: arma la planilla en su portal a partir de los avisos de entrada y salida y las novedades que declara el empleador, y el comprobante se puede descargar en Excel. Lo que sí se automatiza es el cálculo, y por eso cada rol trae un cuadro con la materia gravada y los aportes personal y patronal de cada empleado, más los fondos de reserva que se depositan en el IESS (los que el trabajador acumula) y los que ya se pagaron en el rol. Se descarga en CSV y sirve para contrastar, línea por línea, con el comprobante del portal. La materia gravada no incluye los décimos ni los fondos pagados en el rol.

## Migraciones

El esquema vive en `backend/src/migraciones/NNN_nombre.sql`. La versión aplicada queda en `PRAGMA user_version`, así que abrir la misma base dos veces no repite nada y una base creada antes de las migraciones se pone al día sin perder datos. Para cambiar el esquema se agrega el siguiente archivo numerado; no se edita uno ya aplicado.

| Migración | Qué agrega |
|---|---|
| 001 | Empleados, novedades, roles y detalle |
| 002 | Parámetros anuales (SBU y tabla del IR) |
| 003 | Horas extras por tipo |
| 004 | Regímenes laborales |
| 005 | Escala salarial |
| 006 | Opciones por empleado y modalidad de cada beneficio en el rol |

Los roles ya generados guardan una foto del régimen, de las tasas y de la modalidad con que se calcularon: si luego se editan las reglas, el historial no cambia.

### Simplificaciones declaradas

- Sin autenticación: el botón de la landing entra directo al sistema.
- Sin gastos personales deducibles ni rebajas del impuesto a la renta.
- Sin préstamos del IESS, vacaciones gozadas ni liquidaciones por salida.
- Una sola empresa; su nombre y RUC están en `backend/src/config.ts`.
- Los topes de horas extras avisan pero no bloquean: la LOSEP dice que si se obliga a trabajar sobre el límite, igual se pagan.
- Los puestos del nivel jerárquico superior de la LOSEP no cobran horas extras: se marca «No las recibe» en ese empleado. No se incluye la escala oficial de ese nivel.

## Diseño

Cuatro colores con significado fijo en toda la app: azul para ingresos, ladrillo para descuentos, verde para el neto y ámbar para provisiones. La landing, el rol y las boletas los repiten, así que el recorrido se lee igual en cada pantalla. Lo que está por confirmar se marca en ámbar.

Las tipografías (Bricolage Grotesque y Figtree) van incluidas en `frontend/public/fonts`; la aplicación funciona sin internet.

## Lo que queda por confirmar

| Dato | Por qué | Qué hace el sistema |
|---|---|---|
| Aporte al IESS de los servidores públicos | Las fuentes se contradicen (11,45 % y 9,15 % frente a 9,45 % y 11,15 %) y no se pudo leer la Resolución CD 501 ni la Disposición Transitoria 16 que varias citan | Usa 11,45 % y 9,15 % para la LOSEP; se edita en Parámetros |
| Escala salarial del sector público | No se encontró la escala oficial vigente de 20 grados | Carga una escala de ejemplo editable |
| Recargo nocturno de la LOSEP | El art. 114 no lo menciona | Asume el 25 % del Código del Trabajo; editable |
| Reformas de la LOSEP posteriores a 2016 | La copia leída es de 2016 | Revisa el texto vigente antes de usarlo en una nómina real |
| Formato de carga masiva del IESS | No se encontró un formato público de archivo | Entrega un cuadro de conciliación, no un archivo de carga |

Verifica todas las cifras con la norma y con el IESS antes de usar el sistema en una nómina real.

## Fuentes

Esta lista es la misma que muestra la página de información del sistema (`/informacion`) y sale de `frontend/src/app/core/fuentes.ts`. Son 47 enlaces. Las 7 marcadas como **leída** se abrieron y se leyeron; de las demás solo se tomó el dato que indica cada una, a partir de los resultados de una búsqueda. Los textos legales pesan más que los blogs: cuando discrepan, mandan las normas.

### Normas leídas en su texto

La base de las reglas de cada régimen. Son las fuentes de mayor peso.

- [Ley Orgánica de Servicio Público (LOSEP), texto del Registro Oficial Suplemento 294](https://www.oas.org/juridico/pdfs/mesicic5_ecu_ane_mdt_4.3_ley_org_ser_p%C3%BAb.pdf) **(leída)**: Arts. 25, 29, 97, 98, 99, 101 y 114: jornada, 30 días de vacaciones, décimos, fondos de reserva y recargos de horas extras. La copia es de 2016: no se verificaron reformas posteriores.
- [Código del Trabajo, versión del 12 de marzo de 2026 (Legalcloud)](https://legalcloud.ec/wp-content/uploads/2026/04/Codigo-del-Trabajo-CT-12-03-2026-Normativa-Ecuatoriana.pdf) **(leída)**: Arts. 47, 49, 55, 69, 71, 111 a 114 y 196: jornada, recargos, vacaciones, décimos mensuales por defecto y fondos de reserva.
- [Ley Orgánica de Empresas Públicas (LOEP), copia del Ministerio de Telecomunicaciones](https://www.telecomunicaciones.gob.ec/wp-content/uploads/2017/05/LEY-ORGANICA-DE-EMPRESAS-PUBLICAS.pdf) **(leída)**: Arts. 17, 18 y 19: servidores de libre designación, servidores de carrera y obreros; el Directorio fija vacaciones y remuneraciones.

### Páginas oficiales

Del IESS y del Ministerio del Trabajo.

- [IESS: servicios del afiliado](https://www.iess.gob.ec/en/web/afiliado/servicios-y-prestaciones) **(leída)**: Aporte personal de 9,45 % y patronal de 11,15 % (régimen general). No publica una tabla para el sector público.
- [Ministerio del Trabajo: Acuerdo MDT-2024-039](https://trabajo.gob.ec/wp-content/uploads/2024/04/AM-MDT-2024-039.pdf): Escala oficial del nivel jerárquico superior: 10 grados, de $2.115 a $5.072. Se vio en los resultados de búsqueda; el sistema no la carga.
- [Ministerio del Trabajo: Código del Trabajo (PDF)](https://www.trabajo.gob.ec/wp-content/uploads/downloads/2024/01/CODIGO_DEL_TRABAJO.pdf): Confirmación del art. 49 (jornada nocturna, de 19h00 a 06h00, con 25 % de recargo).

### Sueldo básico unificado 2026 ($482)

Fijado por el Acuerdo Ministerial MDT-2025-195. Todas son secundarias; no se leyó el acuerdo.

- [El Diario: el SBU será de 482 dólares para 2026](https://www.eldiario.ec/centro/el-salario-basico-unificado-de-ecuador-sera-de-482-dolares-para-2026-el-aumento-es-de-12-dolares-20251215/): Monto de $482 y aumento de $12 sobre 2025.
- [Tagline: sueldo básico Ecuador 2026](https://tagline-soluciones.com/blog/talento-humano/salario-basico-unificado/): Número del acuerdo ministerial y fecha de publicación.
- [Buró Tributario: Ecuador fija el SBU para 2026 en $482](https://burotributario.com.ec/ecuador-fija-el-salario-basico-unificado-para-2026-en-482/): Vigencia desde el 1 de enero de 2026.
- [Lexis: ajuste de los salarios mínimos sectoriales](https://www.lexis.com.ec/noticias/ecuador-ajusta-salarios-minimos): Ningún salario sectorial puede quedar por debajo del SBU.
- [Cámara de la Construcción de Quito: Boletín Jurídico de enero de 2026](https://ccq.ec/wp-content/uploads/2026/04/Boletin-Juridico-Enero-2026.pdf): Fijación del SBU del trabajador en general.
- [Xinhua: Ecuador fija en 482 dólares el salario mínimo mensual para 2026](http://spanish.xinhuanet.com/20251216/239f5b62ef6c433992ed771faf363c9a/c.html): Confirmación del monto.

### Tabla del impuesto a la renta 2026

Fracción básica desgravada de $12.208 y diez tramos, del 0 % al 37 %. Resolución NAC-DGERCGC25-00000043 del SRI (Andersen la cita como NAC-DGERCGC25-43).

- [Andersen: resoluciones del SRI de diciembre de 2025](https://ec.andersen.com/wp-content/uploads/2026/01/TIPS-1-Resoluciones-SRI-diciembre-2025-1.pdf): La resolución actualizó los rangos y se mantienen las tarifas.
- [Factuplan: tabla del impuesto a la renta 2026](https://factuplan.com.ec/blog/tabla-impuesto-a-la-renta-2026-ecuador): Los diez tramos con su cuota y su porcentaje.
- [Ecuador Legal Online: tabla de impuesto a la renta 2026](https://www.ecuadorlegalonline.com/sri/tabla-de-impuesto-a-la-renta/): Apareció al buscar la tabla; no se abrió.
- [Ciro: tablas del impuesto a la renta 2026](https://ciro.com.ec/blog/tablas-impuesto-renta-2026/): Publica los mismos valores de la tabla.
- [Dergest: tablas de retenciones de IVA e IR 2026](https://dergest.com/blog/tablas-retenciones-ecuador-2026.html): Publica los mismos valores de la tabla.
- [UQA: actualizaciones del SRI para el ejercicio fiscal 2026](https://uqa.com.ec/tablas-del-impuesto-a-la-renta-conoce-las-actualizaciones-del-sri-para-el-ejercicio-fiscal-2026/): Apareció al buscar la tabla; no se abrió.
- [JEZL Auditores: tabla del IR 2026 y 2025](https://www.jezl-auditores.com/index.php/tributario/101-tabla-de-impuesto-a-la-renta-ir-2026-2025-personas-naturales-ecuador): Apareció al buscar la tabla; no se abrió.
- [Tagline: impuesto a la renta en Ecuador 2025-2026](https://tagline-soluciones.com/blog/talento-humano/impuesto-a-la-renta-ecuador/): Equivalencia mensual: no paga quien gana menos de $1.017,33 al mes.

### Aporte al IESS del sector público (por confirmar)

Las fuentes se contradicen: unas dan 11,45 % personal y 9,15 % patronal para los servidores públicos; otras, 9,45 % y 11,15 %. Varias atribuyen el 11,45 % a la Disposición Transitoria 16 de la Ley de Seguridad Social y a la Resolución CD 501 del IESS, pero no se pudo leer ninguna de las dos. El sistema usa 11,45 % y 9,15 % para la LOSEP y lo deja editable.

- [El Telégrafo: los porcentajes de aportación de servidores públicos cambiarán en 2016](https://www.eltelegrafo.com.ec/noticias/politica/1/los-porcentajes-de-aportacion-al-iess-de-servidores-publicos-cambiaran-en-2016) **(leída)**: Antes 11,45 % y 9,15 %; se anunció pasar a 9,45 % y 11,15 %. No cita la norma.
- [El Universo: desde 2016 se homologarán los aportes del sector público y privado](https://www.eluniverso.com/noticias/2015/02/28/nota/4602491/2016-se-homologaran-aportes-sector-publico-privado-iess/): El mismo anuncio. No hay evidencia de que se aplicara.
- [Trámites Básicos: porcentajes de aportes al IESS del sector público y privado](https://www.tramitesbasicos.com/cuanto-es-el-aporte-al-iess/): Apareció al buscar los porcentajes del sector público y del privado; se usó como contraste.
- [Gactiva: aportes IESS](https://gactiva.com/2023/03/18/aportes-iess/): Tabla con 11,45 % de aporte personal para los servidores públicos.
- [Ecuadorec: porcentaje de aportación al IESS](https://ecuadorec.com/porcentaje-aportacion-iess-personal-patronal/): Contradice a las demás: da 9,45 % personal para el sector público general.
- [Primicias: afiliados del IESS podrán ver sus aportes](https://www.primicias.ec/noticias/economia/afiliados-iess-podran-ver-aportes/): Apareció al buscar el aporte de los servidores públicos; no se confirmó el dato en su texto.
- [Tagline: aporte patronal al IESS 2026](https://tagline-soluciones.com/blog/talento-humano/aportacion-iess-empleador-ecuador/): Aporte patronal general de 11,15 %.
- [Seguridad social del IESS (presentación de la Superintendencia de Bancos)](http://www.cesantiadac.fin.ec/superintendencia-de-bancos/img/5_SEGURIDAD_SOCIAL_IESS.PDF): Cuadro con servidores del sector público: 11,45 %, 9,15 % y 20,60 %.

### Horas extras en el sector público

Contraste de los recargos y topes del art. 114 de la LOSEP.

- [Universidad Estatal de Milagro: instructivo de pago de horas suplementarias y extraordinarias](https://www.unemi.edu.ec/wp-content/uploads/2018/04/instructivo_pago_horas_suplementarias_extraordinarias.pdf): Cita el art. 114 de la LOSEP: horas adicionales con autorización y disponibilidad presupuestaria.
- [Acuerdo 0025-15: reglamento interno para el pago de horas suplementarias y extraordinarias](https://www.oficial.ec/acuerdo-0025-15-expidese-reglamento-interno-pago-horas-suplementarias-extraordinarias-servidores): Reglamento de una institución pública para el pago de horas extras de servidores y trabajadores.
- [Tagline: cálculo de horas extras en Ecuador 2026](https://tagline-soluciones.com/blog/talento-humano/calculo-de-horas-extras-ecuador/): Recargos del Código del Trabajo (50 % y 100 %).
- [Tagline: jornada laboral en Ecuador 2026](https://tagline-soluciones.com/blog/talento-humano/jornada-laboral-ecuador/): Jornada de 8 horas diarias y 40 semanales, y recargo nocturno.

### Décimos y fondos de reserva

Contraste del texto de la ley con lo que se practica.

- [Derecho Ecuador: fondos de reserva](https://derechoecuador.com/fondos-de-reserva/): 8,33 % del sueldo; el tiempo anterior con el mismo empleador se suma.
- [Corte Nacional de Justicia: Resolución 02-2024 sobre fondos de reserva](https://www.cortenacional.gob.ec/cnj/images/pdf/resoluciones/2024/2024-02-Jurisprudencia-obligatoria-Competencia-para-conocer-reclamos-sobre-fondos-de-reserva.pdf): La reforma de 2009 creó dos opciones: pago directo al trabajador o depósito en el IESS.
- [Hacecuentas: décimos y fondos de reserva 2026](https://hacecuentas.com/ec/trabajo/decimos-y-fondos-de-reserva): Apareció al buscar los décimos; no se abrió.
- [Finiquito Justo: fondos de reserva, mensualizado frente al IESS](https://finiquitojusto.com/derechos-laborales/fondos-reserva-ecuador/): El pago ordinario va en el rol; acumular en el IESS requiere solicitud escrita.
- [Roles de pago: aportes IESS Ecuador 2026](https://rolesdepago.com/aportes-iess-ecuador-2026/): Qué integra la materia gravada: sueldo, horas extras y comisiones; no los décimos.
- [Tagline: fondos de reserva en Ecuador 2026](https://tagline-soluciones.com/blog/talento-humano/fondos-de-reserva-ecuador/): El pago ordinario va en el rol; acumular en el IESS requiere solicitud del trabajador.
- [Hacecuentas: sueldo neto en Ecuador 2026](https://hacecuentas.com/ec/trabajo/sueldo-neto): Los décimos no pagan el 9,45 % del IESS.

### Régimen laboral de las empresas públicas

Análisis de la LOEP.

- [Redalyc: régimen laboral de las empresas públicas ecuatorianas](https://www.redalyc.org/journal/6002/600263428008/html/): La LOEP regula a los servidores de carrera y remite a los obreros al Código del Trabajo.
- [vLex: Ley Orgánica de Empresas Públicas](https://vlex.ec/vid/ley-organica-empresas-publicas-643461625): Contraste de la clasificación del personal.

### Escala salarial del sector público (por confirmar)

No se encontró la escala oficial vigente de 20 grados. La que carga el sistema viene de una fuente secundaria que dice «20 grados» pero lista 22.

- [ecu11: escala de remuneraciones del sector público 2026](https://ecu11.com/escala-de-remuneraciones-del-sector-publico/) **(leída)**: Los 22 grados de $527 a $4.500 que se cargan como escala de ejemplo de la LOSEP. No cita el acuerdo ministerial.
- [Lexis: Acuerdo Ministerial 39, fijación de remuneraciones mensuales unificadas](https://www.lexis.com.ec/noticias/acuerdo-ministerial-39-fijacion-de-remuneraciones-mensuales-unificadas-de-servidores-de-entidades-del-sector-publico): Una escala de 10 grados, de fecha antigua; se descartó.
- [Tagline: sueldos del sector público en Ecuador 2026](https://tagline-soluciones.com/salarios/sector-publico/): Mismos valores que ecu11 con otra numeración de grados.

### Planilla del IESS

Cómo se declaran los aportes. No se encontró un formato público de archivo para subirlos.

- [Tagline: planillas del IESS para el empleador 2026](https://tagline-soluciones.com/blog/talento-humano/planillas-iess-empleador/) **(leída)**: La planilla se genera en el portal a partir de los avisos de entrada y salida y las novedades; la base es la materia gravada.
- [Tus Trámites Ecuador: registro masivo de novedades (carga batch)](https://tustramitesecuador.com/registro-masivo-de-novedades-para-empleadores-carga-batch/): Existe una carga batch de novedades en el portal; no se pudo confirmar su formato.
- [Contapp: planilla del IESS en Ecuador](https://www.contapp.ec/blogs/planilla-iess-ecuador): Apareció al buscar el formato de la planilla; no se abrió.

