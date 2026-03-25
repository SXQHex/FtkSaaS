# backend/memberships/graphql/queries.py

import strawberry
import strawberry_django
from strawberry import relay
from typing import Optional, Iterable
from datetime import timedelta

from django.utils import timezone

from memberships import models
from .types import MembershipType, MembershipPaymentType, MembershipSuspensionType, PaymentMethodType
from .filters import MembershipFilter, MembershipPaymentFilter, PaymentMethodFilter, MembershipSuspensionFilter


@strawberry.type
class MembershipsQuery:
    # Tekil node erişimleri
    membership: Optional[MembershipType] = relay.node()
    membership_payment: Optional[MembershipPaymentType] = relay.node()
    membership_suspension: Optional[MembershipSuspensionType] = relay.node()
    payment_method: Optional[PaymentMethodType] = relay.node()

    # Liste / connection erişimleri
    memberships: relay.ListConnection[MembershipType] = strawberry_django.connection(filters=MembershipFilter)
    membership_payments: relay.ListConnection[MembershipPaymentType] = strawberry_django.connection(filters=MembershipPaymentFilter)
    membership_suspensions: relay.ListConnection[MembershipSuspensionType] = strawberry_django.connection(filters=MembershipSuspensionFilter)
    payment_methods: relay.ListConnection[PaymentMethodType] = strawberry_django.connection(filters=PaymentMethodFilter)

    # --- Özel Sorgular ---

    @strawberry_django.connection(relay.ListConnection[MembershipType])
    def expiring_memberships(self, days: int = 7) -> Iterable[MembershipType]:
        """
        Önümüzdeki N gün içinde bitecek aktif üyelikleri döner.
        Dashboard uyarı kartı için kullanılır.
        """
        threshold = timezone.now().date() + timedelta(days=days)
        return models.Membership.active_objects.filter(
            status=models.Membership.MembershipStatus.ACTIVE,
            end_date__lte=threshold,
        ).select_related('user', 'package')

    @strawberry.field
    async def my_membership(self, info: strawberry.Info) -> Optional[MembershipType]:
        """Giriş yapmış kullanıcının en güncel aktif üyeliğini döner."""
        user = await info.context.request.auser()
        if not user or not user.is_authenticated:
            return None

        from asgiref.sync import sync_to_async
        return await sync_to_async(
            lambda: models.Membership.active_objects.filter(
                user=user,
                status=models.Membership.MembershipStatus.ACTIVE,
            ).order_by('-start_date').first()
        )()

    @strawberry_django.connection(relay.ListConnection[MembershipType])
    def pending_memberships(self) -> Iterable[MembershipType]:
        """Ödeme bekleyen üyelikler. Personel dashboard'u için."""
        return models.Membership.active_objects.filter(
            status=models.Membership.MembershipStatus.PENDING,
        ).select_related('user', 'package')
