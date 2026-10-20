/**
 * Fuentes de la investigación que respalda las reglas del sistema.
 *
 * `leida: true` = se abrió y se leyó el documento completo (o los artículos citados).
 * `leida: false` = se vio en los resultados de una búsqueda y de ahí se tomó solo el dato que dice `uso`.
 * Esta lista es la misma que figura en el README.
 */
export interface Fuente {
  titulo: string;
  url: string;
  /** Qué dato se tomó de esta fuente */
  uso: string;
  leida: boolean;
}

export interface GrupoFuentes {
  id: string;
  titulo: string;
  descripcion: string;
  fuentes: Fuente[];
}

export const GRUPOS_FUENTES: GrupoFuentes[] = [
  {
    id: 'normas',
    titulo: 'Normas leídas en su texto',
    descripcion: 'La base de las reglas de cada régimen. Son las fuentes de mayor peso.',
    fuentes: [
      {
        titulo: 'Ley Orgánica de Servicio Público (LOSEP), texto del Registro Oficial Suplemento 294',
        url: 'https://www.oas.org/juridico/pdfs/mesicic5_ecu_ane_mdt_4.3_ley_org_ser_p%C3%BAb.pdf',
        uso: 'Arts. 25, 29, 97, 98, 99, 101 y 114: jornada, 30 días de vacaciones, décimos, fondos de reserva y recargos de horas extras. La copia es de 2016: no se verificaron reformas posteriores.',
        leida: true,
      },
      {
        titulo: 'Código del Trabajo, versión del 12 de marzo de 2026 (Legalcloud)',
        url: 'https://legalcloud.ec/wp-content/uploads/2026/04/Codigo-del-Trabajo-CT-12-03-2026-Normativa-Ecuatoriana.pdf',
        uso: 'Arts. 47, 49, 55, 69, 71, 111 a 114 y 196: jornada, recargos, vacaciones, décimos mensuales por defecto y fondos de reserva.',
        leida: true,
      },
      {
        titulo: 'Ley Orgánica de Empresas Públicas (LOEP), copia del Ministerio de Telecomunicaciones',
        url: 'https://www.telecomunicaciones.gob.ec/wp-content/uploads/2017/05/LEY-ORGANICA-DE-EMPRESAS-PUBLICAS.pdf',
        uso: 'Arts. 17, 18 y 19: servidores de libre designación, servidores de carrera y obreros; el Directorio fija vacaciones y remuneraciones.',
        leida: true,
      },
    ],
  },
  {
    id: 'oficiales',
    titulo: 'Páginas oficiales',
    descripcion: 'Del IESS y del Ministerio del Trabajo.',
    fuentes: [
      {
        titulo: 'IESS: servicios del afiliado',
        url: 'https://www.iess.gob.ec/en/web/afiliado/servicios-y-prestaciones',
        uso: 'Aporte personal de 9,45 % y patronal de 11,15 % (régimen general). No publica una tabla para el sector público.',
        leida: true,
      },
      {
        titulo: 'Ministerio del Trabajo: Acuerdo MDT-2024-039',
        url: 'https://trabajo.gob.ec/wp-content/uploads/2024/04/AM-MDT-2024-039.pdf',
        uso: 'Escala oficial del nivel jerárquico superior: 10 grados, de $2.115 a $5.072. Se vio en los resultados de búsqueda; el sistema no la carga.',
        leida: false,
      },
      {
        titulo: 'Ministerio del Trabajo: Código del Trabajo (PDF)',
        url: 'https://www.trabajo.gob.ec/wp-content/uploads/downloads/2024/01/CODIGO_DEL_TRABAJO.pdf',
        uso: 'Confirmación del art. 49 (jornada nocturna, de 19h00 a 06h00, con 25 % de recargo).',
        leida: false,
      },
    ],
  },
  {
    id: 'sbu',
    titulo: 'Sueldo básico unificado 2026 ($482)',
    descripcion: 'Fijado por el Acuerdo Ministerial MDT-2025-195. Todas son secundarias; no se leyó el acuerdo.',
    fuentes: [
      {
        titulo: 'El Diario: el SBU será de 482 dólares para 2026',
        url: 'https://www.eldiario.ec/centro/el-salario-basico-unificado-de-ecuador-sera-de-482-dolares-para-2026-el-aumento-es-de-12-dolares-20251215/',
        uso: 'Monto de $482 y aumento de $12 sobre 2025.',
        leida: false,
      },
      {
        titulo: 'Tagline: sueldo básico Ecuador 2026',
        url: 'https://tagline-soluciones.com/blog/talento-humano/salario-basico-unificado/',
        uso: 'Número del acuerdo ministerial y fecha de publicación.',
        leida: false,
      },
      {
        titulo: 'Buró Tributario: Ecuador fija el SBU para 2026 en $482',
        url: 'https://burotributario.com.ec/ecuador-fija-el-salario-basico-unificado-para-2026-en-482/',
        uso: 'Vigencia desde el 1 de enero de 2026.',
        leida: false,
      },
      {
        titulo: 'Lexis: ajuste de los salarios mínimos sectoriales',
        url: 'https://www.lexis.com.ec/noticias/ecuador-ajusta-salarios-minimos',
        uso: 'Ningún salario sectorial puede quedar por debajo del SBU.',
        leida: false,
      },
      {
        titulo: 'Cámara de la Construcción de Quito: Boletín Jurídico de enero de 2026',
        url: 'https://ccq.ec/wp-content/uploads/2026/04/Boletin-Juridico-Enero-2026.pdf',
        uso: 'Fijación del SBU del trabajador en general.',
        leida: false,
      },
      {
        titulo: 'Xinhua: Ecuador fija en 482 dólares el salario mínimo mensual para 2026',
        url: 'http://spanish.xinhuanet.com/20251216/239f5b62ef6c433992ed771faf363c9a/c.html',
        uso: 'Confirmación del monto.',
        leida: false,
      },
    ],
  },
  {
    id: 'ir',
    titulo: 'Tabla del impuesto a la renta 2026',
    descripcion:
      'Fracción básica desgravada de $12.208 y diez tramos, del 0 % al 37 %. Resolución NAC-DGERCGC25-00000043 del SRI (Andersen la cita como NAC-DGERCGC25-43).',
    fuentes: [
      {
        titulo: 'Andersen: resoluciones del SRI de diciembre de 2025',
        url: 'https://ec.andersen.com/wp-content/uploads/2026/01/TIPS-1-Resoluciones-SRI-diciembre-2025-1.pdf',
        uso: 'La resolución actualizó los rangos y se mantienen las tarifas.',
        leida: false,
      },
      {
        titulo: 'Factuplan: tabla del impuesto a la renta 2026',
        url: 'https://factuplan.com.ec/blog/tabla-impuesto-a-la-renta-2026-ecuador',
        uso: 'Los diez tramos con su cuota y su porcentaje.',
        leida: false,
      },
      {
        titulo: 'Ecuador Legal Online: tabla de impuesto a la renta 2026',
        url: 'https://www.ecuadorlegalonline.com/sri/tabla-de-impuesto-a-la-renta/',
        uso: 'Apareció al buscar la tabla; no se abrió.',
        leida: false,
      },
      {
        titulo: 'Ciro: tablas del impuesto a la renta 2026',
        url: 'https://ciro.com.ec/blog/tablas-impuesto-renta-2026/',
        uso: 'Publica los mismos valores de la tabla.',
        leida: false,
      },
      {
        titulo: 'Dergest: tablas de retenciones de IVA e IR 2026',
        url: 'https://dergest.com/blog/tablas-retenciones-ecuador-2026.html',
        uso: 'Publica los mismos valores de la tabla.',
        leida: false,
      },
      {
        titulo: 'UQA: actualizaciones del SRI para el ejercicio fiscal 2026',
        url: 'https://uqa.com.ec/tablas-del-impuesto-a-la-renta-conoce-las-actualizaciones-del-sri-para-el-ejercicio-fiscal-2026/',
        uso: 'Apareció al buscar la tabla; no se abrió.',
        leida: false,
      },
      {
        titulo: 'JEZL Auditores: tabla del IR 2026 y 2025',
        url: 'https://www.jezl-auditores.com/index.php/tributario/101-tabla-de-impuesto-a-la-renta-ir-2026-2025-personas-naturales-ecuador',
        uso: 'Apareció al buscar la tabla; no se abrió.',
        leida: false,
      },
      {
        titulo: 'Tagline: impuesto a la renta en Ecuador 2025-2026',
        url: 'https://tagline-soluciones.com/blog/talento-humano/impuesto-a-la-renta-ecuador/',
        uso: 'Equivalencia mensual: no paga quien gana menos de $1.017,33 al mes.',
        leida: false,
      },
    ],
  },
  {
    id: 'iess-publico',
    titulo: 'Aporte al IESS del sector público (por confirmar)',
    descripcion:
      'Las fuentes se contradicen: unas dan 11,45 % personal y 9,15 % patronal para los servidores públicos; otras, 9,45 % y 11,15 %. Varias atribuyen el 11,45 % a la Disposición Transitoria 16 de la Ley de Seguridad Social y a la Resolución CD 501 del IESS, pero no se pudo leer ninguna de las dos. El sistema usa 11,45 % y 9,15 % para la LOSEP y lo deja editable.',
    fuentes: [
      {
        titulo: 'El Telégrafo: los porcentajes de aportación de servidores públicos cambiarán en 2016',
        url: 'https://www.eltelegrafo.com.ec/noticias/politica/1/los-porcentajes-de-aportacion-al-iess-de-servidores-publicos-cambiaran-en-2016',
        uso: 'Antes 11,45 % y 9,15 %; se anunció pasar a 9,45 % y 11,15 %. No cita la norma.',
        leida: true,
      },
      {
        titulo: 'El Universo: desde 2016 se homologarán los aportes del sector público y privado',
        url: 'https://www.eluniverso.com/noticias/2015/02/28/nota/4602491/2016-se-homologaran-aportes-sector-publico-privado-iess/',
        uso: 'El mismo anuncio. No hay evidencia de que se aplicara.',
        leida: false,
      },
      {
        titulo: 'Trámites Básicos: porcentajes de aportes al IESS del sector público y privado',
        url: 'https://www.tramitesbasicos.com/cuanto-es-el-aporte-al-iess/',
        uso: 'Apareció al buscar los porcentajes del sector público y del privado; se usó como contraste.',
        leida: false,
      },
      {
        titulo: 'Gactiva: aportes IESS',
        url: 'https://gactiva.com/2023/03/18/aportes-iess/',
        uso: 'Tabla con 11,45 % de aporte personal para los servidores públicos.',
        leida: false,
      },
      {
        titulo: 'Ecuadorec: porcentaje de aportación al IESS',
        url: 'https://ecuadorec.com/porcentaje-aportacion-iess-personal-patronal/',
        uso: 'Contradice a las demás: da 9,45 % personal para el sector público general.',
        leida: false,
      },
      {
        titulo: 'Primicias: afiliados del IESS podrán ver sus aportes',
        url: 'https://www.primicias.ec/noticias/economia/afiliados-iess-podran-ver-aportes/',
        uso: 'Apareció al buscar el aporte de los servidores públicos; no se confirmó el dato en su texto.',
        leida: false,
      },
      {
        titulo: 'Tagline: aporte patronal al IESS 2026',
        url: 'https://tagline-soluciones.com/blog/talento-humano/aportacion-iess-empleador-ecuador/',
        uso: 'Aporte patronal general de 11,15 %.',
        leida: false,
      },
      {
        titulo: 'Seguridad social del IESS (presentación de la Superintendencia de Bancos)',
        url: 'http://www.cesantiadac.fin.ec/superintendencia-de-bancos/img/5_SEGURIDAD_SOCIAL_IESS.PDF',
        uso: 'Cuadro con servidores del sector público: 11,45 %, 9,15 % y 20,60 %.',
        leida: false,
      },
    ],
  },
  {
    id: 'horas',
    titulo: 'Horas extras en el sector público',
    descripcion: 'Contraste de los recargos y topes del art. 114 de la LOSEP.',
    fuentes: [
      {
        titulo: 'Universidad Estatal de Milagro: instructivo de pago de horas suplementarias y extraordinarias',
        url: 'https://www.unemi.edu.ec/wp-content/uploads/2018/04/instructivo_pago_horas_suplementarias_extraordinarias.pdf',
        uso: 'Cita el art. 114 de la LOSEP: horas adicionales con autorización y disponibilidad presupuestaria.',
        leida: false,
      },
      {
        titulo: 'Acuerdo 0025-15: reglamento interno para el pago de horas suplementarias y extraordinarias',
        url: 'https://www.oficial.ec/acuerdo-0025-15-expidese-reglamento-interno-pago-horas-suplementarias-extraordinarias-servidores',
        uso: 'Reglamento de una institución pública para el pago de horas extras de servidores y trabajadores.',
        leida: false,
      },
      {
        titulo: 'Tagline: cálculo de horas extras en Ecuador 2026',
        url: 'https://tagline-soluciones.com/blog/talento-humano/calculo-de-horas-extras-ecuador/',
        uso: 'Recargos del Código del Trabajo (50 % y 100 %).',
        leida: false,
      },
      {
        titulo: 'Tagline: jornada laboral en Ecuador 2026',
        url: 'https://tagline-soluciones.com/blog/talento-humano/jornada-laboral-ecuador/',
        uso: 'Jornada de 8 horas diarias y 40 semanales, y recargo nocturno.',
        leida: false,
      },
    ],
  },
  {
    id: 'beneficios',
    titulo: 'Décimos y fondos de reserva',
    descripcion: 'Contraste del texto de la ley con lo que se practica.',
    fuentes: [
      {
        titulo: 'Derecho Ecuador: fondos de reserva',
        url: 'https://derechoecuador.com/fondos-de-reserva/',
        uso: '8,33 % del sueldo; el tiempo anterior con el mismo empleador se suma.',
        leida: false,
      },
      {
        titulo: 'Corte Nacional de Justicia: Resolución 02-2024 sobre fondos de reserva',
        url: 'https://www.cortenacional.gob.ec/cnj/images/pdf/resoluciones/2024/2024-02-Jurisprudencia-obligatoria-Competencia-para-conocer-reclamos-sobre-fondos-de-reserva.pdf',
        uso: 'La reforma de 2009 creó dos opciones: pago directo al trabajador o depósito en el IESS.',
        leida: false,
      },
      {
        titulo: 'Hacecuentas: décimos y fondos de reserva 2026',
        url: 'https://hacecuentas.com/ec/trabajo/decimos-y-fondos-de-reserva',
        uso: 'Apareció al buscar los décimos; no se abrió.',
        leida: false,
      },
      {
        titulo: 'Finiquito Justo: fondos de reserva, mensualizado frente al IESS',
        url: 'https://finiquitojusto.com/derechos-laborales/fondos-reserva-ecuador/',
        uso: 'El pago ordinario va en el rol; acumular en el IESS requiere solicitud escrita.',
        leida: false,
      },
      {
        titulo: 'Roles de pago: aportes IESS Ecuador 2026',
        url: 'https://rolesdepago.com/aportes-iess-ecuador-2026/',
        uso: 'Qué integra la materia gravada: sueldo, horas extras y comisiones; no los décimos.',
        leida: false,
      },
      {
        titulo: 'Tagline: fondos de reserva en Ecuador 2026',
        url: 'https://tagline-soluciones.com/blog/talento-humano/fondos-de-reserva-ecuador/',
        uso: 'El pago ordinario va en el rol; acumular en el IESS requiere solicitud del trabajador.',
        leida: false,
      },
      {
        titulo: 'Hacecuentas: sueldo neto en Ecuador 2026',
        url: 'https://hacecuentas.com/ec/trabajo/sueldo-neto',
        uso: 'Los décimos no pagan el 9,45 % del IESS.',
        leida: false,
      },
    ],
  },
  {
    id: 'loep',
    titulo: 'Régimen laboral de las empresas públicas',
    descripcion: 'Análisis de la LOEP.',
    fuentes: [
      {
        titulo: 'Redalyc: régimen laboral de las empresas públicas ecuatorianas',
        url: 'https://www.redalyc.org/journal/6002/600263428008/html/',
        uso: 'La LOEP regula a los servidores de carrera y remite a los obreros al Código del Trabajo.',
        leida: false,
      },
      {
        titulo: 'vLex: Ley Orgánica de Empresas Públicas',
        url: 'https://vlex.ec/vid/ley-organica-empresas-publicas-643461625',
        uso: 'Contraste de la clasificación del personal.',
        leida: false,
      },
    ],
  },
  {
    id: 'escala',
    titulo: 'Escala salarial del sector público (por confirmar)',
    descripcion:
      'No se encontró la escala oficial vigente de 20 grados. La que carga el sistema viene de una fuente secundaria que dice «20 grados» pero lista 22.',
    fuentes: [
      {
        titulo: 'ecu11: escala de remuneraciones del sector público 2026',
        url: 'https://ecu11.com/escala-de-remuneraciones-del-sector-publico/',
        uso: 'Los 22 grados de $527 a $4.500 que se cargan como escala de ejemplo de la LOSEP. No cita el acuerdo ministerial.',
        leida: true,
      },
      {
        titulo: 'Lexis: Acuerdo Ministerial 39, fijación de remuneraciones mensuales unificadas',
        url: 'https://www.lexis.com.ec/noticias/acuerdo-ministerial-39-fijacion-de-remuneraciones-mensuales-unificadas-de-servidores-de-entidades-del-sector-publico',
        uso: 'Una escala de 10 grados, de fecha antigua; se descartó.',
        leida: false,
      },
      {
        titulo: 'Tagline: sueldos del sector público en Ecuador 2026',
        url: 'https://tagline-soluciones.com/salarios/sector-publico/',
        uso: 'Mismos valores que ecu11 con otra numeración de grados.',
        leida: false,
      },
    ],
  },
  {
    id: 'planilla',
    titulo: 'Planilla del IESS',
    descripcion: 'Cómo se declaran los aportes. No se encontró un formato público de archivo para subirlos.',
    fuentes: [
      {
        titulo: 'Tagline: planillas del IESS para el empleador 2026',
        url: 'https://tagline-soluciones.com/blog/talento-humano/planillas-iess-empleador/',
        uso: 'La planilla se genera en el portal a partir de los avisos de entrada y salida y las novedades; la base es la materia gravada.',
        leida: true,
      },
      {
        titulo: 'Tus Trámites Ecuador: registro masivo de novedades (carga batch)',
        url: 'https://tustramitesecuador.com/registro-masivo-de-novedades-para-empleadores-carga-batch/',
        uso: 'Existe una carga batch de novedades en el portal; no se pudo confirmar su formato.',
        leida: false,
      },
      {
        titulo: 'Contapp: planilla del IESS en Ecuador',
        url: 'https://www.contapp.ec/blogs/planilla-iess-ecuador',
        uso: 'Apareció al buscar el formato de la planilla; no se abrió.',
        leida: false,
      },
    ],
  },
];

export const TOTAL_FUENTES = GRUPOS_FUENTES.reduce((n, g) => n + g.fuentes.length, 0);
