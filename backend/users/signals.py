from django.db.models.signals import post_save
from django.dispatch import receiver
from django.conf import settings
from django.db.models import Max
from django.db import transaction
from allauth.account.signals import password_set, password_changed
from .models import Profile 

@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        # User oluşturulduğunda Profile nesnesini atomik bir numara ile yarat
        with transaction.atomic():
            # select_for_update sadece mevcut satırları kilitler. 
            # Tabloyu kilitlemek veya Sequence kullanmak daha garantidir ama bu yapı 
            # orta ölçekli projeler için yeterlidir.
            max_no_dict = Profile.objects.select_for_update().aggregate(Max("user_no"))
            max_no = max_no_dict.get("user_no__max")
            new_no = 1000 if max_no is None else max_no + 1
            
            Profile.objects.create(user=instance, user_no=new_no)

@receiver(password_set)
@receiver(password_changed)
def activate_after_password_entry(sender, request, user, **kwargs):
    """
    Kullanıcı şifresini belirlediği veya değiştirdiği an (örn: ilk kayıt sonrası 
    gelen maille şifre kurma), hesabı aktif et.
    """
    if not user.is_active:
        user.is_active = True
        # Mixin kullandığımız için updated_at varsa onu da güncelleriz
        update_fields = ["is_active"]
        if hasattr(user, 'updated_at'):
            from django.utils import timezone
            user.updated_at = timezone.now()
            update_fields.append('updated_at')
            
        user.save(update_fields=update_fields)