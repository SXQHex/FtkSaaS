# backend/memberships/graphql/inputs.py

import strawberry
from strawberry import relay, UNSET
from typing import Optional
from datetime import date, datetime


@strawberry.input
class PaymentMethodInput:
    name: str
    code: str
    description: Optional[str] = UNSET
    id: Optional[relay.GlobalID] = UNSET  # update için


@strawberry.input
class MembershipCreateInput:
    """Üyelik oluşturma girdisi. end_date boş bırakılırsa PricingPlan'dan hesaplanır."""
    user_id: relay.GlobalID
    package_id: relay.GlobalID
    start_date: date
    status: Optional[str] = 'PENDING'
    end_date: Optional[date] = UNSET
    credit_total: Optional[int] = 0
    sold_by_id: Optional[relay.GlobalID] = UNSET
    note: Optional[str] = UNSET


@strawberry.input
class MembershipUpdateInput:
    id: relay.GlobalID
    status: Optional[str] = UNSET
    end_date: Optional[date] = UNSET
    credit_total: Optional[int] = UNSET
    note: Optional[str] = UNSET
    sold_by_id: Optional[relay.GlobalID] = UNSET


@strawberry.input
class MakePaymentInput:
    """Mevcut üyeliğe ödeme ekleme girdisi."""
    membership_id: relay.GlobalID
    amount: str          # String alıp Decimal'e dönüştüreceğiz
    method_id: relay.GlobalID
    currency: Optional[str] = 'TRY'
    status: Optional[str] = 'PAID'
    paid_at: Optional[datetime] = UNSET
    received_by_id: Optional[relay.GlobalID] = UNSET
    reference: Optional[str] = UNSET


@strawberry.input
class SuspendMembershipInput:
    membership_id: relay.GlobalID
    start_date: date
    end_date: Optional[date] = UNSET
    reason: Optional[str] = UNSET
