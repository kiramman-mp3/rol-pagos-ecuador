import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { FormularioEmpleado } from './formulario';

const PARAMETROS = {
  anio: 2026, sbu: 482, contratos: ['Indefinido', 'Plazo fijo'], categoriasLoep: ['servidor', 'obrero'],
  regimenes: [
    { codigo: 'CODIGO_TRABAJO', nombre: 'Código del Trabajo', descripcion: 'Sector privado.', tipo: 'reglas', verificado: true },
    { codigo: 'LOSEP', nombre: 'LOSEP', descripcion: 'Servidores públicos.', tipo: 'reglas', verificado: false },
    { codigo: 'LOEP', nombre: 'LOEP', descripcion: 'Empresas públicas.', tipo: 'mixto', verificado: true },
  ],
};

describe('FormularioEmpleado', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  const abrir = async () => {
    const fixture = TestBed.createComponent(FormularioEmpleado);
    fixture.detectChanges();
    TestBed.tick();
    http.expectOne('/api/parametros').flush(PARAMETROS);
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  };

  const escribir = (el: HTMLElement, id: string, valor: string, evento = 'input') => {
    const campo = el.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)!;
    campo.value = valor;
    campo.dispatchEvent(new Event(evento));
  };

  const llenarBase = (el: HTMLElement) => {
    escribir(el, 'cedula', '1801234566');
    escribir(el, 'nombres', 'Ana Prueba');
    escribir(el, 'cargo', 'Analista');
    escribir(el, 'sueldoBase', '1000');
    escribir(el, 'fechaIngreso', '2024-01-10');
  };

  it('ofrece los regímenes del servidor y avisa si alguno está por confirmar', async () => {
    const { fixture, el } = await abrir();
    const opciones = [...el.querySelectorAll('#regimen option')].map((o) => o.textContent?.trim());
    expect(opciones).toEqual(['Código del Trabajo', 'LOSEP', 'LOEP']);
    expect(el.textContent).not.toContain('por confirmar');

    escribir(el, 'regimen', 'LOSEP', 'change');
    fixture.detectChanges();
    expect(el.textContent).toContain('Servidores públicos.');
    expect(el.textContent).toContain('por confirmar');
  });

  it('la categoría solo aparece para la LOEP', async () => {
    const { fixture, el } = await abrir();
    expect(el.querySelector('#categoriaLoep')).toBeNull();

    escribir(el, 'regimen', 'LOEP', 'change');
    fixture.detectChanges();
    expect(el.querySelector('#categoriaLoep')).not.toBeNull();

    escribir(el, 'regimen', 'LOSEP', 'change');
    fixture.detectChanges();
    expect(el.querySelector('#categoriaLoep')).toBeNull();
  });

  it('envía el régimen y deja la categoría en nulo cuando no es LOEP', async () => {
    const { fixture, el } = await abrir();
    llenarBase(el);
    escribir(el, 'regimen', 'LOSEP', 'change');
    fixture.detectChanges();

    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    const envio = http.expectOne('/api/empleados');
    expect(envio.request.method).toBe('POST');
    expect(envio.request.body.regimen).toBe('LOSEP');
    expect(envio.request.body.categoriaLoep).toBeNull();
  });

  it('con LOEP exige la categoría y la envía cuando se elige', async () => {
    const { fixture, el } = await abrir();
    llenarBase(el);
    escribir(el, 'regimen', 'LOEP', 'change');
    fixture.detectChanges();

    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    http.expectNone('/api/empleados'); // falta la categoría

    escribir(el, 'categoriaLoep', 'obrero', 'change');
    fixture.detectChanges();
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    const envio = http.expectOne('/api/empleados');
    expect(envio.request.body.regimen).toBe('LOEP');
    expect(envio.request.body.categoriaLoep).toBe('obrero');
  });
});
