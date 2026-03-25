# config/urls.py

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import get_user_model

from strawberry import relay
from strawberry.django.views import AsyncGraphQLView
from rest_framework_simplejwt.views import TokenRefreshView

from .schema import schema

User = get_user_model()

class EnhancedAsyncGraphQLView(AsyncGraphQLView):
    async def get_context(self, request, response):
        # 1. Standart context'i al
        context = await super().get_context(request, response)

        # 2. Django'nun yerleşik asenkron kullanıcı alma metodunu kullan (Önerilen)
        # Bu metod sync_to_async karmaşasından kurtarır ve daha performanslıdır.
        authenticated_user = await request.auser()

        if authenticated_user and authenticated_user.is_authenticated:
            # Rol bilgisini önceden yüklemek (eager loading) için veritabanına bir kez gidelim
            # Permission katmanında tekrar 'sync' hatası almamak için bu kritiktir.
            context.user = await User.objects.filter(pk=authenticated_user.pk).select_related('role').afirst()
            return context

        # 3. Next-Auth Header Enjeksiyonu
        user_id_node = request.headers.get("X-User-ID")
        if user_id_node:
            try:
                # Relay ID (Base64) çözümleme
                _, pk = relay.from_base64(user_id_node)
                
                # Kullanıcıyı rolüyle birlikte asenkron çek
                user = await User.objects.filter(pk=pk).select_related('role').afirst()
                if user:
                    context.user = user
                    return context
            except Exception as e:
                # Prod'da print yerine logging kullanılması önerilir
                if settings.DEBUG:
                    print(f"Auth Header Injection Error: {e}")

        # 4. Hiçbiri yoksa varsayılan AnonymousUser
        context.user = authenticated_user
        return context

urlpatterns = [
    path('admin/', admin.site.urls),
    path("_allauth/", include("allauth.headless.urls")),
    path("auth/", include("auths.urls")),
    path("auth/jwt/refresh/", TokenRefreshView.as_view(), name="jwt-refresh"),
    
    # GraphQL Endpoint
    path('graphql/', csrf_exempt(EnhancedAsyncGraphQLView.as_view(schema=schema))),
]

# Medya ve Statik Dosyalar
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
