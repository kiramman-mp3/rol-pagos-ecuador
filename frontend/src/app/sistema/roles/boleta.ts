import { httpResource } from '@angular/common/http';
import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ParametrosLey, valorSeguro } from '../../core/api';
import { DineroPipe } from '../../core/dinero.pipe';
import type { RolCompleto } from '../../core/modelos';

/** Comprobante individual, pensado para imprimirse en una sola hoja. */
@Component({
  selector: 'app-boleta',
  imports: [RouterLink, DineroPipe],
  template: `
    <div class="acciones no-imprimir" style="margin-bottom: 1.25rem">
      <a class="boton boton-claro" [routerLink]="['/sistema/roles', id()]">Volver al rol</a>
      <button class="boton" type="button" (click)="imprimir()">Imprimir boleta</button>
    </div>

    @if (datos(); as r) {
      @if (d(); as d) {
        <article class="hoja boleta">
          <header class="boleta-cabecera">
            <div class="empresa-nombre">{{ parametros()?.empresa?.nombre }}</div>
            <div class="apoyo pequeno">RUC {{ parametros()?.empresa?.ruc }}</div>
            <h1>Rol de pagos de {{ nombreMes() }} {{ r.anio }}</h1>
          </header>

          <dl class="datos">
            <div><dt>Empleado</dt><dd>{{ d.nombres }}</dd></div>
            <div><dt>Cédula</dt><dd>{{ d.cedula }}</dd></div>
            <div><dt>Cargo</dt><dd>{{ d.cargo }}</dd></div>
            <div><dt>Ingreso</dt><dd>{{ d.fechaIngreso }}</dd></div>
          </dl>

          <div class="boleta-columnas">
            <table class="tabla">
              <thead>
                <tr>
                  <th class="g-ingresos t-ingresos">Ingresos</th>
                  <th class="num g-ingresos"><span class="solo-lectura">Valor</span></th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Sueldo@if (d.diasTrabajados < 30) { ({{ d.diasTrabajados }} días)}</td>
                  <td class="num">{{ d.sueldo | dinero }}</td>
                </tr>
                @if (d.horasSuplementarias) {
                  <tr><td>Horas suplementarias ({{ d.horasSuplementarias }} h)</td><td class="num">{{ d.valorHorasSuplementarias | dinero }}</td></tr>
                }
                @if (d.horasExtraordinarias) {
                  <tr><td>Horas extraordinarias ({{ d.horasExtraordinarias }} h)</td><td class="num">{{ d.valorHorasExtraordinarias | dinero }}</td></tr>
                }
                @if (d.horasDescanso) {
                  <tr><td>Horas en sábado, domingo o feriado ({{ d.horasDescanso }} h)</td><td class="num">{{ d.valorHorasDescanso | dinero }}</td></tr>
                }
                @if (d.horasNocturnas) {
                  <tr><td>Recargo nocturno ({{ d.horasNocturnas }} h)</td><td class="num">{{ d.valorRecargoNocturno | dinero }}</td></tr>
                }
                @if (d.comisiones) {
                  <tr><td>Comisiones y bonos</td><td class="num">{{ d.comisiones | dinero }}</td></tr>
                }
              </tbody>
              <tfoot>
                <tr><td>Total ingresos</td><td class="num">{{ d.totalIngresos | dinero }}</td></tr>
              </tfoot>
            </table>

            <table class="tabla">
              <thead>
                <tr>
                  <th class="g-descuentos t-descuentos">Descuentos</th>
                  <th class="num g-descuentos"><span class="solo-lectura">Valor</span></th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Aporte personal al IESS (9.45%)</td><td class="num">{{ d.aporteIess | dinero }}</td></tr>
                <tr><td>Impuesto a la renta</td><td class="num">{{ d.impuestoRenta | dinero }}</td></tr>
                @if (d.otrosDescuentos) {
                  <tr><td>Anticipos y otros</td><td class="num">{{ d.otrosDescuentos | dinero }}</td></tr>
                }
              </tbody>
              <tfoot>
                <tr><td>Total descuentos</td><td class="num">{{ d.totalDescuentos | dinero }}</td></tr>
              </tfoot>
            </table>
          </div>

          <div class="boleta-neto">
            <span class="etiqueta">Neto a recibir</span>
            <span class="cifra">{{ d.netoPagar | dinero }}</span>
          </div>

          <p class="pequeno apoyo">
            Cómo se obtuvo el impuesto a la renta: base anual proyectada de {{ d.baseIrAnual | dinero }}
            (ingresos menos IESS, por 12), impuesto anual de {{ d.irAnual | dinero }}, dividido para 12 meses.
          </p>

          <table class="tabla" style="margin-top: 1.25rem">
            <thead>
              <tr>
                <th class="g-provision">Provisiones a cargo del empleador (informativo)</th>
                <th class="num g-provision"><span class="solo-lectura">Valor</span></th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Décimo tercer sueldo</td><td class="num">{{ d.decimoTercero | dinero }}</td></tr>
              <tr><td>Décimo cuarto sueldo</td><td class="num">{{ d.decimoCuarto | dinero }}</td></tr>
              <tr><td>Vacaciones</td><td class="num">{{ d.vacaciones | dinero }}</td></tr>
              <tr><td>Fondos de reserva</td><td class="num">{{ d.fondosReserva | dinero }}</td></tr>
              <tr><td>Aporte patronal al IESS (11.15%)</td><td class="num">{{ d.aportePatronal | dinero }}</td></tr>
            </tbody>
          </table>

          <div class="firmas">
            <div class="firma">Firma del empleador</div>
            <div class="firma">Recibí conforme, CI {{ d.cedula }}</div>
          </div>
        </article>
      } @else {
        <div class="aviso aviso-danger" role="status">No se encontró esa boleta en este rol.</div>
      }
    } @else if (rol.error()) {
      <div class="aviso aviso-danger" role="status">No se encontró este rol.</div>
    } @else {
      <p class="apoyo">Cargando boleta…</p>
    }
  `,
})
export class Boleta {
  readonly id = input.required<string>();
  readonly detalleId = input.required<string>();

  protected readonly parametros = inject(ParametrosLey).valor;
  protected readonly rol = httpResource<RolCompleto>(() => `/api/roles/${this.id()}`);
  protected readonly datos = valorSeguro(this.rol);

  protected readonly d = computed(() =>
    this.datos()?.detalle.find((x) => x.id === Number(this.detalleId())),
  );
  protected readonly nombreMes = computed(
    () => this.parametros()?.meses[(this.datos()?.mes ?? 1) - 1] ?? '',
  );

  protected imprimir() {
    window.print();
  }
}
