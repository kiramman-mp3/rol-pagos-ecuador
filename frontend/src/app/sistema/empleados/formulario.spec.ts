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

const GRADOS = [
  { id: 11, regimen: 'LOSEP', grado: 5, denominacion: 'Servidor Público de Apoyo 3', rmu: 675, fuente: '' },
  { id: 12, regimen: 'LOSEP', grado: 7, denominacion: 'Servidor Público 1', rmu: 817, fuente: '' },
];
const GRADO_CODIGO = { id: 13, regimen: 'CODIGO_TRABAJO', grado: 1, denominacion: 'Operario', rmu: 500, fuente: '' };

describe('FormularioEmpleado', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  const abrir = async (grados = GRADOS) => {
    const fixture = TestBed.createComponent(FormularioEmpleado);
    fixture.detectChanges();
    TestBed.tick();
    http.expectOne('/api/parametros').flush({
      ...PARAMETROS,
      regimenes: [
        ...PARAMETROS.regimenes.slice(0, 2),
        { ...PARAMETROS.regimenes[2], regimenServidor: 'LOSEP', regimenObrero: 'CODIGO_TRABAJO' },
      ],
    });
    http.expectOne('/api/escala').flush(grados);
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
    escribir(el, 'escalaId', '11', 'change');
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

  it('ofrece solo los grados de la escala del régimen elegido', async () => {
    const { fixture, el } = await abrir([...GRADOS, GRADO_CODIGO]);
    expect(el.querySelector('#escalaId option[value="13"]')).not.toBeNull(); // Código del Trabajo
    expect(el.querySelector('#escalaId option[value="11"]')).toBeNull();

    escribir(el, 'regimen', 'LOSEP', 'change');
    fixture.detectChanges();
    const opciones = [...el.querySelectorAll('#escalaId option')].map((o) => o.textContent?.trim());
    expect(opciones.some((t) => t?.includes('Grado 5'))).toBe(true);
    expect(opciones.some((t) => t?.includes('Operario'))).toBe(false);
  });

  it('elegir un grado propone el sueldo y el cargo, y se envía el grado', async () => {
    const { fixture, el } = await abrir();
    escribir(el, 'cedula', '1801234566');
    escribir(el, 'nombres', 'Ana Prueba');
    escribir(el, 'fechaIngreso', '2024-01-10');
    escribir(el, 'regimen', 'LOSEP', 'change');
    fixture.detectChanges();

    escribir(el, 'escalaId', '11', 'change');
    fixture.detectChanges();
    expect(el.querySelector<HTMLInputElement>('#sueldoBase')!.value).toBe('675');
    expect(el.querySelector<HTMLInputElement>('#cargo')!.value).toBe('Servidor Público de Apoyo 3');

    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    const envio = http.expectOne('/api/empleados');
    expect(envio.request.body.escalaId).toBe(11);
    expect(envio.request.body.sueldoBase).toBe(675);
  });

  it('con escala, el grado es obligatorio y el sueldo no se escribe a mano', async () => {
    const { fixture, el } = await abrir();
    llenarBase(el);
    escribir(el, 'regimen', 'LOSEP', 'change');
    fixture.detectChanges();
    expect(el.querySelector<HTMLInputElement>('#sueldoBase')!.readOnly).toBe(true);

    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    http.expectNone('/api/empleados'); // falta el grado

    escribir(el, 'escalaId', '12', 'change');
    fixture.detectChanges();
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    expect(http.expectOne('/api/empleados').request.body.sueldoBase).toBe(817);
  });

  it('sin escala en el régimen, el sueldo se escribe a mano', async () => {
    const { el } = await abrir();
    expect(el.querySelector('#escalaId')).toBeNull();
    expect(el.querySelector<HTMLInputElement>('#sueldoBase')!.readOnly).toBe(false);
  });

  it('un cargo ya escrito no se pisa al elegir el grado', async () => {
    const { fixture, el } = await abrir();
    escribir(el, 'regimen', 'LOSEP', 'change');
    escribir(el, 'cargo', 'Asistente');
    fixture.detectChanges();
    escribir(el, 'escalaId', '12', 'change');
    fixture.detectChanges();
    expect(el.querySelector<HTMLInputElement>('#cargo')!.value).toBe('Asistente');
    expect(el.querySelector<HTMLInputElement>('#sueldoBase')!.value).toBe('817');
  });

  it('si cambia el régimen, el grado que ya no corresponde se quita', async () => {
    const { fixture, el } = await abrir();
    escribir(el, 'regimen', 'LOSEP', 'change');
    fixture.detectChanges();
    escribir(el, 'escalaId', '11', 'change');
    fixture.detectChanges();

    escribir(el, 'regimen', 'CODIGO_TRABAJO', 'change');
    fixture.detectChanges();
    TestBed.tick();
    fixture.detectChanges();
    expect(el.querySelector('#escalaId')).toBeNull(); // el Código del Trabajo no tiene escala
    expect(el.querySelector<HTMLInputElement>('#sueldoBase')!.value).toBe('');
  });

  it('en la LOEP la escala depende de la categoría', async () => {
    const { fixture, el } = await abrir([...GRADOS, GRADO_CODIGO]);
    escribir(el, 'regimen', 'LOEP', 'change');
    fixture.detectChanges(); // aparece el selector de categoría
    escribir(el, 'categoriaLoep', 'servidor', 'change');
    fixture.detectChanges();
    expect(el.querySelector('#escalaId option[value="11"]')).not.toBeNull(); // escala de la LOSEP

    escribir(el, 'categoriaLoep', 'obrero', 'change');
    fixture.detectChanges();
    expect(el.querySelector('#escalaId option[value="13"]')).not.toBeNull(); // escala del Código
    expect(el.querySelector('#escalaId option[value="11"]')).toBeNull();
  });

  it('por defecto deja los beneficios según el régimen y envía nulos', async () => {
    const { el } = await abrir();
    llenarBase(el);
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    const cuerpo = http.expectOne('/api/empleados').request.body;
    expect(cuerpo.pagoDecimoTercero).toBeNull();
    expect(cuerpo.pagoDecimoCuarto).toBeNull();
    expect(cuerpo.pagoFondosReserva).toBeNull();
    expect(cuerpo.recibeHorasExtras).toBeNull();
  });

  it('envía la modalidad de cada beneficio y si recibe horas extras', async () => {
    const { el } = await abrir();
    llenarBase(el);
    escribir(el, 'pagoDecimoTercero', 'acumulado', 'change');
    escribir(el, 'pagoDecimoCuarto', 'no', 'change');
    escribir(el, 'pagoFondosReserva', 'mensual', 'change');
    escribir(el, 'recibeHorasExtras', 'no', 'change');
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    const cuerpo = http.expectOne('/api/empleados').request.body;
    expect(cuerpo.pagoDecimoTercero).toBe('acumulado');
    expect(cuerpo.pagoDecimoCuarto).toBe('no');
    expect(cuerpo.pagoFondosReserva).toBe('mensual');
    expect(cuerpo.recibeHorasExtras).toBe(false);
  });
});
