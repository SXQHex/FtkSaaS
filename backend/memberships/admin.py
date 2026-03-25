# backend/memberships/admin.py

from django.contrib import admin
from .models import PaymentMethod, Membership, MembershipPayment, MembershipSuspension


@admin.register(PaymentMethod)
class PaymentMethodAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'is_active')
    prepopulated_fields = {'code': ('name',)}
    search_fields = ('name', 'code')


class MembershipPaymentInline(admin.TabularInline):
    model = MembershipPayment
    extra = 0
    readonly_fields = ('created_at',)
    fields = ('method', 'amount', 'currency', 'status', 'paid_at', 'received_by', 'reference', 'created_at')


class MembershipSuspensionInline(admin.TabularInline):
    model = MembershipSuspension
    extra = 0
    readonly_fields = ('created_at',)
    fields = ('start_date', 'end_date', 'reason', 'created_at')


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ('user', 'package', 'status', 'start_date', 'end_date', 'credit_remaining', 'is_active')
    list_filter = ('status', 'is_active', 'package__discipline')
    search_fields = ('user__email', 'user__first_name', 'user__last_name', 'package__name')
    readonly_fields = ('credit_remaining', 'created_at', 'updated_at')
    inlines = [MembershipPaymentInline, MembershipSuspensionInline]
    raw_id_fields = ('user', 'sold_by')
    date_hierarchy = 'start_date'

    fieldsets = (
        ('Temel', {'fields': ('user', 'package', 'status', 'start_date', 'end_date')}),
        ('Kredi', {'fields': ('credit_total', 'credit_used', 'credit_remaining')}),
        ('Meta', {'fields': ('sold_by', 'note', 'is_active', 'created_at', 'updated_at')}),
    )


@admin.register(MembershipPayment)
class MembershipPaymentAdmin(admin.ModelAdmin):
    list_display = ('membership', 'amount', 'currency', 'method', 'status', 'paid_at')
    list_filter = ('status', 'method', 'currency')
    search_fields = ('membership__user__email', 'reference')
    readonly_fields = ('created_at',)


@admin.register(MembershipSuspension)
class MembershipSuspensionAdmin(admin.ModelAdmin):
    list_display = ('membership', 'start_date', 'end_date', 'duration_days', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('membership__user__email',)
    readonly_fields = ('duration_days', 'created_at')
    date_hierarchy = 'start_date'
