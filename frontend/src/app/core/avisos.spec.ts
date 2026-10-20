import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { Avisos } from './avisos';

@Component({ template: '' })
class Vacio {}

describe('Avisos', () => {
  let avisos: Avisos;
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'a', component: Vacio },
          { path: 'b', component: Vacio },
          { path: 'c', component: Vacio },
        ]),
      ],
    });
    avisos = TestBed.inject(Avisos);
    harness = await RouterTestingHarness.create();
  });

  it('un aviso creado antes de navegar sobrevive a esa navegación y se retira en la siguiente', async () => {
    await harness.navigateByUrl('/a');
    avisos.exito('Empleado guardado.');

    await harness.navigateByUrl('/b');
    expect(avisos.lista().map((a) => a.texto)).toEqual(['Empleado guardado.']);

    await harness.navigateByUrl('/c');
    expect(avisos.lista()).toEqual([]);
  });

  it('muestra cada mensaje de error que devuelve la API', () => {
    const error = new HttpErrorResponse({ status: 400, error: { errores: ['Cédula inválida.', 'Cargo obligatorio.'] } });
    avisos.errorHttp(error);
    expect(avisos.lista().map((a) => a.texto)).toEqual(['Cédula inválida.', 'Cargo obligatorio.']);
    expect(avisos.lista().every((a) => a.tipo === 'danger')).toBe(true);
  });

  it('usa un mensaje genérico si el servidor no responde', () => {
    avisos.errorHttp(new HttpErrorResponse({ status: 0 }));
    expect(avisos.lista()[0].texto).toContain('servidor');
  });
});
