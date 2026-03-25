# audit/signals.py

from allauth.account.signals import user_logged_out
from rest_framework_simplejwt.tokens import RefreshToken
from django.dispatch import receiver


@receiver(user_logged_out)
def blacklist_refresh_on_logout(sender, request, user, **kwargs):
    try:
        token = request.COOKIES.get("refresh_token")
        if token:
            RefreshToken(token).blacklist()
    except Exception:
        pass