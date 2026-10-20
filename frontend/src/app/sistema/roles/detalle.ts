import { httpResource } from '@angular/common/http';
import { PercentPipe } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { Api, ParametrosLey, valorSeguro } from '../../core/api';
import { Avisos } from '../../core/avisos';
import { DineroPipe, sumar } from '../../core/dinero.pipe';
import { etiquetaRegimen } from '../../core/regimen';
import type { RolCompleto, RolDetalle } from '../../core/modelos';

@Component({
  selector: 'app-detalle-rol',
  imports: [RouterLink, DineroPipe, PercentPipe],
  template: `
    @if (datos(); as r) {
      <div class="encabezado">
        <div>
          <h1>{{ nombreMes() }} {{ r.anio }}</h1>
          <p class="apoyo">
            {{ parametros()?.empresa?.nombre }}, RUC {{ parametros()?.empresa?.ruc }}.
            Generado el {{ r.generadoEn.slice(0, 10) }} a las {{ r.generadoEn.slice(11, 16) }}.
          </p>
        </div>
        <div class="acciones no-imprimir">
          <a class="boton boton-claro" [routerLink]="['/sistema/roles/novedades', r.anio, r.mes]">Recalcular</a>
          <a class="boton boton-claro" [href]="'/api/roles/' + r.id + '/csv'" download>Descargar CSV</a>
          <button class="boton boton-claro" type="button" (click)="imprimir()">Imprimir</button>
          <button class="boton-texto boton-peligro" type="button" (click)="eliminar(r)">Eliminar rol</button>
        </div>
      </div>

      <div class="franja">
        <div class="ecuacion" role="group" aria-label="Del ingreso al neto">
          <div class="termino termino-ingresos">
            <div class="etiqueta">Ingresos</div>
            <div class="cifra">{{ r.totalIngresos | dinero }}</div>
          </div>
          <span class="operador" aria-hidden="true">−</span>
          <div class="termino termino-descuentos">
            <div class="etiqueta">Descuentos</div>
            <div class="cifra">{{ r.totalDescuentos | dinero }}</div>
          </div>
          <span class="operador" aria-hidden="true">=</span>
          <div class="termino termino-neto">
            <div class="etiqueta">Neto a pagar a {{ r.numEmpleados }} empleados</div>
            <div class="cifra">{{ r.totalNeto | dinero }}</div>
          </div>
        </div>
        <div class="ecuacion ecuacion-provision" role="group" aria-label="Del ingreso al costo del empleador">
          <div class="termino termino-ingresos">
            <div class="etiqueta">Ingresos</div>
            <div class="cifra">{{ r.totalIngresos | dinero }}</div>
          </div>
          <span class="operador" aria-hidden="true">+</span>
          <div class="termino termino-provision">
            <div class="etiqueta">Provisiones del empleador</div>
            <div class="cifra">{{ r.totalProvisiones | dinero }}</div>
          </div>
          <span class="operador" aria-hidden="true">=</span>
          <div class="termino termino-costo">
            <div class="etiqueta">Costo total del empleador</div>
            <div class="cifra">{{ r.totalCosto | dinero }}</div>
          </div>
        </div>
      </div>

      <section class="hoja" aria-labelledby="titulo-planilla">
        <div class="hoja-titulo">
          <h2 id="titulo-planilla">Lo que recibe cada empleado</h2>
          <p>Haz clic en un nombre para abrir su boleta imprimible.</p>
        </div>
        <div class="deslizable">
          <table class="tabla planilla">
            <thead>
              <tr>
                <th rowspan="2">Empleado</th>
                <th colspan="4" class="g-ingresos t-ingresos corte">Ingresos</th>
                <th colspan="4" class="g-descuentos t-descuentos corte">Descuentos</th>
                <th rowspan="2" class="num g-neto c-neto corte">Neto a recibir</th>
              </tr>
              <tr>
                <th class="num corte">Sueldo</th>
                <th class="num">Horas extra</th>
                <th class="num">Comisiones</th>
                <th class="num">Total</th>
                <th class="num corte">Aporte IESS</th>
                <th class="num">Impuesto a la renta</th>
                <th class="num">Otros</th>
                <th class="num">Total</th>
              </tr>
            </thead>
            <tbody>
              @for (d of r.detalle; track d.id) {
                <tr>
                  <td>
                    <a [routerLink]="['/sistema/roles', r.id, 'boleta', d.id]">{{ d.nombres }}</a>
                    <span class="secundario">
                      {{ d.cargo }}@if (d.diasTrabajados < 30) {, {{ d.diasTrabajados }} días trabajados}
                    </span>
                    <span class="secundario">{{ regimen(d) }}</span>
                  </td>
                  <td class="num corte">{{ d.sueldo | dinero }}</td>
                  <td class="num">{{ horasExtra(d) | dinero }}</td>
                  <td class="num">{{ d.comisiones | dinero }}</td>
                  <td class="num"><strong>{{ d.totalIngresos | dinero }}</strong></td>
                  <td class="num corte">
                    {{ d.aporteIess | dinero }}
                    <span class="secundario">{{ d.tasaIessPersonal | percent: '1.2-2' }}</span>
                  </td>
                  <td class="num">{{ d.impuestoRenta | dinero }}</td>
                  <td class="num">{{ d.otrosDescuentos | dinero }}</td>
                  <td class="num"><strong>{{ d.totalDescuentos | dinero }}</strong></td>
                  <td class="num c-neto corte">{{ d.netoPagar | dinero }}</td>
                </tr>
              }
            </tbody>
            <tfoot>
              <tr>
                <td>Totales</td>
                <td class="num corte">{{ totales().sueldo | dinero }}</td>
                <td class="num">{{ totales().horasExtra | dinero }}</td>
                <td class="num">{{ totales().comisiones | dinero }}</td>
                <td class="num">{{ r.totalIngresos | dinero }}</td>
                <td class="num corte">{{ totales().iess | dinero }}</td>
                <td class="num">{{ totales().impuesto | dinero }}</td>
                <td class="num">{{ totales().otros | dinero }}</td>
                <td class="num">{{ r.totalDescuentos | dinero }}</td>
                <td class="num c-neto corte">{{ r.totalNeto | dinero }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section class="hoja hoja-provision" aria-labelledby="titulo-provisiones">
        <div class="hoja-titulo">
          <h2 id="titulo-provisiones">Costo empleador y provisiones</h2>
          <p>Lo paga la empresa aparte del neto. No se descuenta al trabajador.</p>
        </div>
        <div class="deslizable">
          <table class="tabla planilla">
            <thead>
              <tr>
                <th class="g-provision">Empleado</th>
                <th class="num g-provision">Décimo tercero</th>
                <th class="num g-provision">Décimo cuarto</th>
                <th class="num g-provision">Vacaciones</th>
                <th class="num g-provision">Fondos de reserva</th>
                <th class="num g-provision">Aporte patronal</th>
                <th class="num g-provision">Total provisiones</th>
                <th class="num">Costo empleador</th>
              </tr>
            </thead>
            <tbody>
              @for (d of r.detalle; track d.id) {
                <tr>
                  <td>{{ d.nombres }}</td>
                  <td class="num">{{ d.decimoTercero | dinero }}</td>
                  <td class="num">{{ d.decimoCuarto | dinero }}</td>
                  <td class="num">{{ d.vacaciones | dinero }}</td>
                  <td class="num">
                    @if (d.fondosReserva) {
                      {{ d.fondosReserva | dinero }}
                    } @else {
                      <span class="apoyo" title="Se generan desde el mes 13 de trabajo">Aún no aplica</span>
                    }
                  </td>
                  <td class="num">
                    {{ d.aportePatronal | dinero }}
                    <span class="secundario">{{ d.tasaIessPatronal | percent: '1.2-2' }}</span>
                  </td>
                  <td class="num"><strong>{{ d.totalProvisiones | dinero }}</strong></td>
                  <td class="num"><strong>{{ d.costoEmpleador | dinero }}</strong></td>
                </tr>
              }
            </tbody>
            <tfoot>
              <tr>
                <td>Totales</td>
                <td class="num">{{ totales().decimoTercero | dinero }}</td>
                <td class="num">{{ totales().decimoCuarto | dinero }}</td>
                <td class="num">{{ totales().vacaciones | dinero }}</td>
                <td class="num">{{ totales().fondos | dinero }}</td>
                <td class="num">{{ totales().patronal | dinero }}</td>
                <td class="num">{{ r.totalProvisiones | dinero }}</td>
                <td class="num">{{ r.totalCosto | dinero }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div class="hoja-cuerpo pequeno apoyo">
          El décimo cuarto se calcula sobre el sueldo básico unificado ({{ parametros()?.sbu | dinero }}), el tercero
          sobre el total de ingresos, las vacaciones sobre el ingreso con horas extras (1/24) y los fondos de reserva (8.33%) desde el
          mes 13. El costo del empleador es el total de ingresos más estas provisiones.
        </div>
      </section>
    } @else if (rol.error()) {
      <div class="aviso aviso-danger" role="status">
        No se encontró este rol. Puede que se haya eliminado.
        <a routerLink="/sistema/roles">Volver a roles de pago</a>
      </div>
    } @else {
      <p class="apoyo">Cargando rol…</p>
    }
  `,
})
export class DetalleRol {
  readonly id = input.required<string>();

