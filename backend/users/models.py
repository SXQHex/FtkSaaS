# backend/users/models.py
from uuid import uuid4
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _
from phonenumber_field.modelfields import PhoneNumberField

from core.base_models import BaseModel
from core.mixins import SoftDeleteMixin, UserSoftDeleteManager, ActiveManager

class UserRole(BaseModel):
    name = models.CharField(_("Rol Adı"), max_length=150, unique=True)
    order = models.PositiveIntegerField(_("Sıra"), default=1, db_index=True)
    code = models.SlugField(_("Rol Kodu"), max_length=50, unique=True, db_index=True)

    class Meta:
        verbose_name = _('Kullanıcı Rolü')
        verbose_name_plural = _('Kullanıcı Rolleri')

    def __str__(self):
        return self.name

class Users(BaseModel, AbstractUser):
    """
    En soldaki SoftDeleteMixin sayesinde .delete() ve managerlar öncelik kazanır.
    BaseModel sayesinde ID UUIDv7 olur.
    AbstractUser sayesinde Auth özellikleri korunur.
    """
    email = models.EmailField(_("E-posta Adresi"), unique=True)
    phone_number = PhoneNumberField(_("Telefon Numarası"), unique=True, null=True, blank=True)
    role = models.ForeignKey(
        UserRole, 
        on_delete=models.PROTECT, 
        related_name='users', 
        null=True, 
        verbose_name=_("Kullanıcı Rolü")
    )

    # UserManager'ın create_user/create_superuser metodlarını korurken soft-delete desteği ekler.
    objects = UserSoftDeleteManager()
    active_objects = ActiveManager()

    class Meta:
        verbose_name = _('Kullanıcı')
        verbose_name_plural = _('Kullanıcılar')


    def save(self, *args, **kwargs):
            if not self.username and self.email:
                base_username = self.email.split('@')[0]
                
                # İlk deneme
                self.username = f"{base_username}_{uuid4().hex[:4]}"
                
                # Eğer bu username zaten varsa, yenisini üret (Unique Check)
                while type(self).objects.filter(username=self.username).exists():
                    self.username = f"{base_username}_{uuid4().hex[:4]}"
                    
            super().save(*args, **kwargs)

class Profile(SoftDeleteMixin, models.Model):
    class Gender(models.TextChoices):
        ERKEK = 'Erkek', _('Erkek')
        KADIN = 'Kadin', _('Kadın')

    user = models.OneToOneField(
        Users, 
        on_delete=models.CASCADE, 
        primary_key=True, 
        related_name='profile'
    )
    gender = models.CharField(_("Cinsiyet"), max_length=10, choices=Gender.choices, null=True, blank=True)
    birth_day = models.DateField(_("Doğum Tarihi"), null=True, blank=True)
    user_no = models.PositiveIntegerField(_("Kullanıcı No"), unique=True, null=True, blank=True, db_index=True)
    profile_image = models.ImageField(_("Profil Resmi"), upload_to='profile_pics/', null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('Profil')
        verbose_name_plural = _('Profiller')
