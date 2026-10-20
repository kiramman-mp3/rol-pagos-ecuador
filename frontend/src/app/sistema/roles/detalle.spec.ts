import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { DetalleRol } from './detalle';

const BASE = {
  empleadoId: 1, cedula: '1801234566', cargo: 'Analista', sueldoBase: 1800, fechaIngreso: '2022-07-15',
  regimen: 'CODIGO_TRABAJO', regimenAplicado: 'CODIGO_TRABAJO', tasaIessPersonal: 0.0945, tasaIessPatronal: 0.1115,
  diasTrabajados: 30, mesesServicio: 50, valorHora: 7.5, sueldo: 1800,
  horasSuplementarias: 0, horasExtraordinarias: 0, horasDescanso: 0, horasNocturnas: 0,
  valorHorasSuplementarias: 0, valorHorasExtraordinarias: 0, valorHorasDescanso: 0, valorRecargoNocturno: 0,
  comisiones: 0, ingresosAportables: 1800, beneficiosMensuales: 340.11, totalIngresos: 2140.11,
  aporteIess: 170.1, baseIrAnual: 19560, irAnual: 0, impuestoRenta: 0, otrosDescuentos: 0, totalDescuentos: 170.1,
  netoPagar: 1970.01, decimoTercero: 150, decimoTerceroModalidad: 'mensual', decimoCuarto: 40.17,
  decimoCuartoModalidad: 'mensual', fondosReserva: 149.94, fondosReservaModalidad: 'mensual', vacaciones: 75,
  aportePatronal: 200.7, totalProvisiones: 275.7, costoEmpleador: 2415.81,
};

const ROL = {
  id: 1, anio: 2026, mes: 10, generadoEn: '2026-10-20T10:00:00', numEmpleados: 2,
  totalIngresos: 4140.11, totalDescuentos: 400, totalNeto: 3740.11, totalProvisiones: 700, totalCosto: 4840.11,
  detalle: [
    { ...BASE, id: 1, nombres: 'Ana Mensual' },
    {
      ...BASE, id: 2, nombres: 'Beto Acumula', decimoTerceroModalidad: 'acumulado', decimoCuartoModalidad: 'no',
      decimoCuarto: 0, fondosReservaModalidad: 'acumulado', beneficiosMensuales: 0, totalIngresos: 1800,
    },
  ],
};

const PARAMETROS = {
  sbu: 482, meses: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
  empresa: { nombre: 'Empresa Demo S.A.', ruc: '1790000000001' },
  regimenes: [{ codigo: 'CODIGO_TRABAJO', nombre: 'Código del Trabajo' }],
};

describe('DetalleRol', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  const abrir = async () => {
    const fixture = TestBed.createComponent(DetalleRol);
    fixture.componentRef.setInput('id', '1');
    fixture.detectChanges();
    TestBed.tick();
    http.expectOne('/api/parametros').flush(PARAMETROS);
    http.expectOne('/api/roles/1').flush(ROL);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  const filas = (el: HTMLElement) => [...el.querySelectorAll('section')].map((s) => [...s.querySelectorAll('tbody tr')]);

  it('suma los décimos y fondos pagados en el rol a los ingresos', async () => {
    const el = await abrir();
    expect(el.textContent).toContain('Décimos y fondos');
    const [ingresos] = filas(el);
    expect(ingresos[0].textContent).toContain('$340.11'); // lo que se paga en el rol
    expect(ingresos[0].textContent).toContain('$2,140.11');
    expect(ingresos[1].textContent).toContain('$0.00');
  });

  it('en provisiones solo muestra valor para lo que se acumula', async () => {
    const el = await abrir();
    const [, provisiones] = filas(el);
    const mensual = provisiones[0].textContent ?? '';
    expect(mensual).toContain('Pagado en el rol');
    expect(mensual).not.toContain('$150.00');

    const acumula = provisiones[1].textContent ?? '';
    expect(acumula).toContain('$150.00'); // décimo tercero acumulado
    expect(acumula).toContain('No recibe'); // décimo cuarto
    expect(acumula).toContain('$149.94'); // fondos de reserva acumulados
  });

  it('muestra el régimen y la tasa real del IESS de cada empleado', async () => {
    const el = await abrir();
    expect(el.textContent).toContain('Código del Trabajo');
    expect(el.textContent).toContain('9.45%');
    expect(el.textContent).toContain('11.15%');
  });
});
