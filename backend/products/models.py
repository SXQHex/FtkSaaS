# backend/products/models.py

from django.db import models
from django.utils.translation import gettext_lazy as _
from django.core.exceptions import ValidationError
from core.base_models import BaseModel

# --- 1. AKADEMİK YAPI ---

class Discipline(BaseModel):
    name = models.CharField(_('Disiplin Adı'), max_length=100, unique=True)
    class Meta:
        verbose_name = _('Disiplin')
        verbose_name_plural = _('Disiplinler')
    def __str__(self): return self.name

class Style(BaseModel):
    discipline = models.ForeignKey(Discipline, on_delete=models.CASCADE, related_name='styles')
    name = models.CharField(_('Stil Adı'), max_length=100)
    class Meta:
        verbose_name = _('Stil')
        verbose_name_plural = _('Stiller')
        unique_together = ('name', 'discipline')
    def __str__(self): return f"{self.discipline.name} - {self.name}"

class Level(BaseModel):
    discipline = models.ForeignKey(Discipline, on_delete=models.CASCADE, related_name='levels')
    style = models.ForeignKey(Style, on_delete=models.CASCADE, null=True, blank=True, related_name='levels')
    name = models.CharField(_('Seviye Adı'), max_length=100)
    order = models.PositiveSmallIntegerField(_('Sıra'), default=1)

    class Meta:
        verbose_name = _('Seviye')
        verbose_name_plural = _('Seviyeler')
        ordering = ['discipline', 'style', 'order']
        constraints = [
            models.UniqueConstraint(fields=['name', 'discipline'], condition=models.Q(style__isnull=True), name='unique_general_level'),
            models.UniqueConstraint(fields=['name', 'style'], condition=models.Q(style__isnull=False), name='unique_style_level')
        ]

    def clean(self):
        if self.style and self.style.discipline != self.discipline:
            raise ValidationError(_("Seçilen stil, belirtilen disipline ait değil."))

    def save(self, *args, **kwargs):
        if self.style: self.discipline = self.style.discipline
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        parent = self.style.name if self.style else self.discipline.name
        return f"{parent} -> {self.name}"

class GroupType(BaseModel):
    name = models.CharField(_('Grup Tipi'), max_length=100, unique=True)
    is_private_lesson = models.BooleanField(_('Özel Ders mi?'), default=False)
    class Meta:
        verbose_name = _('Grup Tipi')
        verbose_name_plural = _('Grup Tipleri')
    def __str__(self): return self.name

class PricingPlan(BaseModel):
    class IntervalUnit(models.TextChoices):
        DAY = 'DAY', _('Gün')
        WEEK = 'WEEK', _('Hafta')
        MONTH = 'MONTH', _('Ay')
        CREDIT = 'CREDIT', _('Kredili (Zaman Kısıtlı)')

    name = models.CharField(_('Plan Adı'), max_length=100, unique=True)
    interval_unit = models.CharField(_('Zaman Birimi'), max_length=10, choices=IntervalUnit.choices, default=IntervalUnit.MONTH)
    unit_count = models.PositiveIntegerField(_('Birim Sayısı'), default=1)
    
    def get_duration_info(self):
        return f"{self.unit_count} {self.get_interval_unit_display()}"

    def __str__(self): return f"{self.name} ({self.unit_count} {self.get_interval_unit_display()})"
 
# --- 3. NİHAİ ÜRÜN (PACKAGE) ---
class Currency(models.TextChoices):
    TRY = 'TRY', _('Türk Lirası')
    USD = 'USD', _('Amerikan Doları')
    EUR = 'EUR', _('Euro')
    GBP = 'GBP', _('İngiliz Sterlini')

class Package(BaseModel):
    name = models.CharField(_('Paket Satış Adı'), max_length=200)
    discipline = models.ForeignKey(Discipline, on_delete=models.PROTECT, related_name='packages')
    style = models.ForeignKey(Style, on_delete=models.SET_NULL, null=True, blank=True, related_name='packages')
    level = models.ForeignKey(Level, on_delete=models.SET_NULL, null=True, blank=True, related_name='packages')
    group_type = models.ForeignKey(GroupType, on_delete=models.PROTECT, related_name='packages')
    pricing_plan = models.ForeignKey(PricingPlan, on_delete=models.PROTECT, related_name='packages')
    price = models.DecimalField(_('Fiyat'), max_digits=10, decimal_places=2)
    currency = models.CharField(_('Para Birimi'), max_length=3, choices=Currency.choices, default=Currency.TRY)

    class Meta:
        verbose_name = _('Paket')
        verbose_name_plural = _('Paketler')
        constraints = [
            models.UniqueConstraint(
                fields=['discipline', 'style', 'level', 'group_type', 'pricing_plan', 'price'],
                condition=models.Q(is_active=True),
                name='unique_active_package_config'
            )
        ]

    def clean(self):
        if self.style and self.style.discipline != self.discipline:
            raise ValidationError(_("Paket stili, ana disiplin ile uyumlu değil."))
        if self.level and self.level.discipline != self.discipline:
            raise ValidationError(_("Paket seviyesi, ana disiplin ile uyumlu değil."))

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self): return f"{self.name} ({self.price} {self.currency})"