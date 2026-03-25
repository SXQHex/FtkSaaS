# backend/profiles/graphql/filters.py
from django.db.models import Q
import strawberry
import strawberry_django
from typing import Optional
from .. import models

@strawberry_django.filters.filter(models.UserRole)
class UserRoleFilter:
    name: strawberry.auto
    code: strawberry.auto
    order: strawberry.auto
    is_active: strawberry.auto

@strawberry_django.filters.filter(models.Profile)
class ProfileFilter:
    gender: strawberry.auto
    user_no: strawberry.auto


@strawberry_django.filters.filter(models.Users)
class UserFilter:
    id: strawberry.auto
    username: strawberry.auto
    email: strawberry.auto
    is_active: strawberry.auto
    first_name: strawberry.auto
    last_name: strawberry.auto
    search: Optional[str] = None

    def filter_search(self, queryset, value):
        if not value:
            return queryset
        return queryset.filter(
            Q(username__icontains=value) |
            Q(first_name__icontains=value) |
            Q(last_name__icontains=value) |
            Q(phone_number__icontains=value)
        )