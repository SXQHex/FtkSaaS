import uuid6
from django.conf import settings
from django.db import models


class AuditEvent(models.Model):
    EVENT_LOGIN = "login"
    EVENT_LOGIN_FAILED = "login_failed"
    EVENT_LOGOUT = "logout"
    EVENT_REFRESH = "refresh"
    EVENT_EMAIL_VERIFY = "email_verify"

    EVENT_CHOICES = [
        (EVENT_LOGIN, "Login"),
        (EVENT_LOGIN_FAILED, "Login Failed"),
        (EVENT_LOGOUT, "Logout"),
        (EVENT_REFRESH, "Refresh"),
        (EVENT_EMAIL_VERIFY, "Email Verify"),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid6.uuid7,
        editable=False,
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="audit_events",
    )

    event = models.CharField(max_length=64, choices=EVENT_CHOICES)
    success = models.BooleanField(default=True)

    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)

    path = models.CharField(max_length=255)
    method = models.CharField(max_length=8)
    status_code = models.PositiveSmallIntegerField()

    metadata = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["event"]),
            models.Index(fields=["created_at"]),
            models.Index(fields=["user"]),
        ]
