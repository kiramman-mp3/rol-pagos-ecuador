import pytest

from app import create_app


@pytest.fixture
def client(tmp_path):
    app = create_app({"DATABASE": str(tmp_path / "test.db"), "TESTING": True})
    return app.test_client()


@pytest.fixture
def empleado_form():
    return {
        "cedula": "1801234566", "nombres": "Ana Prueba", "cargo": "Analista",
        "sueldo_base": "1000", "fecha_ingreso": "2024-01-10", "tipo_contrato": "Indefinido",
    }
