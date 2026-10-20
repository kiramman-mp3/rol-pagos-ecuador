import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { routes } from '../app.routes';
import { Landing } from './landing';

const PARAMETROS = {
  anio: 2026, sbu: 482, iessPersonal: 0.0945, iessPatronal: 0.1115, fondosReserva: 0.0833,
  fraccionExentaIr: 12208,
  tablaIr: [{ desde: 0, hasta: 12208, cuota: 0, porcentaje: 0 }, { desde: 109956, hasta: null, cuota: 24572, porcentaje: 0.37 }],
  empresa: { nombre: 'Empresa Demo S.A.', ruc: '1790000000001' }, meses: [], contratos: [],
  categoriasLoep: ['servidor', 'obrero'],
  regimenes: [
    { codigo: 'CODIGO_TRABAJO', nombre: 'Código del Trabajo', tipo: 'reglas', iessPersonal: 0.0945, iessPatronal: 0.1115,
      recargoSuplementarias: 0.5, recargoExtraordinarias: 1, recargoDescanso: 1, recargoNocturno: 0.25,
      diasVacaciones: 15, fondosReserva: 0.0833, verificado: true },
    { codigo: 'LOSEP', nombre: 'LOSEP (servidores públicos)', tipo: 'reglas', iessPersonal: 0.1145, iessPatronal: 0.0915,
      recargoSuplementarias: 0.25, recargoExtraordinarias: 0.6, recargoDescanso: 1, recargoNocturno: 0.25,
      diasVacaciones: 30, fondosReserva: 0.0833, verificado: false },
    { codigo: 'LOEP', nombre: 'LOEP (empresas públicas)', tipo: 'mixto', verificado: true },
  ],
};

const SIMULACION = {
  totalIngresos: 2000, totalDescuentos: 257.02, netoPagar: 1742.98, aporteIess: 189,
  impuestoRenta: 68.02, costoEmpleador: 2589.77, beneficiosMensuales: 373.44,
  regimenAplicado: 'Código del Trabajo', tasaIessPersonal: 0.0945, tasaIessPatronal: 0.1115,
};

describe('Landing', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => vi.useRealTimers());

  const crear = () => {
    const fixture = TestBed.createComponent(Landing);
    fixture.detectChanges();
    TestBed.tick(); // los recursos emiten sus peticiones al correr los efectos
    return fixture;
  };

  /** Responde lo que la landing pide al abrirse: reglas de ley y la simulación inicial. */
  const responderInicio = () => {
    http.expectOne('/api/parametros').flush(PARAMETROS);
    http.match('/api/simulacion').forEach((r) => r.flush(SIMULACION));
  };

  it('todos los botones "Ingresar al sistema" llevan a /sistema', () => {
    const el = crear().nativeElement as HTMLElement;
    const botones = [...el.querySelectorAll('a')].filter((a) =>
      a.textContent?.includes('Ingresar al sistema'),
    );
    expect(botones.length).toBe(3); // barra superior, portada y cierre
    for (const b of botones) expect(b.getAttribute('href')).toBe('/sistema');
  });

  it('muestra las reglas de ley que entrega el servidor', async () => {
    const fixture = crear();
    responderInicio();
    await fixture.whenStable();
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('9.45% del ingreso');
    expect(texto).toContain('Exento hasta $12,208.00');
    expect(texto).toContain('8.33% desde el mes 13');
  });

  it('el simulador consulta al servidor y muestra el neto', async () => {
    vi.useFakeTimers();
    const fixture = crear();
    const el = fixture.nativeElement as HTMLElement;
    responderInicio();

    const entrada = el.querySelector<HTMLInputElement>('#sim-sueldo')!;
    entrada.value = '2000';
    entrada.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(300); // espera a que termine de escribir
    TestBed.tick();

    const pedidos = http.match('/api/simulacion');
    const ultimo = pedidos[pedidos.length - 1];
    expect(ultimo.request.method).toBe('POST');
    expect(ultimo.request.body).toEqual({
      sueldo: 2000, horasSuplementarias: 0, regimen: 'CODIGO_TRABAJO', decimos: 'mensual',
    });
    ultimo.flush(SIMULACION);
    await vi.advanceTimersByTimeAsync(0);
    TestBed.tick();
    fixture.detectChanges();

    expect(el.querySelector('.mini-ecuacion')?.textContent).toContain('$1,742.98');
    expect(el.querySelector('.desglose')?.textContent).toContain('$68.02');
  });

  it('muestra las reglas de cada régimen', async () => {
    const fixture = crear();
    responderInicio();
    await fixture.whenStable();
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Ver las reglas de cada régimen laboral');
    expect(texto).toContain('LOSEP (servidores públicos)');
    expect(texto).toContain('11.45%');
    expect(texto).toContain('30 días');
  });

  it('el simulador envía el régimen elegido y pide la categoría si es LOEP', async () => {
    vi.useFakeTimers();
    const fixture = crear();
    const el = fixture.nativeElement as HTMLElement;
    responderInicio();
    await vi.advanceTimersByTimeAsync(0);
    TestBed.tick();
    fixture.detectChanges();

    const selector = el.querySelector<HTMLSelectElement>('#sim-regimen')!;
    selector.value = 'LOEP';
    selector.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(el.querySelector('#sim-categoria')).not.toBeNull();

    await vi.advanceTimersByTimeAsync(300);
    TestBed.tick();
    const pedidos = http.match('/api/simulacion');
    expect(pedidos[pedidos.length - 1].request.body).toEqual({
      sueldo: 1200, horasSuplementarias: 0, regimen: 'LOEP', categoriaLoep: 'servidor', decimos: 'mensual',
    });
  });

  it('el simulador envía si los décimos se pagan, se acumulan o no se reciben', async () => {
    vi.useFakeTimers();
    const fixture = crear();
    const el = fixture.nativeElement as HTMLElement;
    responderInicio();
    await vi.advanceTimersByTimeAsync(0);
    TestBed.tick();
    fixture.detectChanges();

    const selector = el.querySelector<HTMLSelectElement>('#sim-decimos')!;
    selector.value = 'acumulado';
    selector.dispatchEvent(new Event('change'));
    await vi.advanceTimersByTimeAsync(300);
    TestBed.tick();
    const pedidos = http.match('/api/simulacion');
    expect(pedidos[pedidos.length - 1].request.body.decimos).toBe('acumulado');
  });

  it('si el servidor no responde, la página sigue funcionando y lo explica', async () => {
    const fixture = crear();
    http.expectOne('/api/parametros').flush('error', { status: 500, statusText: 'Server Error' });
    http.match('/api/simulacion').forEach((r) => r.flush('error', { status: 500, statusText: 'Server Error' }));
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('No se pudo calcular');
    expect(el.textContent).toContain('No se pudieron cargar las reglas');
    expect(el.textContent).toContain('Ingresar al sistema');
  });

  it('no consulta al servidor si el sueldo no es válido', async () => {
    vi.useFakeTimers();
    const fixture = crear();
    const el = fixture.nativeElement as HTMLElement;
    responderInicio();

    const entrada = el.querySelector<HTMLInputElement>('#sim-sueldo')!;
    entrada.value = '0';
    entrada.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(300);
    TestBed.tick();
    fixture.detectChanges();

    expect(http.match('/api/simulacion').length).toBe(0);
    expect(el.textContent).toContain('Escribe un sueldo mayor a cero');
  });
});
