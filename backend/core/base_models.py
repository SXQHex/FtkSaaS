# backend/core/base_models.py
from core.mixins import SoftDeleteMixin
from uuid6 import uuid7
from django.db import models
from django.utils.translation import gettext_lazy as _


class BaseModel(SoftDeleteMixin, models.Model): # SoftDelete yeteneğini buradan aldı
    id = models.UUIDField(primary_key=True, default=uuid7, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    description = models.TextField(_('Açıklama'), blank=True)


    class Meta:
        abstract = True