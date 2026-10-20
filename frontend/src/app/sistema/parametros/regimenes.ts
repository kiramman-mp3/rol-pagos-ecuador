import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { Api, ParametrosLey } from '../../core/api';
import { Avisos } from '../../core/avisos';
import type { Regimen } from '../../core/modelos';

/** Fracción guardada (0.0945) -> porcentaje que se escribe (9.45). */
const aPorcentaje = (fraccion: number | null): string =>
  fraccion === null ? '' : String(Number((fraccion * 100).toFixed(4)));
/**
 * Un campo numérico vacío llega como null (o ''), no como 0: si se confundiera, un tope vacío
 * («sin tope») pasaría a ser «0 horas» y un porcentaje vacío a ser 0%.
 */
const numeroONulo = (valor: unknown): number | null =>
  valor === null || valor === undefined || valor === '' ? null : Number(valor);
/** Porcentaje escrito (9.45) -> fracción que se guarda (0.0945); vacío = null. */
const aFraccion = (porcentaje: unknown): number | null => {
  const n = numeroONulo(porcentaje);
  return n === null ? null : Number((n / 100).toFixed(6));
};
const textoTope = (tope: number | null): string => (tope === null ? '' : String(tope));

/** Edita las reglas de un régimen laboral. */
@Component({
  selector: 'app-editor-regimen',
  imports: [ReactiveFormsModule],
  template: `
    <form class="formulario" [formGroup]="form" (ngSubmit)="guardar()">
      <div class="campo c6">
        <label [for]="id('nombre')">Nombre</label>
        <input class="entrada" [id]="id('nombre')" formControlName="nombre" maxlength="120" />
        <span class="ayuda">{{ regimen().baseLegal }}</span>
      </div>

      @if (regimen().tipo === 'mixto') {
        <div class="campo c3">
          <label [for]="id('servidor')">Los servidores públicos se rigen por</label>
          <select class="entrada" [id]="id('servidor')" formControlName="regimenServidor">
            @for (r of conReglas(); track r.codigo) {
              <option [value]="r.codigo">{{ r.nombre }}</option>
            }
          </select>
        </div>
        <div class="campo c3">
          <label [for]="id('obrero')">Los obreros se rigen por</label>
          <select class="entrada" [id]="id('obrero')" formControlName="regimenObrero">
            @for (r of conReglas(); track r.codigo) {
              <option [value]="r.codigo">{{ r.nombre }}</option>
            }
          </select>
        </div>
      } @else {
        @for (c of numeros; track c.control) {
          <div class="campo c2">
            <label [for]="id(c.control)">{{ c.etiqueta }}</label>
            <input class="entrada num" [id]="id(c.control)" type="number" [step]="c.paso" min="0"
                   [formControlName]="c.control" />
            @if (c.ayuda) { <span class="ayuda">{{ c.ayuda }}</span> }
          </div>
        }
        <fieldset class="campo c6 beneficios">
          <legend>Beneficios que concede este régimen</legend>
          <div class="rejilla-beneficios">
            @for (b of beneficios; track b.control) {
              <label class="casilla">
                <input type="checkbox" [formControlName]="b.control" /> {{ b.etiqueta }}
              </label>
            }
          </div>
          <p class="ayuda" style="margin: .5rem 0 0">
            Si lo concede, se paga cada mes en el rol salvo que el empleado lo acumule. Cada empleado puede cambiarlo.
          </p>
        </fieldset>
      }

      <div class="campo c6">
        <label [for]="id('notas')">Notas</label>
        <textarea class="entrada" [id]="id('notas')" rows="3" maxlength="1000" formControlName="notas"></textarea>
      </div>
      <label class="casilla c6">
        <input type="checkbox" formControlName="verificado" />
        Los valores están confirmados con la norma o el IESS
      </label>

      <div class="acciones">
        <button class="boton" [disabled]="guardando()">Guardar {{ regimen().nombre }}</button>
      </div>
    </form>
  `,
})
export class EditorRegimen {
  readonly regimen = input.required<Regimen>();
  readonly todos = input.required<Regimen[]>();
  readonly guardado = output<void>();

