import { httpResource } from '@angular/common/http';
import { PercentPipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { Api, ParametrosLey, valorSeguro } from '../../core/api';
import type { NovedadEnviada } from '../../core/api';
import { Avisos } from '../../core/avisos';
import { DineroPipe } from '../../core/dinero.pipe';
import type { Periodo } from '../../core/modelos';
import { etiquetaRegimen } from '../../core/regimen';

type Campo = Exclude<keyof NovedadEnviada, 'empleadoId'>;

interface Fila extends NovedadEnviada {
  nombres: string;
  cargo: string;
  sueldoBase: number;
  regimen: string;
  regimenAplicado: string;
}

const COLUMNAS: { campo: Campo; etiqueta: string; corte?: boolean }[] = [
  { campo: 'horasSuplementarias', etiqueta: 'Horas suplementarias', corte: true },
  { campo: 'horasExtraordinarias', etiqueta: 'Horas extraordinarias' },
  { campo: 'horasDescanso', etiqueta: 'Horas en sábado, domingo o feriado' },
  { campo: 'horasNocturnas', etiqueta: 'Horas nocturnas' },
  { campo: 'comisiones', etiqueta: 'Comisiones y bonos' },
  { campo: 'otrosDescuentos', etiqueta: 'Anticipos y otros descuentos', corte: true },
];

/** Grilla para digitar horas extras, comisiones y anticipos antes de generar el rol. */
@Component({
  selector: 'app-novedades-mes',
  imports: [RouterLink, DineroPipe, PercentPipe],
  template: `
    <div class="encabezado">
      <div>
        <h1>Novedades de {{ nombreMes() }} {{ anio() }}</h1>
        <p class="apoyo">Todo es opcional. Lo que dejes en blanco cuenta como cero.</p>
      </div>
    </div>

    @if (datos(); as p) {
      @if (p.existe) {
        <div class="aviso aviso-warning" role="status">
          Este mes ya tiene un rol generado. Al continuar, se <strong>reemplazará</strong> con los valores de esta pantalla.
        </div>
      }

      @if (!filas().length) {
        <div class="hoja">
          <div class="hoja-cuerpo">
            <p>No hay empleados activos para este período.</p>
            <a class="boton" routerLink="/sistema/empleados">Ir a empleados</a>
          </div>
        </div>
      } @else {
        <form (submit)="$event.preventDefault(); generar()">
          <div class="hoja">
            <div class="deslizable">
              <table class="tabla planilla">
                <thead>
                  <tr>
                    <th rowspan="2">Empleado</th>
                    <th rowspan="2" class="num">Sueldo base</th>
                    <th colspan="5" class="g-ingresos t-ingresos corte">Suma al ingreso</th>
                    <th class="g-descuentos t-descuentos corte">Se descuenta</th>
                  </tr>
                  <tr>
                    <th class="num corte">Horas suplementarias</th>
                    <th class="num">Horas extraordinarias</th>
                    <th class="num">Sábado, domingo o feriado</th>
                    <th class="num">Horas nocturnas</th>
                    <th class="num">Comisiones y bonos ($)</th>
                    <th class="num corte">Anticipos y otros ($)</th>
                  </tr>
                </thead>
                <tbody>
                  @for (f of filas(); track f.empleadoId; let i = $index) {
                    <tr>
                      <td>
                        {{ f.nombres }}
                        <span class="secundario">{{ f.cargo }} · {{ regimen(f) }}</span>
                      </td>
                      <td class="num">{{ f.sueldoBase | dinero }}</td>
                      @for (c of columnas; track c.campo) {
                        <td [class.corte]="c.corte">
                          <input class="entrada entrada-compacta num" type="number" step="0.01" min="0"
                                 inputmode="decimal" placeholder="0"
                                 [value]="f[c.campo]"
                                 (input)="cambiar(i, c.campo, $any($event.target).value)"
                                 [attr.aria-label]="c.etiqueta + ' de ' + f.nombres" />
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>

          <div class="acciones" style="margin-top: 1.25rem">
            <button class="boton" [disabled]="generando()">
              Generar rol de {{ filas().length }} empleados
            </button>
            <a class="boton boton-claro" routerLink="/sistema/roles">Cancelar</a>
          </div>
        </form>

        <div class="hoja" style="margin-top: 1.5rem">
          <div class="hoja-cuerpo pequeno apoyo">
            <p>
              <strong>Cómo se valoran las horas.</strong> El valor de una hora es el sueldo base dividido para 240,
              más el recargo del régimen del empleado. Las suplementarias son las que siguen a la jornada hasta las
              24h00; las extraordinarias van de 24h00 a 06h00 en días hábiles; las de sábado, domingo y feriado tienen
              su propio recargo. En las nocturnas solo se suma el recargo, porque la hora ya está dentro del sueldo.
            </p>
            <ul class="sin-vinetas">
              @for (r of reglasPropias(); track r.codigo) {
                <li>
                  <strong>{{ r.nombre }}:</strong>
                  suplementarias {{ r.recargoSuplementarias | percent: '1.0-0' }},
                  extraordinarias {{ r.recargoExtraordinarias | percent: '1.0-0' }},
                  sábado, domingo y feriado {{ r.recargoDescanso | percent: '1.0-0' }},
                  nocturnas {{ r.recargoNocturno | percent: '1.0-0' }}
                  @if (r.topeSuplementariasMes !== null) { (tope de {{ r.topeSuplementariasMes }} suplementarias al mes) }.
                </li>
              }
            </ul>
            <p style="margin: 0">Quien ingresó durante el mes cobra solo los días trabajados.</p>
          </div>
        </div>
      }
    } @else if (periodo.error()) {
      <div class="aviso aviso-danger" role="status">
        No se pudo cargar el período. Revisa que el servidor esté encendido y que el mes y el año sean válidos.
      </div>
    } @else {
      <p class="apoyo">Cargando empleados…</p>
    }
  `,
})
export class NovedadesMes {
  /** Vienen de la ruta: /sistema/roles/novedades/:anio/:mes */
  readonly anio = input.required<string>();
  readonly mes = input.required<string>();

  private readonly api = inject(Api);
  private readonly avisos = inject(Avisos);
  private readonly router = inject(Router);
  private readonly parametros = inject(ParametrosLey).valor;

  protected readonly columnas = COLUMNAS;
  protected readonly filas = signal<Fila[]>([]);
  protected readonly generando = signal(false);
  protected readonly nombreMes = computed(() => this.parametros()?.meses[Number(this.mes()) - 1] ?? '');
  protected readonly reglasPropias = computed(
    () => this.parametros()?.regimenes.filter((r) => r.tipo === 'reglas') ?? [],
  );

  protected readonly periodo = httpResource<Periodo>(
    () => `/api/roles/periodo/${this.anio()}/${this.mes()}`,
  );
  protected readonly datos = valorSeguro(this.periodo);

  constructor() {
    // Cuando llegan los empleados, se prepara la grilla con lo que ya estaba digitado.
    effect(() => {
      const p = this.datos();
      if (!p) return;
      const texto = (n: number) => (n ? String(n) : '');
      this.filas.set(
        p.empleados.map((e) => ({
          empleadoId: e.id,
          nombres: e.nombres,
          cargo: e.cargo,
          sueldoBase: e.sueldoBase,
          regimen: e.regimen,
          regimenAplicado: e.regimenAplicado,
          horasSuplementarias: texto(e.novedades.horasSuplementarias),
          horasExtraordinarias: texto(e.novedades.horasExtraordinarias),
          horasDescanso: texto(e.novedades.horasDescanso),
          horasNocturnas: texto(e.novedades.horasNocturnas),
          comisiones: texto(e.novedades.comisiones),
          otrosDescuentos: texto(e.novedades.otrosDescuentos),
        })),
      );
    });
  }

  protected regimen(f: Fila): string {
    return etiquetaRegimen(this.parametros()?.regimenes, f.regimen, f.regimenAplicado);
  }

  protected cambiar(indice: number, campo: Campo, valor: string) {
    this.filas.update((filas) => filas.map((f, i) => (i === indice ? { ...f, [campo]: valor } : f)));
  }

  protected async generar() {
    this.avisos.limpiar();
    this.generando.set(true);
    try {
      const novedades: NovedadEnviada[] = this.filas().map(
        ({
          empleadoId, horasSuplementarias, horasExtraordinarias, horasDescanso, horasNocturnas,
          comisiones, otrosDescuentos,
        }) => ({
          empleadoId, horasSuplementarias, horasExtraordinarias, horasDescanso, horasNocturnas,
          comisiones, otrosDescuentos,
        }),
      );
      const r = await firstValueFrom(
        this.api.generarRol(Number(this.anio()), Number(this.mes()), novedades),
      );
      this.avisos.exito(`Rol de ${this.nombreMes()} ${this.anio()} generado para ${r.empleados} empleados.`);
      r.avisos?.forEach((a) => this.avisos.aviso(a));
      await this.router.navigate(['/sistema/roles', r.id]);
    } catch (error) {
      this.avisos.errorHttp(error);
      window.scrollTo({ top: 0 });
    } finally {
      this.generando.set(false);
    }
  }
}
