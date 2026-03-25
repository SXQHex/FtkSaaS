# backend/memberships/graphql/mutations.py

from decimal import Decimal
from datetime import timedelta

import strawberry
from strawberry import relay, UNSET
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from core.permissions import IsAdmin, IsStaff, IsAuthenticated
from core.types import MutationError
from memberships import models
from .types import (
    MembershipType, MembershipPaymentType,
    MembershipSuspensionType, PaymentMethodType,
)
from .inputs import (
    PaymentMethodInput, MembershipCreateInput, MembershipUpdateInput,
    MakePaymentInput, SuspendMembershipInput,
)


# -----------------------------------------------------------
# Yardımcı
# -----------------------------------------------------------

def get_error(e: ValidationError) -> MutationError:
    if hasattr(e, 'message_dict'):
        field = list(e.message_dict.keys())[0]
        message = e.message_dict[field][0]
        return MutationError(message=str(message), field=str(field), code="validation_error")
    return MutationError(message=str(e), code="error")


# -----------------------------------------------------------
# Union Dönüş Tipleri
# -----------------------------------------------------------

MembershipResponse = strawberry.union(
    "MembershipResponse", [MembershipType, MutationError]
)
PaymentResponse = strawberry.union(
    "PaymentResponse", [MembershipPaymentType, MutationError]
)
SuspensionResponse = strawberry.union(
    "SuspensionResponse", [MembershipSuspensionType, MutationError]
)
PaymentMethodResponse = strawberry.union(
    "PaymentMethodResponse", [PaymentMethodType, MutationError]
)


# -----------------------------------------------------------
# MUTATIONS
# -----------------------------------------------------------

