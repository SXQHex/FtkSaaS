# backend/profiles/graphql/types.py
import strawberry
import strawberry_django
from strawberry import relay
from typing import Optional
from .. import models
from .filters import UserRoleFilter, ProfileFilter, UserFilter


# 1. UserRole Type
@strawberry_django.type(models.UserRole, filters=UserRoleFilter, pagination=True)
class UserRoleType(relay.Node):
    name: strawberry.auto
    code: strawberry.auto
    description: strawberry.auto
    is_active: strawberry.auto
    created_at: strawberry.auto
    updated_at: strawberry.auto
    order: strawberry.auto
    

# 2. Profile Type
@strawberry_django.type(models.Profile, filters=ProfileFilter, pagination=True)
class ProfileType(relay.Node):
    gender: strawberry.auto
    birth_day: strawberry.auto
    user_no: strawberry.auto
    profile_image: strawberry.auto
    created_at: strawberry.auto
    updated_at: strawberry.auto
    # İlişki (User'a geri dönüş)
    user: Optional["UserType"]


# 3. User Type (Full Access)
@strawberry_django.type(models.Users, filters=UserFilter, pagination=True)
class UserType(relay.Node):
    # BaseModel Alanları
    username: strawberry.auto
    email: strawberry.auto
    phone_number: Optional[str]

    first_name: strawberry.auto
    last_name: strawberry.auto
    
    is_staff: strawberry.auto
    is_superuser: strawberry.auto
    is_active: strawberry.auto

    date_joined: strawberry.auto
    last_login: strawberry.auto

    created_at: strawberry.auto
    updated_at: strawberry.auto
    description: strawberry.auto
    # İlişkiler (Optimizer bunları select_related/prefetch_related ile otomatik çözer)
    role: Optional[UserRoleType]
    profile: Optional[ProfileType]


# 5. Dashboard Stats (Genel Veriler)
@strawberry.type
class SummaryStatsType:
    """Dashboard verileri için saf Strawberry tipi"""
    total_members: int
    active_users_count: int
    today_checkins: int = 0
    pending_payments: int = 0
    system_errors: int = 0
    daily_sessions: int = 0
    assigned_members: int = 0
    expiring_memberships: int = 0
    remaining_days: int = 0
    last_workout: Optional[str] = None
    next_appointment: Optional[str] = None
    # Gerektiğinde yeni alanlar buraya eklenebilir