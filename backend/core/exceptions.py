# backend/core/exceptions.py
from typing import Optional

class BaseAppException(Exception):
    """Proje genelindeki tüm özel hataların atası."""
    def __init__(self, message: str, code: str = "INTERNAL_ERROR"):
        self.message = message
        self.code = code
        super().__init__(self.message)

class PermissionDeniedException(BaseAppException):
    def __init__(self, message: str = "Bu işlem için yetkiniz yok."):
        super().__init__(message, code="PERMISSION_DENIED")

class ValidationException(BaseAppException):
    """
    Veri doğrulama hataları için. 
    Field bilgisi opsiyoneldir (genel form hatası vs. özel alan hatası).
    """
    def __init__(self, message: str, field: Optional[str] = None):
        self.field = field
        # Hata kodunu sabitliyoruz ki frontend 'VALIDATION_ERROR' gördüğünde 
        # field bilgisini arayacağını bilsin.
        super().__init__(message, code="VALIDATION_ERROR")

    def __str__(self) -> str:
        if self.field:
            return f"[{self.field}] {self.message}"
        return self.message