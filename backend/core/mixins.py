# backend/core/mixins.py
from django.db import models
from django.utils import timezone
from django.contrib.auth.models import UserManager


class SoftDeleteQuerySet(models.QuerySet):
    def delete(self):
        """Toplu soft delete: .objects.filter(...).delete()"""
        update_dict = {'is_active': False}
        if hasattr(self.model, 'updated_at'):
            update_dict['updated_at'] = timezone.now()
        return self.update(**update_dict)

    def restore(self):
        """Toplu geri getirme: .objects.all_with_deleted().filter(...).restore()"""
        update_dict = {'is_active': True}
        if hasattr(self.model, 'updated_at'):
            update_dict['updated_at'] = timezone.now()
        return self.update(**update_dict)

    def hard_delete(self):
        """Toplu fiziksel silme"""
        return super().delete()

class ActiveManager(models.Manager):
    def get_queryset(self):
        """Otomatik olarak is_active=False olanları gizleyen manager"""
        return SoftDeleteQuerySet(self.model, using=self._db).filter(is_active=True)


class SoftDeleteManager(models.Manager):
    """Genel amaçlı soft-delete manager (Membership gibi normal modeller için)."""
    def get_queryset(self):
        return SoftDeleteQuerySet(self.model, using=self._db)

    def all_with_deleted(self):
        """Silinenleri de içeren ham queryset"""
        return self.get_queryset()

    def hard_delete(self):
        return self.get_queryset().hard_delete()


class UserSoftDeleteManager(UserManager):
    """
    Kullanıcı modeline özgü soft-delete manager.
    UserManager'ın create_user / create_superuser metodlarını korur.
    """
    def get_queryset(self):
        return SoftDeleteQuerySet(self.model, using=self._db)

    def all_with_deleted(self):
        return self.get_queryset()

    def hard_delete(self):
        return self.get_queryset().hard_delete()

class SoftDeleteMixin(models.Model):
    is_active = models.BooleanField(default=True, db_index=True)

    # 1. Manager: Her şeye erişir. Filtreleme (is_active: False) yapabilmek için şart.
    objects = SoftDeleteManager()
    
    # 2. Manager: Sadece aktifleri getirir. 'active_courses' gibi resolver'lar için.
    active_objects = ActiveManager()

    class Meta:
        abstract = True

    def delete(self, *args, **kwargs):
        """Tekil soft delete"""
        self.is_active = False
        update_fields = ['is_active']
        if hasattr(self, 'updated_at'):
            self.updated_at = timezone.now()
            update_fields.append('updated_at')
        self.save(update_fields=update_fields)
        return 1, {self._meta.model_name: 1}

    def restore(self):
        """Tekil geri getirme"""
        self.is_active = True
        update_fields = ['is_active']
        if hasattr(self, 'updated_at'):
            self.updated_at = timezone.now()
            update_fields.append('updated_at')
        self.save(update_fields=update_fields)
        return self

    def hard_delete(self, *args, **kwargs):
        """Tekil fiziksel silme"""
        return super().delete(*args, **kwargs)