  private readonly api = inject(Api);
  private readonly avisos = inject(Avisos);

  protected readonly guardando = signal(false);
  protected readonly conReglas = computed(() => this.todos().filter((r) => r.tipo === 'reglas'));

  protected readonly numeros = [
    { control: 'iessPersonal', etiqueta: 'Aporte personal al IESS (%)', paso: '0.01', ayuda: '' },
    { control: 'iessPatronal', etiqueta: 'Aporte patronal al IESS (%)', paso: '0.01', ayuda: '' },
    { control: 'fondosReserva', etiqueta: 'Fondos de reserva (%)', paso: '0.01', ayuda: 'Del ingreso aportable.' },
    { control: 'mesesParaFondos', etiqueta: 'Meses de servicio para fondos de reserva', paso: '1', ayuda: '' },
    { control: 'recargoSuplementarias', etiqueta: 'Recargo de horas suplementarias (%)', paso: '1', ayuda: 'Después de la jornada, hasta las 24h00.' },
    { control: 'recargoExtraordinarias', etiqueta: 'Recargo de horas extraordinarias (%)', paso: '1', ayuda: 'De 24h00 a 06h00 en días hábiles.' },
    { control: 'recargoDescanso', etiqueta: 'Recargo de sábado, domingo y feriado (%)', paso: '1', ayuda: '' },
    { control: 'recargoNocturno', etiqueta: 'Recargo nocturno (%)', paso: '1', ayuda: 'Solo el recargo: la hora ya está en el sueldo.' },
    { control: 'topeSuplementariasMes', etiqueta: 'Tope mensual de suplementarias (horas)', paso: '1', ayuda: 'Vacío = sin tope. Pasarlo solo genera un aviso.' },
    { control: 'topeExtraordinariasMes', etiqueta: 'Tope mensual de extraordinarias (horas)', paso: '1', ayuda: 'Vacío = sin tope.' },
    { control: 'diasVacaciones', etiqueta: 'Días de vacaciones al año', paso: '1', ayuda: 'La provisión es días ÷ 360 del ingreso.' },
  ] as const;

  protected readonly beneficios = [
    { control: 'aplicaDecimoTercero', etiqueta: 'Décimo tercero' },
    { control: 'aplicaDecimoCuarto', etiqueta: 'Décimo cuarto' },
    { control: 'aplicaFondosReserva', etiqueta: 'Fondos de reserva' },
    { control: 'aplicaHorasExtras', etiqueta: 'Horas extras' },
  ] as const;

  protected readonly form = inject(FormBuilder).nonNullable.group({
    nombre: [''],
    regimenServidor: [''],
    regimenObrero: [''],
    iessPersonal: [''],
    iessPatronal: [''],
    fondosReserva: [''],
    mesesParaFondos: [''],
    recargoSuplementarias: [''],
    recargoExtraordinarias: [''],
    recargoDescanso: [''],
    recargoNocturno: [''],
    topeSuplementariasMes: [''],
    topeExtraordinariasMes: [''],
    diasVacaciones: [''],
    aplicaDecimoTercero: [true],
    aplicaDecimoCuarto: [true],
    aplicaFondosReserva: [true],
    aplicaHorasExtras: [true],
    verificado: [false],
    notas: [''],
  });

  constructor() {
    effect(() => {
      const r = this.regimen();
      this.form.reset({
        nombre: r.nombre,
        regimenServidor: r.regimenServidor ?? '',
        regimenObrero: r.regimenObrero ?? '',
        iessPersonal: aPorcentaje(r.iessPersonal),
        iessPatronal: aPorcentaje(r.iessPatronal),
        fondosReserva: aPorcentaje(r.fondosReserva),
        mesesParaFondos: textoTope(r.mesesParaFondos),
        recargoSuplementarias: aPorcentaje(r.recargoSuplementarias),
        recargoExtraordinarias: aPorcentaje(r.recargoExtraordinarias),
        recargoDescanso: aPorcentaje(r.recargoDescanso),
        recargoNocturno: aPorcentaje(r.recargoNocturno),
        topeSuplementariasMes: textoTope(r.topeSuplementariasMes),
        topeExtraordinariasMes: textoTope(r.topeExtraordinariasMes),
        diasVacaciones: textoTope(r.diasVacaciones),
        aplicaDecimoTercero: r.aplicaDecimoTercero,
        aplicaDecimoCuarto: r.aplicaDecimoCuarto,
        aplicaFondosReserva: r.aplicaFondosReserva,
        aplicaHorasExtras: r.aplicaHorasExtras,
        verificado: r.verificado,
        notas: r.notas,
      });
    });
  }

