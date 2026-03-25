# backend/memberships/graphql/enums.py

import strawberry
from memberships.models import Membership, MembershipPayment


@strawberry.enum
class MembershipStatusEnum(str):
    PENDING   = Membership.MembershipStatus.PENDING
    ACTIVE    = Membership.MembershipStatus.ACTIVE
    SUSPENDED = Membership.MembershipStatus.SUSPENDED
    EXPIRED   = Membership.MembershipStatus.EXPIRED
    CANCELLED = Membership.MembershipStatus.CANCELLED


@strawberry.enum
class PaymentStatusEnum(str):
    PENDING  = MembershipPayment.PaymentStatus.PENDING
    PAID     = MembershipPayment.PaymentStatus.PAID
    REFUNDED = MembershipPayment.PaymentStatus.REFUNDED
