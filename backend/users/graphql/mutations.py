import strawberry
import strawberry_django
from strawberry import relay
import strawberry_django.mutations as dm # Yardımcı metodlar için
from core.permissions import IsAdmin, IsMe, IsStaff
from . import types, inputs

@strawberry.type
class UsersMutation:
    # =====================================================
    # 1. KENDİ PROFİLİNİ GÜNCELLEME (Self-Service)
    # =====================================================
    # Fonksiyon (def) tanımlamıyoruz. Atama yaparak 
    # Strawberry-Django'nun otomatik resolver oluşturmasını sağlıyoruz.
    update_me: types.UserType = strawberry_django.mutations.update(
        inputs.ProfileUpdateInput,
        permission_classes=[IsMe]
    )

    # =====================================================
    # 2. GENEL KULLANICI GÜNCELLEME (Admin/Manager)
    # =====================================================
    update_user: types.UserType = strawberry_django.mutations.update(
        inputs.UserUpdateInput,
        permission_classes=[IsStaff]
    )

    # =====================================================
    # 3. KULLANICI OLUŞTURMA VE SİLME
    # =====================================================
    create_user: types.UserType = strawberry_django.mutations.create(
        inputs.UserCreateInput,
        permission_classes=[IsStaff]
    )

    @strawberry_django.mutation(permission_classes=[IsAdmin])
    def delete_user(self, info: strawberry.types.Info, id: relay.GlobalID) -> types.UserType:
        """
        Kullanıcıyı siler. 
        Burada 'id' argümanını açıkça (explicit) tanımladık.
        """
        # Strawberry-Django'nun dahili silme mantığını tetikliyoruz
        return dm.handle_delete(self, info, id)