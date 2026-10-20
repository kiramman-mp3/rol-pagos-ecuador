import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { NovedadesMes } from './novedades';

@Component({ template: '' })
class Vacio {}

const SIN_NOVEDADES = { horasSuplementarias: 0, horasExtraordinarias: 0, horasDescanso: 0, horasNocturnas: 0, comisiones: 0, otrosDescuentos: 0 };
const PERIODO = {
  anio: 2026, mes: 10, existe: true,
  empleados: [{
    id: 1, nombres: 'Ana Prueba', cargo: 'Analista', sueldoBase: 1000,
    regimen: 'CODIGO_TRABAJO', regimenAplicado: 'CODIGO_TRABAJO', novedades: SIN_NOVEDADES,
  }],
};

describe('NovedadesMes', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'sistema/roles/:id', component: Vacio }]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  it('avisa que reemplazará el rol, envía lo digitado y abre el rol generado', async () => {
    const fixture = TestBed.createComponent(NovedadesMes);
    fixture.componentRef.setInput('anio', '2026');
    fixture.componentRef.setInput('mes', '10');
    fixture.detectChanges();
    TestBed.tick();

    http.expectOne('/api/parametros').flush({ regimenes: [], meses: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'] });
    http.expectOne('/api/roles/periodo/2026/10').flush(PERIODO);
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Novedades de Octubre 2026');
    expect(el.textContent).toContain('reemplazará');

    const comision = el.querySelector<HTMLInputElement>('input[aria-label="Comisiones y bonos de Ana Prueba"]')!;
    comision.value = '200';
    comision.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    const envio = http.expectOne('/api/roles/generar');
    expect(envio.request.body).toEqual({
      anio: 2026, mes: 10,
      novedades: [{ empleadoId: 1, horasSuplementarias: '', horasExtraordinarias: '', horasDescanso: '', horasNocturnas: '', comisiones: '200', otrosDescuentos: '' }],
    });
    envio.flush({ id: 7, empleados: 1 });
    await new Promise((resolver) => setTimeout(resolver));

    expect(TestBed.inject(Router).url).toBe('/sistema/roles/7');
  });

  it('si el servidor rechaza una novedad, no navega y muestra el motivo', async () => {
    const fixture = TestBed.createComponent(NovedadesMes);
    fixture.componentRef.setInput('anio', '2026');
    fixture.componentRef.setInput('mes', '10');
    fixture.detectChanges();
    TestBed.tick();
    http.expectOne('/api/parametros').flush({ regimenes: [], meses: [] });
    http.expectOne('/api/roles/periodo/2026/10').flush({ ...PERIODO, existe: false });
    await fixture.whenStable();
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement).querySelector('form')!.dispatchEvent(new Event('submit'));
    http.expectOne('/api/roles/generar').flush(
      { errores: ['Ana Prueba: horas inválidas.'] },
      { status: 400, statusText: 'Bad Request' },
    );
    await new Promise((resolver) => setTimeout(resolver));

    expect(TestBed.inject(Router).url).toBe('/');
  });
});
