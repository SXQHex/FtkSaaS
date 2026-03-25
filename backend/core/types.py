# backend/core/types.py
import strawberry
from typing import Optional


@strawberry.type
class MutationResponse:
    """Mutation sonuçları için standart dönüş tipi."""
    success: bool
    message: str
    code: str = "OK"


@strawberry.type
class MutationError:
    """Tüm uygulamalar tarafından paylaşılan ortak hata tipi."""
    message: str
    field: Optional[str] = None
    code: Optional[str] = None