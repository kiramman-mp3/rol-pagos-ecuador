import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ParametrosAnuales } from './anuales';
import { EscalaSalarial } from './escala';
import { PaginaParametros } from './parametros';
import { RegimenesLaborales } from './regimenes';

const CT = {
  codigo: 'CODIGO_TRABAJO', nombre: 'Código del Trabajo', descripcion: 'Sector privado.', baseLegal: 'Código del Trabajo',
  tipo: 'reglas', regimenServidor: null, regimenObrero: null, iessPersonal: 0.0945, iessPatronal: 0.1115,
  recargoSuplementarias: 0.5, recargoExtraordinarias: 1, recargoDescanso: 1, recargoNocturno: 0.25,
  topeSuplementariasMes: 48, topeExtraordinariasMes: null, diasVacaciones: 15, fondosReserva: 0.0833, mesesParaFondos: 12,
  aplicaDecimoTercero: true, aplicaDecimoCuarto: true, aplicaFondosReserva: true, aplicaHorasExtras: true,
  verificado: true, notas: 'Leído del código.',
};
const LOSEP = { ...CT, codigo: 'LOSEP', nombre: 'LOSEP', iessPersonal: 0.1145, verificado: false };
const LOEP = {
  ...CT, codigo: 'LOEP', nombre: 'LOEP', tipo: 'mixto', regimenServidor: 'LOSEP', regimenObrero: 'CODIGO_TRABAJO',
  iessPersonal: null, iessPatronal: null,
};

const TABLA = [
  { desde: 0, hasta: 12208, cuota: 0, porcentaje: 0 },
  { desde: 12208, hasta: 15549, cuota: 0, porcentaje: 0.05 },
  { desde: 15549, hasta: null, cuota: 167, porcentaje: 0.1 },
];

const PARAMETROS = {
  anio: 2026, anioSolicitado: 2026, exacto: true, anios: [2026], fuente: 'Acuerdo MDT-2025-195', sbu: 482,
  iessPersonal: 0.0945, iessPatronal: 0.1115, fondosReserva: 0.0833, fraccionExentaIr: 12208, tablaIr: TABLA,
  empresa: { nombre: 'Empresa Demo S.A.', ruc: '1790000000001' }, meses: [], contratos: [],
  categoriasLoep: ['servidor', 'obrero'], regimenes: [CT, LOSEP, LOEP],
};

const GRADOS = [
  { id: 1, regimen: 'LOSEP', grado: 1, denominacion: 'Servidor Público de Servicios 1', rmu: 527, rmuMax: null, esMinimo: false, fuente: 'ecu11.com (por confirmar)' },
  { id: 2, regimen: 'LOSEP', grado: 2, denominacion: 'Servidor Público de Servicios 2', rmu: 553, rmuMax: null, esMinimo: false, fuente: 'ecu11.com (por confirmar)' },
  { id: 9, regimen: 'CODIGO_TRABAJO', grado: 1, denominacion: 'Operario', rmu: 500, rmuMax: null, esMinimo: false, fuente: '' },
];

