import { httpResource } from '@angular/common/http';
import { PercentPipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { Api, ParametrosLey, valorSeguro } from '../../core/api';
import { Avisos } from '../../core/avisos';
import { DineroPipe, sumar } from '../../core/dinero.pipe';
import { etiquetaRegimen } from '../../core/regimen';
import type { Modalidad, PlanillaIess, RolCompleto, RolDetalle } from '../../core/modelos';

@Component({
  selector: 'app-detalle-rol',
  imports: [RouterLink, DineroPipe, PercentPipe],
  styles: `
    .volver { margin-left: -.5rem; }
    h1 .insignia { vertical-align: middle; margin-left: .4rem; font-family: var(--cuerpo); letter-spacing: 0; }
    .saltos { display: flex; gap: .5rem; flex-wrap: wrap; margin: -.5rem 0 1.25rem; }
    .saltos a {
      font-weight: 700; font-size: .875rem; text-decoration: none; color: var(--noche);
      background: var(--hoja); border: 1.5px solid var(--linea); border-radius: 999px; padding: .4rem .9rem;
    }
    .saltos a:hover { border-color: var(--marca); background: var(--ingresos-fondo); }
    .confirmar { display: inline-flex; align-items: center; gap: .25rem; font-size: .9rem; font-weight: 600; color: var(--descuentos); }
  `,
  template: `
    @if (datos(); as r) {
      <div class="encabezado">
        <div>
          <a class="boton-texto volver no-imprimir" routerLink="/sistema/roles">‹ Roles de pago</a>
          <h1>{{ nombreMes() }} {{ r.anio }} <span class="insignia insignia-neto no-imprimir">Rol generado</span></h1>
          <p class="apoyo">
            {{ parametros()?.empresa?.nombre }}, RUC {{ parametros()?.empresa?.ruc }}.
            Generado el {{ r.generadoEn.slice(0, 10) }} a las {{ r.generadoEn.slice(11, 16) }}.
          </p>
        </div>
        <div class="acciones no-imprimir">
          <a class="boton boton-sol" [href]="'/api/roles/' + r.id + '/csv'" download>Descargar CSV</a>
          <a class="boton boton-claro" [href]="'/api/roles/' + r.id + '/iess.csv'" download>Aportes para el IESS</a>
          <button class="boton boton-claro" type="button" (click)="imprimir()">Imprimir</button>
          <a class="boton boton-claro" [routerLink]="['/sistema/roles/novedades', r.anio, r.mes]">Recalcular</a>
          @if (confirmandoEliminar()) {
            <span class="confirmar" role="alert">
              ¿Eliminar el rol de {{ nombreMes() }}?
              <button class="boton-texto boton-peligro" type="button" (click)="eliminar(r)">Sí, eliminar</button>
              <button class="boton-texto" type="button" (click)="confirmandoEliminar.set(false)">No</button>
            </span>
          } @else {
            <button class="boton-texto boton-peligro" type="button" (click)="confirmandoEliminar.set(true)">Eliminar rol</button>
          }
        </div>
      </div>

      <nav class="saltos no-imprimir" aria-label="Secciones del rol">
        <a href="#titulo-planilla" (click)="ir($event, 'titulo-planilla')">Lo que recibe cada persona</a>
        <a href="#titulo-provisiones" (click)="ir($event, 'titulo-provisiones')">Costo empleador</a>
        <a href="#titulo-iess" (click)="ir($event, 'titulo-iess')">Conciliación con el IESS</a>
      </nav>

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
                <th colspan="5" class="g-ingresos t-ingresos corte">Ingresos</th>
                <th colspan="4" class="g-descuentos t-descuentos corte">Descuentos</th>
                <th rowspan="2" class="num g-neto c-neto corte"><span class="th-largo">Neto a recibir</span><span class="th-corto" aria-hidden="true">Neto</span></th>
              </tr>
              <tr>
                <th class="num corte">Sueldo</th>
                <th class="num"><span class="th-largo">Horas extra</span><span class="th-corto" aria-hidden="true">H. extra</span></th>
                <th class="num">Comisiones</th>
                <th class="num" title="Décimos y fondos de reserva que se pagan dentro del rol"><span class="th-largo">Décimos y fondos</span><span class="th-corto" aria-hidden="true">Déc. y fondos</span></th>
                <th class="num">Total</th>
                <th class="num corte"><span class="th-largo">Aporte IESS</span><span class="th-corto" aria-hidden="true">IESS</span></th>
                <th class="num"><span class="th-largo">Impuesto a la renta</span><span class="th-corto" aria-hidden="true">IR</span></th>
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
                  <td class="num">{{ d.beneficiosMensuales | dinero }}</td>
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
                <td class="num">{{ totales().beneficios | dinero }}</td>
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
          <p>
            Lo paga la empresa aparte del neto. Los décimos y fondos que se pagan en el rol ya están en los
            ingresos; aquí solo aparecen los que el trabajador acumula.
          </p>
        </div>
        <div class="deslizable">
          <table class="tabla planilla">
            <thead>
              <tr>
                <th class="g-provision">Empleado</th>
                <th class="num g-provision"><span class="th-largo">Décimo tercero</span><span class="th-corto" aria-hidden="true">13.º</span></th>
                <th class="num g-provision"><span class="th-largo">Décimo cuarto</span><span class="th-corto" aria-hidden="true">14.º</span></th>
                <th class="num g-provision">Vacaciones</th>
                <th class="num g-provision"><span class="th-largo">Fondos de reserva</span><span class="th-corto" aria-hidden="true">Fondos</span></th>
                <th class="num g-provision"><span class="th-largo">Aporte patronal</span><span class="th-corto" aria-hidden="true">Patronal</span></th>
                <th class="num g-provision"><span class="th-largo">Total provisiones</span><span class="th-corto" aria-hidden="true">Total</span></th>
                <th class="num"><span class="th-largo">Costo empleador</span><span class="th-corto" aria-hidden="true">Costo</span></th>
              </tr>
            </thead>
            <tbody>
              @for (d of r.detalle; track d.id) {
                <tr>
                  <td>{{ d.nombres }}</td>
                  <td class="num">
                    @if (d.decimoTerceroModalidad === 'acumulado') { {{ d.decimoTercero | dinero }} }
                    @else { <span class="apoyo">{{ pagado(d.decimoTerceroModalidad) }}</span> }
                  </td>
                  <td class="num">
                    @if (d.decimoCuartoModalidad === 'acumulado') { {{ d.decimoCuarto | dinero }} }
                    @else { <span class="apoyo">{{ pagado(d.decimoCuartoModalidad) }}</span> }
                  </td>
                  <td class="num">{{ d.vacaciones | dinero }}</td>
                  <td class="num">
                    @if (d.fondosReservaModalidad === 'no') {
                      <span class="apoyo">No recibe</span>
                    } @else if (!d.fondosReserva) {
                      <span class="apoyo" title="Se generan desde el mes 13 de trabajo">Aún no aplica</span>
                    } @else if (d.fondosReservaModalidad === 'acumulado') {
                      {{ d.fondosReserva | dinero }}
                    } @else {
                      <span class="apoyo">{{ pagado(d.fondosReservaModalidad) }}</span>
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
          sobre los ingresos aportables, las vacaciones sobre esos mismos ingresos según los días del régimen y los
          fondos de reserva desde el mes 13. El costo del empleador es el total de ingresos más estas provisiones.
        </div>
      </section>

      @if (iess(); as p) {
        <section class="hoja" aria-labelledby="titulo-iess">
          <div class="hoja-titulo">
            <h2 id="titulo-iess">Conciliación con el IESS</h2>
            <p>
              El IESS arma la planilla en su portal con tus avisos y novedades; no recibe un archivo. Descarga el
              comprobante del mes (se puede bajar en Excel) y compara, empleado por empleado, la materia gravada y
              los aportes de esta tabla.
            </p>
          </div>
          <div class="deslizable">
            <table class="tabla planilla">
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th class="num"><span class="th-largo">Materia gravada</span><span class="th-corto" aria-hidden="true">Gravada</span></th>
                  <th class="num"><span class="th-largo">Aporte personal</span><span class="th-corto" aria-hidden="true">Personal</span></th>
                  <th class="num"><span class="th-largo">Aporte patronal</span><span class="th-corto" aria-hidden="true">Patronal</span></th>
                  <th class="num"><span class="th-largo">Total aportes</span><span class="th-corto" aria-hidden="true">Total</span></th>
                  <th class="num" title="Fondos de reserva que el trabajador acumula: se depositan en el IESS"><span class="th-largo">Fondos a depositar</span><span class="th-corto" aria-hidden="true">A depositar</span></th>
                  <th class="num" title="Fondos de reserva que ya se pagaron en el rol"><span class="th-largo">Fondos pagados en el rol</span><span class="th-corto" aria-hidden="true">Pagados en rol</span></th>
                </tr>
              </thead>
              <tbody>
                @for (f of p.filas; track f.cedula) {
                  <tr>
                    <td>{{ f.nombres }}<span class="secundario">{{ f.cedula }}</span></td>
                    <td class="num">{{ f.materiaGravada | dinero }}</td>
                    <td class="num">
                      {{ f.aportePersonal | dinero }}
                      <span class="secundario">{{ f.tasaPersonal | percent: '1.2-2' }}</span>
                    </td>
                    <td class="num">
                      {{ f.aportePatronal | dinero }}
                      <span class="secundario">{{ f.tasaPatronal | percent: '1.2-2' }}</span>
                    </td>
                    <td class="num"><strong>{{ f.totalAportes | dinero }}</strong></td>
                    <td class="num">{{ f.fondosADepositar | dinero }}</td>
                    <td class="num">{{ f.fondosPagadosEnRol | dinero }}</td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr>
                  <td>Totales</td>
                  <td class="num">{{ p.totales.materiaGravada | dinero }}</td>
                  <td class="num">{{ p.totales.aportePersonal | dinero }}</td>
                  <td class="num">{{ p.totales.aportePatronal | dinero }}</td>
                  <td class="num">{{ p.totales.totalAportes | dinero }}</td>
                  <td class="num">{{ p.totales.fondosADepositar | dinero }}</td>
                  <td class="num">{{ p.totales.fondosPagadosEnRol | dinero }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div class="hoja-cuerpo pequeno apoyo">
            La materia gravada es el sueldo, las horas extras y las comisiones: los décimos y los fondos de reserva
            pagados en el rol no la integran. Los décimos se declaran aparte, en el sistema de décimos del Ministerio
            del Trabajo, no en la planilla del IESS.
          </div>
        </section>
      }
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
  protected readonly iess = valorSeguro(httpResource<PlanillaIess>(() => `/api/roles/${this.id()}/iess`));

  protected readonly confirmandoEliminar = signal(false);

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
      beneficios: suma((x) => x.beneficiosMensuales),
      // En la tabla de provisiones solo cuenta lo que se acumula.
      decimoTercero: suma((x) => (x.decimoTerceroModalidad === 'acumulado' ? x.decimoTercero : 0)),
      decimoCuarto: suma((x) => (x.decimoCuartoModalidad === 'acumulado' ? x.decimoCuarto : 0)),
      vacaciones: suma((x) => x.vacaciones),
      fondos: suma((x) => (x.fondosReservaModalidad === 'acumulado' ? x.fondosReserva : 0)),
      patronal: suma((x) => x.aportePatronal),
    };
  });

  /** Qué decir en la tabla de provisiones cuando un beneficio no se provisiona. */
  protected pagado(modalidad: Modalidad): string {
    return modalidad === 'mensual' ? 'Pagado en el rol' : 'No recibe';
  }

  protected regimen(d: RolDetalle): string {
    return etiquetaRegimen(this.parametros()?.regimenes, d.regimen, d.regimenAplicado);
  }

  protected horasExtra(d: RolDetalle): number {
    return sumar([
      d.valorHorasSuplementarias, d.valorHorasExtraordinarias, d.valorHorasDescanso, d.valorRecargoNocturno,
    ]);
  }

  protected ir(evento: Event, id: string) {
    evento.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected imprimir() {
    window.print();
  }

  protected async eliminar(r: RolCompleto) {
    try {
      await firstValueFrom(this.api.eliminarRol(r.id));
      this.avisos.exito('Rol eliminado.');
      await this.router.navigateByUrl('/sistema/roles');
    } catch (error) {
      this.avisos.errorHttp(error);
    }
  }
}