  private readonly api = inject(Api);
  private readonly avisos = inject(Avisos);
  private readonly router = inject(Router);
  protected readonly parametros = inject(ParametrosLey).valor;
  protected readonly rol = httpResource<RolCompleto>(() => `/api/roles/${this.id()}`);
  protected readonly datos = valorSeguro(this.rol);

  protected readonly nombreMes = computed(
    () => this.parametros()?.meses[(this.datos()?.mes ?? 1) - 1] ?? '',
  );

  protected readonly totales = computed(() => {
    const d = this.datos()?.detalle ?? [];
    const suma = (campo: (x: RolDetalle) => number) => sumar(d.map(campo));
    return {
      sueldo: suma((x) => x.sueldo),
      horasExtra: suma((x) => this.horasExtra(x)),
      comisiones: suma((x) => x.comisiones),
      iess: suma((x) => x.aporteIess),
      impuesto: suma((x) => x.impuestoRenta),
      otros: suma((x) => x.otrosDescuentos),
      decimoTercero: suma((x) => x.decimoTercero),
      decimoCuarto: suma((x) => x.decimoCuarto),
      vacaciones: suma((x) => x.vacaciones),
      fondos: suma((x) => x.fondosReserva),
      patronal: suma((x) => x.aportePatronal),
    };
  });

  protected regimen(d: RolDetalle): string {
    return etiquetaRegimen(this.parametros()?.regimenes, d.regimen, d.regimenAplicado);
  }

  protected horasExtra(d: RolDetalle): number {
    return sumar([
      d.valorHorasSuplementarias, d.valorHorasExtraordinarias, d.valorHorasDescanso, d.valorRecargoNocturno,
    ]);
  }

  protected imprimir() {
    window.print();
  }

  protected async eliminar(r: RolCompleto) {
    if (!confirm(`¿Eliminar el rol de ${this.nombreMes()} ${r.anio}?`)) return;
    try {
      await firstValueFrom(this.api.eliminarRol(r.id));
      this.avisos.exito('Rol eliminado.');
      await this.router.navigateByUrl('/sistema/roles');
    } catch (error) {
      this.avisos.errorHttp(error);
    }
  }
}
