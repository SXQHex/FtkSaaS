# backend/auths/views.py
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .utils import to_global_id


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        profile = getattr(user, "profile", None)
        role = getattr(user, "role", None)

        print("🟢 [ME VIEW]")
        print("user:", user)
        print("authenticated:", user.is_authenticated)

        return Response({
            "id": to_global_id("User", str(user.id)),
            "email": user.email,
            "username": user.username,

            "first_name": user.first_name,
            "last_name": user.last_name,
            "full_name": f"{user.first_name} {user.last_name}".strip(),

            "is_active": user.is_active,

            "role": {
                "id": to_global_id("Role", str(role.id)) if role else None,
                "code": role.code if role else None,
                "name": role.name if role else None,
            } if role else None,

            "profile": {
                "gender": profile.gender,
                "birth_day": profile.birth_day,
                "user_no": profile.user_no,
                "profile_image": (
                    profile.profile_image.url
                    if profile.profile_image
                    else None
                ),
            } if profile else None,
        })
