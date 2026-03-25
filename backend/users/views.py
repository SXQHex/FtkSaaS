from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.response import Response
from django.conf import settings

class LoginView(TokenObtainPairView):
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            access_token = response.data.get('access')
            refresh_token = response.data.get('refresh')

            # Web için Cookie'ye yerleştir
            response.set_cookie(
                key=settings.AUTH_COOKIE_NAME,
                value=access_token,
                httponly=True,
                secure=settings.AUTH_COOKIE_SECURE,
                samesite=settings.AUTH_COOKIE_SAMESITE
            )
            response.set_cookie(
                key=settings.AUTH_COOKIE_REFRESH_NAME,
                value=refresh_token,
                httponly=True,
                secure=settings.AUTH_COOKIE_SECURE,
                samesite=settings.AUTH_COOKIE_SAMESITE
            )
            # Response içindeki tokenları mobiller okusun, web görmezden gelsin
        return response