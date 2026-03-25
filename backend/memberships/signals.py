# backend/memberships/signals.py

from django.db.models import F
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone


@receiver(post_save, sender='courses.SeanceAttendance')
def deduct_credit_on_checkin(sender, instance, **kwargs):
    """
    Bir seans katılımı ATTENDED olarak kaydedildiğinde,
    ilgili kullanıcının aktif CREDIT tipi üyeliğinden 1 kredi düşer.
    """
    if instance.status != 'ATTENDED':
        return

    # Burada import döngüsünü önlemek için lokal import kullanıyoruz
    from memberships.models import Membership

    membership = (
        Membership.objects.filter(
            user=instance.attender,
            status=Membership.MembershipStatus.ACTIVE,
            package__pricing_plan__interval_unit='CREDIT',
            end_date__gte=timezone.now().date(),
            credit_used__lt=F('credit_total'),  # Hâlâ kredisi var
        )
        .order_by('end_date')  # En yakın bitenini tüket
        .first()
    )

    if membership:
        Membership.objects.filter(pk=membership.pk).update(
            credit_used=F('credit_used') + 1
        )
