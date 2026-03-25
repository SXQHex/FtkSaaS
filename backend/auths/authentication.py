# backend/auths/authentication.py
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed


class SessionJWTAuthentication(JWTAuthentication):
    """
    Öncelik:
    1. Authorization: Bearer <token>
    2. Cookie: access_token
    """

    def authenticate(self, request):
        header = self.get_header(request)

        if header is not None:
            raw_token = self.get_raw_token(header)
        else:
            raw_token = request.COOKIES.get("access_token")

        if raw_token is None:
            return None

        try:
            validated_token = self.get_validated_token(raw_token)
        except Exception:
            raise AuthenticationFailed("Invalid or expired token")

        return self.get_user(validated_token), validated_token
