# backend/core/permissions.py
from strawberry.permission import BasePermission
from strawberry.types import Info
from typing import Iterable, Any
from asgiref.sync import sync_to_async

# =====================================================
# ORTAK YARDIMCI FONKSİYONLAR (ASYNC UYUMLU)
# =====================================================

def get_user(info: Info) -> Any:
    """Context içindeki kullanıcıyı döndürür."""
    return getattr(info.context, "user", None)

@sync_to_async
def has_role_sync(user: Any, roles: Iterable[str]) -> bool:
    """
    Senkron rol kontrolü. 
    Django'nun lazy-loading (role) mekanizmasını güvenli çalıştırır.
    """
    if not user or not getattr(user, "is_authenticated", False):
        return False

    # Role ilişkisine erişim (Veritabanı tetikleyebilir)
    user_role = getattr(user, "role", None)
    if not user_role:
        return False

    # code kontrolü genellikle name'den daha stabildir (slug yapısı gereği)
    role_code = getattr(user_role, "code", "").upper()
    return role_code in roles

# ==============    =======================================
# TEMEL PERMISSION'LAR
# =====================================================

class IsAuthenticated(BasePermission):
    message = "Bu işlem için giriş yapmanız gerekir."

    async def has_permission(self, source: Any, info: Info, **kwargs) -> bool:
        user = get_user(info)
        # is_authenticated kontrolü SimpleLazyObject ise hata verebilir, 
        # ancak get_context içinde sync_to_async ile çözüldüğü için güvenlidir.
        return bool(user and user.is_authenticated)

class HasRole(BasePermission):
    """
    Generic role permission (Async-Compatible).
    """
    def __init__(self, *roles: str):
        self.roles = {r.upper() for r in roles}
        self.message = (
            "Bu işlem için şu rollerden biri gereklidir: "
            + ", ".join(self.roles)
        )

    async def has_permission(self, source: Any, info: Info, **kwargs) -> bool:
        user = get_user(info)
        return await has_role_sync(user, self.roles)

# =====================================================
# HİYERARŞİK ROL PERMISSION'LARI
# =====================================================

class IsAdmin(HasRole):
    def __init__(self):
        super().__init__("ADMIN")

class IsStaff(HasRole):
    def __init__(self):
        super().__init__("ADMIN", "STAFF")

class IsTrainer(HasRole):
    def __init__(self):
        super().__init__("ADMIN", "STAFF", "TRAINER")

class IsAssistant(HasRole):
    def __init__(self):
        super().__init__("ADMIN", "STAFF", "TRAINER", "ASSISTANT")

class IsMember(HasRole):
    def __init__(self):
        super().__init__("STUDENT")

class IsManager(HasRole):
    def __init__(self):
        super().__init__("ADMIN", "STAFF")

# =====================================================
# NESNE DÜZEYİ PERMISSION (OBJECT-LEVEL)
# =====================================================

# backend/core/permissions.py

class IsMe(BasePermission):
    message = "Sadece kendi profilinizi güncelleyebilirsiniz."

    async def has_permission(self, source, info, **kwargs) -> bool:
        request = info.context.request
        user = await request.auser()

        if not user or not user.is_authenticated:
            return False

        # kwargs.get("data") bize ProfileUpdateInput nesnesini döner
        data = kwargs.get("data")
        
        if not data:
            return False

        # Nesne üzerinden attribute olarak erişiyoruz
        # data.id bir strawberry.relay.GlobalID nesnesidir
        target_id_obj = getattr(data, "id", None)

        if not target_id_obj:
            return False

        # Küresel prensibimiz: Sadece Global ID nesnesinin node_id'sine bak
        return str(target_id_obj.node_id) == str(user.id)
    

class IsSelfOrStudioManager(BasePermission):
    message = "Bu işlem için yetkiniz yok."

    async def has_permission(self, source: Any | None, info: Info, **kwargs) -> bool:
        user = get_user(info)

        if not user or not user.is_authenticated:
            return False

        # 1. Hiyerarşik Yetki (Yöneticiler her şeyi görebilir)
        # has_role_sync'i await ederek çağırıyoruz
        if await has_role_sync(user, {"ADMIN", "STAFF"}):
            return True

        # 2. Field/Sorgu Düzeyi Kontrolü
        if source is None:
            return True 

        # 3. Nesne Düzeyi Kontrolü
        user_id = getattr(user, "id", None)
        
        def get_owner_id(obj):
            # Objeye özgü sahiplik alanlarını kontrol et
            for attr in ("user_id", "owner_id", "id"):
                val = getattr(obj, attr, None)
                if val: return val
            return None

        actual_owner_id = get_owner_id(source)
        return str(actual_owner_id) == str(user_id)

