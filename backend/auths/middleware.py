# backend/auths/middleware.py
from django.conf import settings

class JWTResponseMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        tokens = getattr(request, "_jwt_tokens", None)
        if tokens:
            response.set_cookie(
                "access_token",
                tokens["access"],
                httponly=True,
                secure=not settings.DEBUG,
                samesite="Lax",
            )
            response.set_cookie(
                "refresh_token",
                tokens["refresh"],
                httponly=True,
                secure=not settings.DEBUG,
                samesite="Lax",
            )
        return response