@strawberry.type
class MembershipsMutation:

    # ----  PAYMENT METHOD ----

    @strawberry.mutation(permission_classes=[IsAdmin])
    def create_payment_method(self, info: strawberry.Info, data: PaymentMethodInput) -> PaymentMethodResponse:
        try:
            instance = models.PaymentMethod(name=data.name, code=data.code)
            if data.description is not UNSET:
                instance.description = data.description
            instance.full_clean()
            instance.save()
            return instance
        except ValidationError as e:
            return get_error(e)

    @strawberry.mutation(permission_classes=[IsAdmin])
    def update_payment_method(self, info: strawberry.Info, data: PaymentMethodInput) -> PaymentMethodResponse:
        try:
            if data.id is UNSET or not data.id:
                return MutationError(message="Güncelleme için 'id' zorunludur", field="id", code="required")
            instance = data.id.resolve_node(info)
            if not instance:
                return MutationError(message="Bulunamadı", field="id", code="not_found")
            instance.name = data.name
            instance.code = data.code
            if data.description is not UNSET:
                instance.description = data.description
            instance.full_clean()
            instance.save()
            return instance
        except ValidationError as e:
            return get_error(e)

    # ----  MEMBERSHIP CRUD ----

    @strawberry.mutation(permission_classes=[IsStaff])
    @transaction.atomic
    def create_membership(self, info: strawberry.Info, data: MembershipCreateInput) -> MembershipResponse:
        try:
            user = data.user_id.resolve_node(info)
            package = data.package_id.resolve_node(info)
            if not user or not package:
                return MutationError(message="Kullanıcı veya paket bulunamadı", code="not_found")

            instance = models.Membership(
                user=user,
                package=package,
                start_date=data.start_date,
                status=data.status or 'PENDING',
                credit_total=data.credit_total or 0,
            )
            if data.end_date is not UNSET and data.end_date:
                instance.end_date = data.end_date
            if data.sold_by_id is not UNSET and data.sold_by_id:
                instance.sold_by = data.sold_by_id.resolve_node(info)
            if data.note is not UNSET:
                instance.note = data.note
            instance.save()  # save() içinde end_date otomatik hesaplanır
            return instance
        except ValidationError as e:
            return get_error(e)

    @strawberry.mutation(permission_classes=[IsStaff])
    def update_membership(self, info: strawberry.Info, data: MembershipUpdateInput) -> MembershipResponse:
        try:
            instance = data.id.resolve_node(info)
            if not instance:
                return MutationError(message="Üyelik bulunamadı", field="id", code="not_found")
            if data.status is not UNSET:
                instance.status = data.status
            if data.end_date is not UNSET:
                instance.end_date = data.end_date
            if data.credit_total is not UNSET:
                instance.credit_total = data.credit_total
            if data.note is not UNSET:
                instance.note = data.note
            if data.sold_by_id is not UNSET and data.sold_by_id:
                instance.sold_by = data.sold_by_id.resolve_node(info)
            instance.full_clean()
            instance.save()
            return instance
        except ValidationError as e:
            return get_error(e)

    @strawberry.mutation(permission_classes=[IsAdmin])
    def cancel_membership(self, info: strawberry.Info, id: relay.GlobalID) -> MembershipResponse:
        instance = id.resolve_node(info)
        if not instance:
            return MutationError(message="Üyelik bulunamadı", field="id", code="not_found")
        instance.status = models.Membership.MembershipStatus.CANCELLED
        instance.save(update_fields=['status', 'updated_at'])
        return instance

    # ----  ÖDEME ----

    @strawberry.mutation(permission_classes=[IsStaff])
    @transaction.atomic
    def make_payment(self, info: strawberry.Info, data: MakePaymentInput) -> PaymentResponse:
        try:
            membership = data.membership_id.resolve_node(info)
            method = data.method_id.resolve_node(info)
            if not membership or not method:
                return MutationError(message="Üyelik veya ödeme yöntemi bulunamadı", code="not_found")

            payment = models.MembershipPayment(
                membership=membership,
                amount=Decimal(data.amount),
                method=method,
                currency=data.currency or 'TRY',
                status=data.status or 'PAID',
            )
            if data.paid_at is not UNSET and data.paid_at:
                payment.paid_at = data.paid_at
            else:
                payment.paid_at = timezone.now()
            if data.received_by_id is not UNSET and data.received_by_id:
                payment.received_by = data.received_by_id.resolve_node(info)
            if data.reference is not UNSET:
                payment.reference = data.reference

            payment.full_clean()
            payment.save()

            # Üyelik PENDING ise ACTIVE'e çek (ilk ödeme)
            if membership.status == models.Membership.MembershipStatus.PENDING:
                membership.status = models.Membership.MembershipStatus.ACTIVE
                membership.save(update_fields=['status', 'updated_at'])

            return payment
        except ValidationError as e:
            return get_error(e)

    # ----  ASKIYA ALMA ----

    @strawberry.mutation(permission_classes=[IsStaff])
    @transaction.atomic
    def suspend_membership(self, info: strawberry.Info, data: SuspendMembershipInput) -> SuspensionResponse:
        try:
            membership = data.membership_id.resolve_node(info)
            if not membership:
                return MutationError(message="Üyelik bulunamadı", field="id", code="not_found")

            suspension = models.MembershipSuspension(
                membership=membership,
                start_date=data.start_date,
            )
            if data.end_date is not UNSET and data.end_date:
                suspension.end_date = data.end_date
            if data.reason is not UNSET:
                suspension.reason = data.reason

            # Önce suspension'u kaydet: clean() negatif günü burda yakalar
            suspension.save()

            # Validation geçtiyse üyelik süresini uzat
            if data.end_date is not UNSET and data.end_date:
                days = (data.end_date - data.start_date).days
                if days > 0 and membership.end_date:
                    membership.end_date = membership.end_date + timedelta(days=days)
                    membership.save(update_fields=['end_date', 'updated_at'])

            membership.status = models.Membership.MembershipStatus.SUSPENDED
            membership.save(update_fields=['status', 'updated_at'])

            return suspension
        except ValidationError as e:
            return get_error(e)

    @strawberry.mutation(permission_classes=[IsStaff])
    def reactivate_membership(self, info: strawberry.Info, id: relay.GlobalID) -> MembershipResponse:
        """Askıdaki üyeliği tekrar aktif eder."""
        instance = id.resolve_node(info)
        if not instance:
            return MutationError(message="Üyelik bulunamadı", field="id", code="not_found")
        if instance.status != models.Membership.MembershipStatus.SUSPENDED:
            return MutationError(message="Üyelik askıda değil", field="status", code="invalid_status")
        instance.status = models.Membership.MembershipStatus.ACTIVE
        instance.save(update_fields=['status', 'updated_at'])
        return instance
