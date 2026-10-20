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
};

const SIMULACION = {
  totalIngresos: 2000, totalDescuentos: 257.02, netoPagar: 1742.98, aporteIess: 189,
  impuestoRenta: 68.02, costoEmpleador: 2589.77,
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
    expect(ultimo.request.body).toEqual({ sueldo: 2000, horasSuplementarias: 0 });
    ultimo.flush(SIMULACION);
    await vi.advanceTimersByTimeAsync(0);
    TestBed.tick();
    fixture.detectChanges();

    expect(el.querySelector('.mini-ecuacion')?.textContent).toContain('$1,742.98');
    expect(el.querySelector('.desglose')?.textContent).toContain('$68.02');
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
