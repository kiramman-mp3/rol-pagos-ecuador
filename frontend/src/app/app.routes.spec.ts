import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { routes } from './app.routes';

describe('rutas', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes, withComponentInputBinding()),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  it('la raíz es la landing pública', async () => {
    await harness.navigateByUrl('/');
    expect(harness.routeNativeElement?.textContent).toContain('Ingresar al sistema');
    http.match(() => true);
  });

  it('/sistema entra al inicio del mes', async () => {
    await harness.navigateByUrl('/sistema');
    expect(TestBed.inject(Router).url).toBe('/sistema/inicio');
    http.match(() => true);
  });

  it('una ruta desconocida vuelve a la landing', async () => {
    await harness.navigateByUrl('/no-existe');
    expect(TestBed.inject(Router).url).toBe('/');
    http.match(() => true);
  });
});
