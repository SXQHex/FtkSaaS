import time
from django.utils.deprecation import MiddlewareMixin
from django.contrib.auth import get_user
from rest_framework_simplejwt.tokens import RefreshToken

from audit.models import AuditEvent
from audit.utils import get_client_ip, safe_json


AUDITED_PREFIX = "/_allauth/"

EVENT_MAP = {
    "/auth/login": AuditEvent.EVENT_LOGIN,
    "/auth/logout": AuditEvent.EVENT_LOGOUT,
    "/auth/token/refresh": AuditEvent.EVENT_REFRESH,
    "/auth/email/verify": AuditEvent.EVENT_EMAIL_VERIFY,
}


class AuditMiddleware(MiddlewareMixin):
    """
    Production-ready audit middleware.
    No views, no signals, no side-effects.
    """

    def process_request(self, request):
        request._audit_start = time.monotonic()

    def process_response(self, request, response):
        try:
            path = request.path

            if not path.startswith(AUDITED_PREFIX):
                return response

            event = self._resolve_event(path, response.status_code)
            if not event:
                return response

            duration = round(
                time.monotonic()
                - getattr(request, "_audit_start", time.monotonic()),
                4,
            )

            user = get_user(request)
            user = user if user.is_authenticated else None

            success = response.status_code < 400

            metadata = {
                "duration": duration,
                "has_access_cookie": "access_token" in request.COOKIES,
                "has_refresh_cookie": "refresh_token" in request.COOKIES,
            }

            AuditEvent.objects.create(
                user=user,
                event=event,
                success=success,
                ip_address=get_client_ip(request),
                user_agent=request.META.get("HTTP_USER_AGENT", "")[:512],
                path=path[:255],
                method=request.method,
                status_code=response.status_code,
                metadata=safe_json(metadata),
            )

            # 🔒 Logout → refresh token revoke
            if event == AuditEvent.EVENT_LOGOUT:
                self._blacklist_refresh(request)

        except Exception:
            # audit MUST NOT break auth
            pass

        return response

    def _resolve_event(self, path: str, status_code: int):
        for key, event in EVENT_MAP.items():
            if key in path:
                if event == AuditEvent.EVENT_LOGIN and status_code in (401, 403):
                    return AuditEvent.EVENT_LOGIN_FAILED
                return event
        return None

    def _blacklist_refresh(self, request):
        try:
            token = request.COOKIES.get("refresh_token")
            if token:
                RefreshToken(token).blacklist()
        except Exception:
            pass
