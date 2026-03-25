# backend/memberships/models.py

from datetime import timedelta
from dateutil.relativedelta import relativedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils.translation import gettext_lazy as _

from core.base_models import BaseModel
from products.models import Package, Currency


# -----------------------------------------------------------
# 1. ÖDEME YÖNTEMİ (DİNAMİK TABLO)
# -----------------------------------------------------------

class PaymentMethod(BaseModel):
    """Admin üzerinden yönetilebilir ödeme yöntemi listesi."""
    name = models.CharField(_('Yöntem Adı'), max_length=100, help_text=_('Örn: Nakit, Kredi Kartı'))
    code = models.SlugField(_('Kod'), max_length=50, unique=True, help_text=_('Örn: CASH, CARD'))

    class Meta:
        verbose_name = _('Ödeme Yöntemi')
        verbose_name_plural = _('Ödeme Yöntemleri')
        ordering = ['name']

    def __str__(self):
        return self.name


# -----------------------------------------------------------
# 2. ÜYELİK
# -----------------------------------------------------------

class Membership(BaseModel):
    class MembershipStatus(models.TextChoices):
        PENDING   = 'PENDING',   _('Ödeme Bekleniyor')
        ACTIVE    = 'ACTIVE',    _('Aktif')
        SUSPENDED = 'SUSPENDED', _('Askıda')
        EXPIRED   = 'EXPIRED',   _('Süresi Doldu')
        CANCELLED = 'CANCELLED', _('İptal Edildi')

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='memberships',
        verbose_name=_('Üye'),
    )
    package = models.ForeignKey(
        Package,
        on_delete=models.PROTECT,
        related_name='memberships',
        verbose_name=_('Paket'),
    )
    status = models.CharField(
        _('Durum'),
        max_length=20,
        choices=MembershipStatus.choices,
        default=MembershipStatus.PENDING,
    )
    start_date = models.DateField(_('Başlangıç Tarihi'))
    end_date = models.DateField(_('Bitiş Tarihi'), null=True, blank=True)

    # Kredi takibi (sadece CREDIT tipi planlarda anlamlı)
    credit_total = models.PositiveIntegerField(
        _('Toplam Kredi'),
        default=0,
        help_text=_('Paketten gelen toplam seans hakkı. CREDIT dışı planlarda 0 bırakın.'),
    )
    credit_used = models.PositiveIntegerField(_('Kullanılan Kredi'), default=0)

    sold_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sold_memberships',
        verbose_name=_('Satan Personel'),
    )
    note = models.TextField(_('İç Not'), blank=True)

    class Meta:
        verbose_name = _('Üyelik')
        verbose_name_plural = _('Üyelikler')
        ordering = ['-start_date']

    def __str__(self):
        return f"{self.user.get_full_name() or self.user.email} — {self.package.name} ({self.status})"

    # ------------------------------------------------------------------
    # PROPERTY
    # ------------------------------------------------------------------

    @property
    def credit_remaining(self) -> int:
        return max(0, self.credit_total - self.credit_used)

    # ------------------------------------------------------------------
    # BİTİŞ TARİHİ HESABI
    # ------------------------------------------------------------------

    def _calculate_end_date(self):
        plan = self.package.pricing_plan
        unit = plan.interval_unit
        count = plan.unit_count

        if unit == 'DAY':
            return self.start_date + timedelta(days=count)
        elif unit == 'WEEK':
            return self.start_date + timedelta(weeks=count)
        elif unit == 'MONTH':
            return self.start_date + relativedelta(months=count)
        elif unit == 'CREDIT':
            # Kredili planlar için varsayılan 3 aylık pencere
            return self.start_date + relativedelta(months=3)
        return self.start_date

    def clean(self):
        super().clean()
        if self.start_date and self.end_date:
            if self.end_date <= self.start_date:
                raise ValidationError({'end_date': _('Bitiş tarihi başlangıçtan sonra olmalıdır.')})

    def save(self, *args, **kwargs):
        # end_date yoksa otomatik hesapla
        if not self.end_date and self.start_date and self.package_id:
            self.end_date = self._calculate_end_date()
        self.full_clean()
        super().save(*args, **kwargs)


# -----------------------------------------------------------
# 3. ÖDEME KAYDI
# -----------------------------------------------------------

class MembershipPayment(BaseModel):
    class PaymentStatus(models.TextChoices):
        PENDING  = 'PENDING',  _('Bekliyor')
        PAID     = 'PAID',     _('Ödendi')
        REFUNDED = 'REFUNDED', _('İade Edildi')

    membership = models.ForeignKey(
        Membership,
        on_delete=models.CASCADE,
        related_name='payments',
        verbose_name=_('Üyelik'),
    )
    amount = models.DecimalField(_('Tutar'), max_digits=10, decimal_places=2)
    currency = models.CharField(
        _('Para Birimi'),
        max_length=3,
        choices=Currency.choices,
        default=Currency.TRY,
    )
    method = models.ForeignKey(
        PaymentMethod,
        on_delete=models.PROTECT,
        related_name='payments',
        verbose_name=_('Ödeme Yöntemi'),
    )
    status = models.CharField(
        _('Ödeme Durumu'),
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING,
    )
    paid_at = models.DateTimeField(_('Ödeme Zamanı'), null=True, blank=True)
    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='received_payments',
        verbose_name=_('Tahsilat Yapan'),
    )
    reference = models.CharField(_('Referans / Makbuz No'), max_length=100, blank=True)

    class Meta:
        verbose_name = _('Ödeme')
        verbose_name_plural = _('Ödemeler')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.membership} — {self.amount} {self.currency} ({self.status})"


# -----------------------------------------------------------
# 4. ÜYELİK ASKIYA ALMA
# -----------------------------------------------------------

class MembershipSuspension(BaseModel):
    membership = models.ForeignKey(
        Membership,
        on_delete=models.CASCADE,
        related_name='suspensions',
        verbose_name=_('Üyelik'),
    )
    start_date = models.DateField(_('Askı Başlangıcı'))
    end_date = models.DateField(_('Askı Bitişi'), null=True, blank=True)
    reason = models.TextField(_('Sebep'), blank=True)

    class Meta:
        verbose_name = _('Askı Kaydı')
        verbose_name_plural = _('Askı Kayıtları')
        ordering = ['-start_date']

    def clean(self):
        super().clean()
        if self.start_date and self.end_date and self.end_date <= self.start_date:
            raise ValidationError({'end_date': _('Askı bitiş tarihi başlangıçtan sonra olmalıdır.')})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        end = self.end_date or _('devam ediyor')
        return f"{self.membership} | Askı: {self.start_date} → {end}"

    @property
    def duration_days(self) -> int | None:
        if self.start_date and self.end_date:
            return (self.end_date - self.start_date).days
        return None