  protected id(campo: string): string {
    return `${this.regimen().codigo}-${campo}`;
  }

  protected async guardar() {
    this.avisos.limpiar();
    const v = this.form.getRawValue();
    const cuerpo: Record<string, unknown> = {
      nombre: v.nombre, verificado: v.verificado, notas: v.notas,
    };
    if (this.regimen().tipo === 'mixto') {
      cuerpo['regimenServidor'] = v.regimenServidor;
      cuerpo['regimenObrero'] = v.regimenObrero;
    } else {
      Object.assign(cuerpo, {
        iessPersonal: aFraccion(v.iessPersonal),
        iessPatronal: aFraccion(v.iessPatronal),
        fondosReserva: aFraccion(v.fondosReserva),
        mesesParaFondos: numeroONulo(v.mesesParaFondos),
        recargoSuplementarias: aFraccion(v.recargoSuplementarias),
        recargoExtraordinarias: aFraccion(v.recargoExtraordinarias),
        recargoDescanso: aFraccion(v.recargoDescanso),
        recargoNocturno: aFraccion(v.recargoNocturno),
        topeSuplementariasMes: numeroONulo(v.topeSuplementariasMes),
        topeExtraordinariasMes: numeroONulo(v.topeExtraordinariasMes),
        diasVacaciones: numeroONulo(v.diasVacaciones),
        aplicaDecimoTercero: v.aplicaDecimoTercero,
        aplicaDecimoCuarto: v.aplicaDecimoCuarto,
        aplicaFondosReserva: v.aplicaFondosReserva,
        aplicaHorasExtras: v.aplicaHorasExtras,
      });
    }
    this.guardando.set(true);
    try {
      await firstValueFrom(this.api.guardarRegimen(this.regimen().codigo, cuerpo));
      this.avisos.exito(`Se guardaron las reglas de ${v.nombre}.`);
      this.guardado.emit();
    } catch (error) {
      this.avisos.errorHttp(error);
      window.scrollTo({ top: 0 });
    } finally {
      this.guardando.set(false);
    }
  }
}

/** Lista de regímenes con el editor de cada uno. */
@Component({
  selector: 'app-regimenes-laborales',
  imports: [EditorRegimen],
  template: `
    <p class="apoyo">
      Cada empleado se rige por un régimen. Los marcados «por confirmar» tienen valores que salen de fuentes
      secundarias: revísalos con la norma antes de usar el sistema en una nómina real.
    </p>
    @for (r of regimenes(); track r.codigo) {
      <details class="hoja regimen" [open]="r.codigo === 'CODIGO_TRABAJO'">
        <summary>
          <strong>{{ r.nombre }}</strong>
          <span class="estado" [class.estado-activo]="r.verificado" [class.estado-inactivo]="!r.verificado">
            {{ r.verificado ? 'Confirmado' : 'Por confirmar' }}
          </span>
          <span class="apoyo pequeno">{{ r.descripcion }}</span>
        </summary>
        <div class="hoja-cuerpo">
          <app-editor-regimen [regimen]="r" [todos]="regimenes()" (guardado)="recargar()" />
        </div>
      </details>
    } @empty {
      <p class="apoyo">Cargando regímenes…</p>
    }
  `,
})
export class RegimenesLaborales {
  private readonly general = inject(ParametrosLey);
  protected readonly regimenes = computed(() => this.general.valor()?.regimenes ?? []);

  protected recargar() {
    this.general.recurso.reload();
  }
}