describe('parámetros', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => vi.restoreAllMocks());

  const asentar = async (fixture: { whenStable(): Promise<unknown>; detectChanges(): void }) => {
    await fixture.whenStable();
    fixture.detectChanges();
    TestBed.tick();
    fixture.detectChanges();
  };

  /** Responde todas las peticiones de parámetros que haya pendientes. */
  const responderParametros = (cuerpo: object = PARAMETROS) =>
    http.match((r) => r.url.startsWith('/api/parametros') && r.method === 'GET').forEach((r) => r.flush(cuerpo));

  const escribir = (el: HTMLElement, selector: string, valor: string) => {
    const campo = el.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(selector)!;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    campo.dispatchEvent(new Event('change'));
  };

  describe('año: SBU e impuesto a la renta', () => {
    const abrir = async () => {
      const fixture = TestBed.createComponent(ParametrosAnuales);
      fixture.detectChanges();
      TestBed.tick();
      responderParametros();
      await asentar(fixture);
      return { fixture, el: fixture.nativeElement as HTMLElement };
    };

    it('muestra el SBU y cada tramo de la tabla', async () => {
      const { el } = await abrir();
      expect(el.querySelector<HTMLInputElement>('#sbu')!.value).toBe('482');
      expect(el.querySelectorAll('tbody tr').length).toBe(3);
      expect(el.querySelector<HTMLInputElement>('input[aria-label="Porcentaje del tramo 2"]')!.value).toBe('5');
      expect(el.textContent).toContain('En adelante');
    });

    it('guarda con el porcentaje como fracción, el desde encadenado y el último tramo abierto', async () => {
      const { fixture, el } = await abrir();
      escribir(el, '#sbu', '490');
      escribir(el, 'input[aria-label="Porcentaje del tramo 3"]', '12.5');
      fixture.detectChanges();

      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      const envio = http.expectOne('/api/parametros/2026');
      expect(envio.request.method).toBe('PUT');
      expect(envio.request.body.sbu).toBe(490);
      expect(envio.request.body.tablaIr).toEqual([
        { desde: 0, hasta: 12208, cuota: 0, porcentaje: 0 },
        { desde: 12208, hasta: 15549, cuota: 0, porcentaje: 0.05 },
        { desde: 15549, hasta: null, cuota: 167, porcentaje: 0.125 },
      ]);
      envio.flush({});
    });

    it('agrega un tramo antes del último y lo quita', async () => {
      const { fixture, el } = await abrir();
      [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Agregar un tramo'))!.click();
      fixture.detectChanges();
      expect(el.querySelectorAll('tbody tr').length).toBe(4);
      expect(el.querySelectorAll('tbody tr')[3].textContent).toContain('En adelante'); // el último sigue abierto

      [...el.querySelectorAll('button')].filter((b) => b.textContent?.includes('Quitar'))[2].click();
      fixture.detectChanges();
      expect(el.querySelectorAll('tbody tr').length).toBe(3);
    });

    it('un año nuevo parte de los valores actuales y se guarda con su año', async () => {
      const { fixture, el } = await abrir();
      escribir(el, '#anio-nuevo', '2027');
      [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Crear copiando'))!.click();
      fixture.detectChanges();
      expect(el.textContent).toContain('2027 (nuevo)');
      expect(el.textContent).toContain('Guardar los valores de 2027');

      escribir(el, '#sbu', '500');
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      const envio = http.expectOne('/api/parametros/2027');
      expect(envio.request.body.sbu).toBe(500);
      expect(envio.request.body.tablaIr.length).toBe(3);
    });

    it('no deja crear un año que ya existe ni uno inválido', async () => {
      const { fixture, el } = await abrir();
      escribir(el, '#anio-nuevo', '2026');
      [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Crear copiando'))!.click();
      fixture.detectChanges();
      expect(el.textContent).not.toContain('(nuevo)');
      escribir(el, '#anio-nuevo', '15');
      [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Crear copiando'))!.click();
      fixture.detectChanges();
      expect(el.textContent).not.toContain('(nuevo)');
    });

    it('si el servidor rechaza los valores, no cambia nada y no se cae', async () => {
      const { el } = await abrir();
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      http.expectOne('/api/parametros/2026').flush(
        { errores: ['Tramo 2: el porcentaje debe estar entre 0 y 1.'] },
        { status: 400, statusText: 'Bad Request' },
      );
      await new Promise((resolver) => setTimeout(resolver));
      expect(el.querySelector<HTMLInputElement>('#sbu')!.value).toBe('482');
    });
  });

  describe('regímenes laborales', () => {
    const abrir = async () => {
      const fixture = TestBed.createComponent(RegimenesLaborales);
      fixture.detectChanges();
      TestBed.tick();
      responderParametros();
      await asentar(fixture);
      return { fixture, el: fixture.nativeElement as HTMLElement };
    };

    it('lista los regímenes y marca los que están por confirmar', async () => {
      const { el } = await abrir();
      const resumenes = [...el.querySelectorAll('summary')].map((s) => s.textContent ?? '');
      expect(resumenes.length).toBe(3);
      expect(resumenes[0]).toContain('Confirmado');
      expect(resumenes[1]).toContain('Por confirmar');
    });

    it('muestra las fracciones como porcentajes y las envía como fracciones', async () => {
      const { fixture, el } = await abrir();
      const iess = el.querySelector<HTMLInputElement>('#CODIGO_TRABAJO-iessPersonal')!;
      expect(iess.value).toBe('9.45');
      expect(el.querySelector<HTMLInputElement>('#CODIGO_TRABAJO-recargoSuplementarias')!.value).toBe('50');

      escribir(el, '#CODIGO_TRABAJO-iessPersonal', '10');
      escribir(el, '#CODIGO_TRABAJO-topeSuplementariasMes', '');
      escribir(el, '#CODIGO_TRABAJO-diasVacaciones', '20');
      fixture.detectChanges();

      el.querySelectorAll('form')[0].dispatchEvent(new Event('submit'));
      const envio = http.expectOne('/api/regimenes/CODIGO_TRABAJO');
      expect(envio.request.method).toBe('PUT');
      expect(envio.request.body.iessPersonal).toBe(0.1);
      expect(envio.request.body.iessPatronal).toBe(0.1115);
      expect(envio.request.body.recargoSuplementarias).toBe(0.5);
      expect(envio.request.body.topeSuplementariasMes).toBeNull(); // vacío = sin tope
      expect(envio.request.body.diasVacaciones).toBe(20);
      expect(envio.request.body.aplicaDecimoTercero).toBe(true);
      envio.flush(CT);
    });

    it('un porcentaje vacío no se convierte en 0%: se envía vacío para que el servidor lo rechace', async () => {
      const { fixture, el } = await abrir();
      escribir(el, '#CODIGO_TRABAJO-iessPersonal', '');
      fixture.detectChanges();
      el.querySelectorAll('form')[0].dispatchEvent(new Event('submit'));
      const envio = http.expectOne('/api/regimenes/CODIGO_TRABAJO');
      expect(envio.request.body.iessPersonal).toBeNull();
      envio.flush({ errores: ['Aporte personal al IESS: debe ser un número entre 0 y 1.'] }, { status: 400, statusText: 'Bad Request' });
    });

    it('la LOEP se edita eligiendo a qué régimen remite cada categoría', async () => {
      const { fixture, el } = await abrir();
      expect(el.querySelector('#LOEP-iessPersonal')).toBeNull();
      expect(el.querySelector<HTMLSelectElement>('#LOEP-servidor')!.value).toBe('LOSEP');

      escribir(el, '#LOEP-obrero', 'LOSEP');
      fixture.detectChanges();
      el.querySelectorAll('form')[2].dispatchEvent(new Event('submit'));
      const envio = http.expectOne('/api/regimenes/LOEP');
      expect(envio.request.body.regimenObrero).toBe('LOSEP');
      expect(envio.request.body.iessPersonal).toBeUndefined();
      envio.flush(LOEP);
    });
  });

  describe('escala salarial', () => {
    const abrir = async () => {
      const fixture = TestBed.createComponent(EscalaSalarial);
      fixture.detectChanges();
      TestBed.tick();
      responderParametros();
      http.expectOne('/api/escala').flush(GRADOS);
      await asentar(fixture);
      return { fixture, el: fixture.nativeElement as HTMLElement };
    };

    it('muestra solo los grados del régimen elegido y advierte que está por confirmar', async () => {
      const { fixture, el } = await abrir();
      expect(el.textContent).toContain('por confirmar');
      expect(el.querySelectorAll('tbody tr').length).toBe(2);
      expect(el.querySelector('tbody')!.textContent).toContain('$527.00');
      expect(el.querySelector('tbody')!.textContent).not.toContain('Operario');

      escribir(el, '#escala-regimen', 'CODIGO_TRABAJO');
      fixture.detectChanges();
      expect(el.querySelector('tbody')!.textContent).toContain('Operario');
    });

    it('no ofrece la LOEP, que usa las escalas de los otros regímenes', async () => {
      const { el } = await abrir();
      const opciones = [...el.querySelectorAll('#escala-regimen option')].map((o) => o.textContent?.trim());
      expect(opciones).toEqual(['Código del Trabajo', 'LOSEP']);
    });

    it('agrega un nivel de mínimo con su tope', async () => {
      const { fixture, el } = await abrir();
      escribir(el, '#grado-numero', '4');
      escribir(el, '#grado-puesto', 'Nivel nuevo');
      escribir(el, '#grado-rmu', '490');
      escribir(el, '#grado-rmu-max', '600');
      escribir(el, '#grado-minimo', 'si');
      fixture.detectChanges();

      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      const envio = http.expectOne('/api/escala');
      expect(envio.request.body).toEqual({
        regimen: 'LOSEP', grado: 4, denominacion: 'Nivel nuevo', rmu: 490, rmuMax: 600, esMinimo: true, fuente: '',
      });
      envio.flush({ ...GRADOS[0], id: 4 });
      await new Promise((resolver) => setTimeout(resolver));
      http.match('/api/escala').forEach((r) => r.flush(GRADOS));
    });

    it('agrega un grado al régimen elegido', async () => {
      const { fixture, el } = await abrir();
      escribir(el, '#grado-numero', '3');
      escribir(el, '#grado-puesto', 'Servidor Público de Apoyo 1');
      escribir(el, '#grado-rmu', '585');
      fixture.detectChanges();

      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      const envio = http.expectOne('/api/escala');
      expect(envio.request.method).toBe('POST');
      expect(envio.request.body).toEqual({
        regimen: 'LOSEP', grado: 3, denominacion: 'Servidor Público de Apoyo 1', rmu: 585, rmuMax: null, esMinimo: false, fuente: '',
      });
      envio.flush({ ...GRADOS[0], id: 3 });
      await new Promise((resolver) => setTimeout(resolver));
      http.match('/api/escala').forEach((r) => r.flush(GRADOS));
    });

    it('edita un grado existente', async () => {
      const { fixture, el } = await abrir();
      vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
      [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Editar'))!.click();
      fixture.detectChanges();
      expect(el.querySelector<HTMLInputElement>('#grado-rmu')!.value).toBe('527');
      expect(el.textContent).toContain('Editar el grado 1');

      escribir(el, '#grado-rmu', '540');
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      const envio = http.expectOne('/api/escala/1');
      expect(envio.request.method).toBe('PUT');
      expect(envio.request.body.rmu).toBe(540);
      envio.flush(GRADOS[0]);
    });

    it('elimina un grado solo si se confirma', async () => {
      const { el } = await abrir();
      const confirmar = vi.spyOn(window, 'confirm');
      confirmar.mockReturnValueOnce(false);
      [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Eliminar'))!.click();
      http.expectNone('/api/escala/1');

      confirmar.mockReturnValueOnce(true);
      [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Eliminar'))!.click();
      const envio = http.expectOne('/api/escala/1');
      expect(envio.request.method).toBe('DELETE');
      envio.flush(null, { status: 204, statusText: 'No Content' });
    });
  });

  describe('página', () => {
    it('cambia entre las tres pestañas', async () => {
      const fixture = TestBed.createComponent(PaginaParametros);
      fixture.detectChanges();
      TestBed.tick();
      responderParametros();
      await asentar(fixture);
      const el = fixture.nativeElement as HTMLElement;

      const pestanas = [...el.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
      expect(pestanas.length).toBe(3);
      expect(pestanas[0].getAttribute('aria-selected')).toBe('true');
      expect(el.querySelector('app-parametros-anuales')).not.toBeNull();

      pestanas[1].click();
      fixture.detectChanges();
      expect(pestanas[1].getAttribute('aria-selected')).toBe('true');
      expect(el.querySelector('app-regimenes-laborales')).not.toBeNull();
      expect(el.querySelector('app-parametros-anuales')).toBeNull();

      pestanas[2].click();
      fixture.detectChanges();
      TestBed.tick();
      http.match('/api/escala').forEach((r) => r.flush(GRADOS));
      expect(el.querySelector('app-escala-salarial')).not.toBeNull();
    });
  });
});
