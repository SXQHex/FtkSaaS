# backend/profiles/graphql/queries.py
import strawberry
import strawberry_django
from strawberry import relay
from typing import Optional
from asgiref.sync import sync_to_async
from .. import models
from .types import ( UserType, UserRoleType, ProfileType, SummaryStatsType )
from .filters import UserFilter, UserRoleFilter, ProfileFilter


@strawberry.type
class UsersQuery:
    node: relay.Node = relay.node()
    # Tekil Node erişimleri
    user: Optional[UserType] = relay.node()
    user_role: Optional[UserRoleType] = relay.node()
    profile: Optional[ProfileType] = relay.node()

    # Listeler (Relay Connections)
    users: relay.ListConnection[UserType] = strawberry_django.connection(filters=UserFilter)
    user_roles: relay.ListConnection[UserRoleType] = strawberry_django.connection(filters=UserRoleFilter)
    profiles: relay.ListConnection[ProfileType] = strawberry_django.connection(filters=ProfileFilter)

    # --- Kimlik Doğrulama Sonrası "Ben Kimim?" ---
    @strawberry.field
    async def me(self, info: strawberry.types.Info) -> Optional[UserType]:
        user = await info.context.request.auser()
        if not user or not user.is_authenticated:
            return None
            
        return user
    
    # Dashboard / Stats
    @strawberry.field
    async def summary_stats(self) -> SummaryStatsType:
        from datetime import timedelta
        from django.utils import timezone
        from memberships.models import Membership
        from courses.models import Seance

        today = timezone.now().date()
        expiry_threshold = today + timedelta(days=7)

        total_members = await sync_to_async(models.Users.objects.count)()
        active_users = await sync_to_async(
            lambda: models.Users.objects.filter(is_active=True).count()
        )()
        pending_payments = await sync_to_async(
            lambda: Membership.objects.filter(status='PENDING').count()
        )()
        expiring_memberships = await sync_to_async(
            lambda: Membership.objects.filter(
                status='ACTIVE', end_date__lte=expiry_threshold
            ).count()
        )()
        daily_sessions = await sync_to_async(
            lambda: Seance.objects.filter(
                start_time__date=today,
                status='SCHEDULED',
                is_active=True,
            ).count()
        )()
        from courses.models import Seance, SeanceAttendance
        today_checkins = await sync_to_async(
            lambda: SeanceAttendance.objects.filter(
                seance__start_time__date=today,
                status='ATTENDED',
            ).count()
        )()

        return SummaryStatsType(
            total_members=total_members,
            active_users_count=active_users,
            today_checkins=today_checkins,
            pending_payments=pending_payments,
            system_errors=0,
            daily_sessions=daily_sessions,
            assigned_members=0,
            expiring_memberships=expiring_memberships,
            remaining_days=0,
            last_workout="-",
            next_appointment="-",
        )
