import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { GRUPOS_FUENTES, TOTAL_FUENTES } from '../core/fuentes';

/** Un requisito de la guía y cómo lo cumple el sistema. */
interface Requisito {
  pedido: string;
  como: string;
  donde: string;
}

const REQUISITOS: Requisito[] = [
  {
    pedido: 'Hacer un rol de pagos',
    como: 'Se registran los empleados, se digitan las novedades del mes y se genera el rol: neto de cada empleado, costo para la empresa, boleta imprimible y archivo para Excel.',
    donde: 'Roles de pago',
  },
  {
    pedido: 'Que sea parametrizable',
    como: 'Las reglas de ley no están en el código: el sueldo básico, la tabla del impuesto a la renta, los regímenes y la escala salarial se editan desde la pantalla de parámetros.',
    donde: 'Parámetros',
  },
  {
    pedido: 'Escoger el régimen laboral: Código del Trabajo, LOSEP o LOEP',
    como: 'Cada empleado tiene su régimen. En la LOEP se indica además si es servidor (sigue la LOSEP) u obrero (sigue el Código del Trabajo). El rol usa las reglas del régimen de cada uno.',
    donde: 'Empleados',
  },
  {
    pedido: 'Salario básico',
    como: 'El sueldo básico unificado se guarda por año. Avisa si un sueldo queda por debajo y define el décimo cuarto.',
    donde: 'Parámetros, pestaña del año',
  },
  {
    pedido: 'Escala salarial',
    como: 'Los grados con su remuneración. Al elegir un grado se propone el sueldo y el cargo, y se avisa si el sueldo difiere de la remuneración del grado.',
    donde: 'Parámetros y Empleados',
  },
  {
    pedido: 'Si recibe décimo tercero y décimo cuarto',
    como: 'Por empleado: no lo recibe, se paga cada mes en el rol (lo que manda la ley por defecto) o lo acumula. Lo pagado en el rol no paga IESS ni impuesto a la renta.',
    donde: 'Empleados, sección de beneficios',
  },
  {
    pedido: 'Si recibe horas extras',
    como: 'Por empleado y por régimen. El recargo depende del régimen, se avisa si se pasa del tope mensual y quien no las recibe no las cobra.',
    donde: 'Empleados y novedades del mes',
  },
  {
    pedido: 'IESS: manual en Excel, pero ver si se puede automatizar',
    como: 'El aporte personal y el patronal se calculan solos, con la tasa de cada régimen. Como el IESS no recibe un archivo de aportes, el sistema entrega un cuadro para contrastar, empleado por empleado, con el comprobante del portal.',
    donde: 'Detalle del rol',
  },
];

/** Reglas que la investigación encontró, con el artículo de donde salen. */
interface Regla {
  tema: string;
  codigo: string;
  losep: string;
}

const REGLAS: Regla[] = [
  { tema: 'Horas suplementarias', codigo: '+50 %, máximo 4 al día y 12 a la semana (art. 55)', losep: '+25 %, hasta 60 al mes (art. 114)' },
  { tema: 'Horas extraordinarias', codigo: '+100 % de 24h00 a 06h00 (art. 55)', losep: '+60 %, hasta 60 al mes (art. 114)' },
  { tema: 'Sábado, domingo y feriado', codigo: '+100 % (art. 55)', losep: '+100 % (art. 114)' },
  { tema: 'Trabajo nocturno', codigo: '+25 %, de 19h00 a 06h00 (art. 49)', losep: 'No figura en el art. 114: por confirmar' },
  { tema: 'Vacaciones', codigo: '15 días, más 1 por cada año después del quinto (art. 69)', losep: '30 días, no se pagan en dinero salvo al salir (art. 29)' },
  { tema: 'Décimo tercero', codigo: '1/12 de lo percibido, pagado cada mes (art. 111)', losep: '1/12 de la remuneración (art. 97)' },
  { tema: 'Décimo cuarto', codigo: '1/12 del SBU por mes (art. 113)', losep: 'Un SBU al año, pagado proporcionalmente cada mes (art. 98)' },
  { tema: 'Fondos de reserva', codigo: 'Desde el segundo año de servicio (art. 196)', losep: 'Desde el segundo año (art. 99)' },
  { tema: 'Aporte personal al IESS', codigo: '9,45 % (página del IESS)', losep: '11,45 %: por confirmar' },
  { tema: 'Aporte patronal al IESS', codigo: '11,15 % (página del IESS)', losep: '9,15 %: por confirmar' },
];

interface PorConfirmar {
  dato: string;
  motivo: string;
  que: string;
}

const POR_CONFIRMAR: PorConfirmar[] = [
  {
    dato: 'Aporte al IESS de los servidores públicos',
    motivo: 'Las fuentes se contradicen (11,45 % y 9,15 % frente a 9,45 % y 11,15 %) y no se pudo leer la Resolución CD 501 ni la Disposición Transitoria 16 que varias citan.',
    que: 'El sistema usa 11,45 % y 9,15 % para la LOSEP. Se cambia en Parámetros, Regímenes laborales.',
  },
  {
    dato: 'Escala salarial del sector público',
    motivo: 'No se encontró la escala oficial vigente de 20 grados. La que se carga viene de ecu11.com, que dice «20 grados» pero lista 22 y no cita el acuerdo ministerial.',
    que: 'Se carga como escala de ejemplo y se edita en Parámetros, Escala salarial.',
  },
  {
    dato: 'Recargo nocturno de la LOSEP',
    motivo: 'El art. 114 no lo menciona; se asumió el 25 % del Código del Trabajo.',
    que: 'Se edita en el régimen de la LOSEP.',
  },
  {
    dato: 'Reformas posteriores a 2016 de la LOSEP',
    motivo: 'La copia leída es de 2016 y la búsqueda no devolvió reformas específicas de Ecuador.',
    que: 'Revisa el texto vigente en el Registro Oficial antes de usar el sistema en una nómina real.',
  },
  {
    dato: 'Formato de carga masiva del IESS',
    motivo: 'El IESS genera la planilla en su portal; no se encontró un formato público de archivo para subir los aportes.',
    que: 'El sistema entrega un cuadro de conciliación, no un archivo de carga.',
  },
];

/** Página pública: de qué trata el proyecto, qué encontró la investigación y de dónde salen las reglas. */
@Component({
  selector: 'app-informacion',
  imports: [RouterLink],
  templateUrl: './informacion.html',
  styleUrl: './informacion.css',
})
export class Informacion {
  protected readonly requisitos = REQUISITOS;
  protected readonly reglas = REGLAS;
  protected readonly porConfirmar = POR_CONFIRMAR;
  protected readonly grupos = GRUPOS_FUENTES;
  protected readonly totalFuentes = TOTAL_FUENTES;
  protected readonly totalLeidas = GRUPOS_FUENTES.reduce(
    (n, g) => n + g.fuentes.filter((f) => f.leida).length,
    0,
  );
}
