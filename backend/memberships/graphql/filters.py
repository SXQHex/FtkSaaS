# backend/memberships/graphql/filters.py

import strawberry
import strawberry_django
from typing import Optional
from datetime import date

from memberships import models


@strawberry_django.filter(models.PaymentMethod, lookups=True)
class PaymentMethodFilter:
    id: Optional[strawberry.ID] = None
    code: Optional[str] = None
    is_active: Optional[bool] = None


@strawberry_django.filter(models.Membership, lookups=True)
class MembershipFilter:
    id: Optional[strawberry.ID] = None
    user: Optional[strawberry.ID] = None
    package: Optional[strawberry.ID] = None
    status: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: Optional[bool] = None


@strawberry_django.filter(models.MembershipPayment, lookups=True)
class MembershipPaymentFilter:
    id: Optional[strawberry.ID] = None
    membership: Optional[MembershipFilter] = None
    status: Optional[str] = None
    method: Optional[strawberry.ID] = None
    is_active: Optional[bool] = None


@strawberry_django.filter(models.MembershipSuspension, lookups=True)
class MembershipSuspensionFilter:
    id: Optional[strawberry.ID] = None
    membership: Optional[MembershipFilter] = None
    is_active: Optional[bool] = None
