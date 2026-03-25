# backend/auths/urls.py
from django.urls import path
from .views import MeView
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.middleware.csrf import get_token


@ensure_csrf_cookie
def csrf(request):
    return JsonResponse({
        "csrfToken": get_token(request)
    })

urlpatterns = [
    path("me/", MeView.as_view(), name="me"),
    path("csrf/", csrf),
]
