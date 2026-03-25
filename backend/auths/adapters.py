# backend/auths/adapters.py
from allauth.account.adapter import DefaultAccountAdapter
from rest_framework_simplejwt.tokens import RefreshToken


class JWTAccountAdapter(DefaultAccountAdapter):
    def login(self, request, user):
        super().login(request, user)

        refresh = RefreshToken.for_user(user)
        access = refresh.access_token

        request._jwt_tokens = {
            "access": str(access),
            "refresh": str(refresh),
        }

    def get_user_data(self, user):
        # SADECE login sonrası frontend’in tanıması için
        return {
            "id": str(user.id),
            "email": user.email,
            "is_active": user.is_active,
        }