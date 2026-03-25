# backend/memberships/graphql/types.py

import strawberry
import strawberry_django
from strawberry import relay
from typing import List, Optional, Annotated, TYPE_CHECKING
from datetime import date

from memberships import models
from .filters import (
    MembershipFilter, MembershipPaymentFilter,
    MembershipSuspensionFilter, PaymentMethodFilter,
)

if TYPE_CHECKING:
    from users.graphql.types import UserType
    from products.graphql.types import PackageType

UserTypeLazy = Annotated["UserType", strawberry.lazy("users.graphql.types")]
PackageTypeLazy = Annotated["PackageType", strawberry.lazy("products.graphql.types")]


@strawberry_django.type(models.PaymentMethod, filters=PaymentMethodFilter, pagination=True)
class PaymentMethodType(relay.Node):
    id: relay.GlobalID
    name: strawberry.auto
    code: strawberry.auto
    is_active: strawberry.auto
    description: strawberry.auto
    created_at: strawberry.auto


@strawberry_django.type(models.MembershipPayment, filters=MembershipPaymentFilter, pagination=True)
class MembershipPaymentType(relay.Node):
    id: relay.GlobalID
    membership: "MembershipType"
    amount: strawberry.auto
    currency: strawberry.auto
    method: PaymentMethodType
    status: strawberry.auto
    paid_at: strawberry.auto
    received_by: Optional[UserTypeLazy]
    reference: strawberry.auto
    created_at: strawberry.auto


@strawberry_django.type(models.MembershipSuspension, filters=MembershipSuspensionFilter, pagination=True)
class MembershipSuspensionType(relay.Node):
    id: relay.GlobalID
    membership: "MembershipType"
    start_date: strawberry.auto
    end_date: Optional[date]
    reason: strawberry.auto
    created_at: strawberry.auto

    @strawberry.field
    def duration_days(self) -> Optional[int]:
        """Askı süresini gün cinsinden hesaplar (model property'si ile çakışmayı önler)."""
        if self.start_date and self.end_date:
            return (self.end_date - self.start_date).days
        return None


@strawberry_django.type(models.Membership, filters=MembershipFilter, pagination=True)
class MembershipType(relay.Node):
    id: relay.GlobalID
    user: UserTypeLazy
    package: PackageTypeLazy
    status: strawberry.auto
    start_date: strawberry.auto
    end_date: Optional[date]
    credit_total: strawberry.auto
    credit_used: strawberry.auto
    is_active: strawberry.auto
    note: strawberry.auto
    sold_by: Optional[UserTypeLazy]
    created_at: strawberry.auto
    updated_at: strawberry.auto

    # Reverse alanlar
    payments: List[MembershipPaymentType]
    suspensions: List[MembershipSuspensionType]

    @strawberry.field
    def credit_remaining(self) -> int:
        return self.credit_remaining
