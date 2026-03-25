import uuid6
from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator
from django.utils.translation import gettext_lazy as _
from core.base_models import BaseModel

# -----------------------------------------------------------
# 1. FİZİKSEL MEKAN MODELLERİ
# -----------------------------------------------------------

class Location(BaseModel):
    name = models.CharField(_('Şube Adı'), max_length=100, unique=True, help_text=_('Şubenin sistemdeki benzersiz adı.'))
    address = models.TextField(_('Açık Adres'))
    phone = models.CharField(_('Şube Telefonu'), max_length=20, blank=True)
    email = models.EmailField(_('Şube E-postası'), blank=True)
    internal_code = models.CharField(_('Dahili Kod / IP'), max_length=50, unique=True, null=True, blank=True, help_text=_('Gelecekteki entegrasyonlar için benzersiz tanımlayıcı.'))
    contact_info = models.TextField(_('İletişim Kişileri ve Notlar'), blank=True, help_text=_('Kontak kişileri (İsim - Görev - Tel) buraya not alınabilir.'))
    
    class Meta:
        verbose_name = _('Şube')
        verbose_name_plural = _('Şubeler')
        ordering = ['name']

    def __str__(self): return self.name

class Room(BaseModel):
    location = models.ForeignKey(Location, on_delete=models.PROTECT, related_name='rooms', verbose_name=_('Şube'))
    name = models.CharField(_('Salon Adı'), max_length=100, help_text=_("Aynı şube içerisinde benzersiz olmalıdır."))
    physical_capacity = models.PositiveIntegerField(_('Fiziksel Kapasite'), default=20)
    color_code = models.CharField(_('Takvim Rengi'), max_length=7, default='#3b82f6', 
        validators=[RegexValidator(regex=r'^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$', message=_('Geçerli bir HEX renk kodu giriniz (Örn: #3b82f6).'))]
    )

    class Meta:
        verbose_name = _('Salon')
        verbose_name_plural = _('Salonlar')
        unique_together = ('location', 'name')
        ordering = ['location', 'name']

    def __str__(self): return f"{self.location.name} > {self.name}"

    def save(self, *args, **kwargs):
        # Renk kodunu her zaman büyük harf kaydet
        if self.color_code:
            self.color_code = self.color_code.upper()
        super().save(*args, **kwargs)

# -----------------------------------------------------------
# 2. TANIMLAMALAR VE KURALLAR
# -----------------------------------------------------------

class ParticipationRole(BaseModel):
    name = models.CharField(_('Rol Adı'), max_length=50, unique=True, help_text=_('Örn: Lider, Takipçi, Eğitmen, Asistan'))
    courses_staff = models.BooleanField(_('Modül Görevlisi mi?'), default=False, help_text=_('İşaretli ise kontenjanı etkilemez ve seans yönetim yetkisi (yoklama vb.) tanınabilir.'))
    impacts_capacity = models.BooleanField(_('Kontenjan Etkiler mi?'), default=True, help_text=_('İşaretli değil ise kontenjanı etkilemez'))    
    color_code = models.CharField(_('Takvim Rengi'), max_length=7, default='#10b981',
        validators=[RegexValidator(regex=r'^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$',message=_('Geçerli bir HEX renk kodu giriniz.'))]
    )

    class Meta:
        verbose_name = _('Katılım Rolü')
        verbose_name_plural = _('Katılım Rolleri')
        ordering = ['courses_staff', 'name']

    def __str__(self):
        return self.name
    
    def save(self, *args, **kwargs):
        # Renk kodunu her zaman büyük harf kaydet
        if self.color_code:
            self.color_code = self.color_code.upper()
        super().save(*args, **kwargs)

# -----------------------------------------------------------
# 3. KURS VE PROGRAMLAMA MODELLERİ
# -----------------------------------------------------------

class CourseGroup(BaseModel):
    class GroupStatus(models.TextChoices):
        PLANNED = 'PLANNED', _('Planlandı / Hazırlık') # Taslak aşaması, tarih/hoca netleşiyor olabilir.
        ACTIVE = 'ACTIVE', _('Aktif / Kayıt Alıyor')  # Satışa ve kayda açık.
        CLOSED = 'CLOSED', _('Kayıtlara Kapalı / Dolu') # Grup başladı veya kontenjan doldu, yeni üye almıyor.
        COMPLETED = 'COMPLETED', _('Tamamlandı')      # Eğitim süreci bitti.
        CANCELLED = 'CANCELLED', _('İptal')           # Herhangi bir sebeple iptal edildi.
    name = models.CharField(_('Grup Adı'), max_length=100, help_text=_('Örn: Pazartesi Salsa Başlangıç'))
    status = models.CharField(_('Grup Durumu'), max_length=20, choices=GroupStatus.choices, default=GroupStatus.PLANNED)
    discipline = models.ForeignKey('products.Discipline', on_delete=models.PROTECT, related_name='course_groups')
    level = models.ForeignKey('products.Level', on_delete=models.PROTECT, related_name='course_groups', null=True, blank=True)
    default_room = models.ForeignKey('Room', on_delete=models.PROTECT, related_name='course_groups', verbose_name=_('Varsayılan Salon'), null=True, blank=True)
    start_date = models.DateField(_('Başlangıç Tarihi'))
    end_date = models.DateField(_('Bitiş Tarihi'))
    is_closed_group = models.BooleanField(_('Kapalı Grup mu?'), default=False)

    class Meta:
        verbose_name = _('Kurs Grubu')
        verbose_name_plural = _('Kurs Grupları')

    def __str__(self): return f"{self.name} ({self.discipline.name})"

class CourseGroupRoleCapacity(BaseModel):
    """Grubun varsayılan kontenjan şablonu. Seanslar oluşturulurken bu sayılar referans alınır."""
    group = models.ForeignKey('CourseGroup', on_delete=models.CASCADE, related_name='role_templates')
    role = models.ForeignKey('ParticipationRole', on_delete=models.PROTECT)
    capacity = models.PositiveIntegerField(_('Varsayılan Kontenjan'))

    def clean(self):
        super().clean()
        if not self.role or not self.group.default_room or not self.role.impacts_capacity:
            return
    
        # Sadece AKTİF (is_active=True) olan kapasite şablonlarının toplamını al
        current_total = CourseGroupRoleCapacity.active_objects.filter(
            group=self.group, role__impacts_capacity=True  # Sadece kontenjan etkileyenleri say
        ).exclude(id=self.id).aggregate(models.Sum('capacity'))['capacity__sum'] or 0
        
        # Salonun fiziksel sınırını kontrol et
        if current_total + self.capacity > self.group.default_room.physical_capacity:
            raise ValidationError(_("Toplam kontenjan şablonu salon kapasitesini (%(cap)s) aşamaz.") % 
                                 {'cap': self.group.default_room.physical_capacity})

    class Meta:
        unique_together = ('group', 'role')

class GroupMember(BaseModel):
    group = models.ForeignKey(CourseGroup, on_delete=models.CASCADE, related_name='members')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='group_memberships')
    role = models.ForeignKey(ParticipationRole, on_delete=models.PROTECT, verbose_name=_('Gruptaki Rolü'))
    is_primary = models.BooleanField(_('Ana Eğitmen (Trainer) mı?'), default=False)
    class Meta:
        unique_together = ('group', 'user') # Bir kişi bir grupta sadece bir role sahip olabilir
        verbose_name = _('Grup Üyesi / Görevlisi')
        verbose_name_plural = _('Grup Üyeleri ve Görevlileri')

    def __str__(self):
        return f"{self.user.get_full_name()} - {self.role.name} ({self.group.name})"

    def clean(self):
        super().clean()
        # 1. Primary Instructor Kontrolü
        if self.is_primary:
            if GroupMember.active_objects.filter(group=self.group, is_primary=True).exclude(id=self.id).exists():
                raise ValidationError(_("Grupta zaten birincil eğitmen var."))
            if not self.role.courses_staff:
                raise ValidationError(_("Birincil eğitmen sadece görevli rollerinden seçilebilir."))

            # 2. Rol Bazlı Kontenjan Denetimi
        if self.role and self.role.impacts_capacity:
            capacity_template = CourseGroupRoleCapacity.active_objects.filter(
                group=self.group, role=self.role
            ).first()
            if not capacity_template:
                raise ValidationError(_("Bu rol için grupta aktif kontenjan tanımlanmamış."))

            # Aktif üyeleri sayarak doluluk kontrolü
            current_count = GroupMember.active_objects.filter(
                group=self.group, role=self.role
            ).exclude(id=self.id).count()

            if current_count >= capacity_template.capacity:
                raise ValidationError(_("%(role)s kontenjanı dolu (Maks: %(limit)s).") % 
                                    {'role': self.role.name, 'limit': capacity_template.capacity})
    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

class RecurringRule(BaseModel):
    # ISO-8601 standardına uygun (Pazartesi=1, Pazar=7)
    DAYS = [(1, _('Pazartesi')), (2, _('Salı')), (3, _('Çarşamba')), (4, _('Perşembe')), (5, _('Cuma')), (6, _('Cumartesi')), (7, _('Pazar'))]
    course_group = models.ForeignKey(CourseGroup, on_delete=models.CASCADE, related_name='recurring_rules')
    day_of_week = models.PositiveSmallIntegerField(choices=DAYS)
    start_time = models.TimeField()
    end_time = models.TimeField()
    room = models.ForeignKey(Room, on_delete=models.PROTECT, related_name='recurring_rules')

    def clean(self):
        super().clean()
        if self.start_time and self.end_time and self.start_time >= self.end_time:
            raise ValidationError(_("Bitiş saati başlangıçtan sonra olmalıdır."))

        # Salon Çakışma Kontrolü
        conflicts = RecurringRule.active_objects.filter(
            day_of_week=self.day_of_week, room=self.room,
            start_time__lt=self.end_time, end_time__gt=self.start_time
        ).exclude(id=self.id)
        if conflicts.exists():
            raise ValidationError(_("Salon bu saat aralığında başka bir kuralla çakışıyor."))

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    class Meta:
        verbose_name = _('Tekrarlama Kuralı')
        verbose_name_plural = _('Tekrarlama Kuralları')
        unique_together = ('course_group', 'day_of_week', 'start_time')
        ordering = ['day_of_week', 'start_time']

    def __str__(self):
        return f"{self.get_day_of_week_display()} {self.start_time}-{self.end_time} ({self.course_group.name})"

# -----------------------------------------------------------
# 4. SEANS MODELİ
# -----------------------------------------------------------

class Seance(BaseModel):
    class SeanceStatus(models.TextChoices):
        SCHEDULED = 'SCHEDULED', _('Planlandı')
        CANCELLED = 'CANCELLED', _('İptal')
        COMPLETED = 'COMPLETED', _('Tamamlandı')

    # İlişkiler
    course_group = models.ForeignKey(
        'CourseGroup', 
        on_delete=models.CASCADE, 
        related_name='seances',
        verbose_name=_('Kurs Grubu')
    )
    instructor = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.PROTECT, 
        related_name='seances',
        verbose_name=_('Eğitmen')
    )
    room = models.ForeignKey(
        'Room', 
        on_delete=models.PROTECT, 
        related_name='seances',
        verbose_name=_('Salon')
    )
    rule = models.ForeignKey(
        'RecurringRule', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        help_text=_('Bu seansın türetildiği kural (varsa).')
    )

    # Zaman ve Durum
    start_time = models.DateTimeField(_('Başlangıç Zamanı'))
    end_time = models.DateTimeField(_('Bitiş Zamanı'))
    status = models.CharField(
        max_length=20, 
        choices=SeanceStatus.choices, 
        default=SeanceStatus.SCHEDULED,
        verbose_name=_('Durum')
    )

    class Meta:
        verbose_name = _('Seans')
        verbose_name_plural = _('Seanslar')
        ordering = ['start_time']

    def __str__(self):
        return f"{self.course_group.name} | {self.instructor.get_full_name()} | {self.start_time.strftime('%d.%m %H:%M')}"

    def clean(self):
        """Detaylı Çakışma ve Zaman Denetimi"""
        super().clean()
        
        if not (self.start_time and self.end_time):
            return

        # 1. Mantıksal Zaman Kontrolü
        if self.start_time >= self.end_time:
            raise ValidationError({'end_time': _("Bitiş zamanı başlangıçtan sonra olmalıdır.")})

        # 2. Çakışma Denetimi (Sadece aktif planlanmış seanslar arasında)
        if self.status == self.SeanceStatus.SCHEDULED:
            # Zaman dilimi kesişen diğer seansları tek sorguda çek
            conflicts = Seance.objects.filter(
                status=self.SeanceStatus.SCHEDULED,
                start_time__lt=self.end_time,
                end_time__gt=self.start_time
            ).exclude(id=self.id).select_related('course_group', 'room', 'instructor')

            # Salon Çakışması
            room_conflict = conflicts.filter(room=self.room).first()
            if room_conflict:
                raise ValidationError({
                    'room': _(
                        "Bu salon dolu. Çakışan: %(group)s [%(start)s - %(end)s]"
                    ) % {
                        'group': room_conflict.course_group.name,
                        'start': room_conflict.start_time.strftime('%H:%M'),
                        'end': room_conflict.end_time.strftime('%H:%M'),
                    }
                })

            # Eğitmen Çakışması
            trainer_conflict = conflicts.filter(instructor=self.instructor).first()
            if trainer_conflict:
                raise ValidationError({
                    'instructor': _(
                        "Eğitmen %(name)s bu saatte başka bir seansla çakışıyor: %(group)s [%(start)s - %(end)s]"
                    ) % {
                        'name': self.instructor.get_full_name() or self.instructor.username,
                        'group': trainer_conflict.course_group.name,
                        'start': trainer_conflict.start_time.strftime('%H:%M'),
                        'end': trainer_conflict.end_time.strftime('%H:%M'),
                    }
                })

    def save(self, *args, **kwargs):
        # Her zaman clean metodunu çağırarak veri bütünlüğünü sağla
        self.full_clean()
        super().save(*args, **kwargs)
# -----------------------------------------------------------
# 5. KATILIM (ATTENDANCE) MODELİ
# -----------------------------------------------------------
class SeanceAttendance(models.Model):
    """
    Bir katılımcının (Attender) belirli bir seanstaki (Seance) durumunu takip eder.
    Hem grup üyelerini hem de dışarıdan (telafi/misafir) gelenleri yönetir.
    """
    class AttendanceStatus(models.TextChoices):
        BOOKED = 'BOOKED', _('Rezerve / Bekleniyor')
        ATTENDED = 'ATTENDED', _('Katıldı')
        NO_SHOW = 'NO_SHOW', _('Gelmedi')
        CANCELLED = 'CANCELLED', _('İptal Edildi')
        WAITING = 'WAITING', _('Bekleme Listesi')

    id = models.UUIDField(primary_key=True, default=uuid6.uuid7, editable=False)
    seance = models.ForeignKey('Seance', on_delete=models.CASCADE, related_name='attendances')
    attender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='seance_attendances')
    role = models.ForeignKey('ParticipationRole', on_delete=models.PROTECT, verbose_name=_('Seanstaki Rolü'))
    status = models.CharField(max_length=20, choices=AttendanceStatus.choices, default=AttendanceStatus.BOOKED)
    check_in_time = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, editable=False)
    updated_at = models.DateTimeField(auto_now=True)


    class Meta:
        verbose_name = _('Seans Katılımı')
        verbose_name_plural = _('Seans Katılımları')
        unique_together = ('seance', 'attender')

    def clean(self):
        super().clean()
        if not self.seance or not self.role:
            return

        # KONTENJAN DENETİMİ
        occupying_statuses = [self.AttendanceStatus.BOOKED, self.AttendanceStatus.ATTENDED, self.AttendanceStatus.NO_SHOW]
        
        if self.role.impacts_capacity and self.status in occupying_statuses:
            # Gruptaki kapasite şablonunu bul (Seansın bağlı olduğu gruptan referans alır)
            capacity_template = CourseGroupRoleCapacity.active_objects.filter(
                group=self.seance.course_group, 
                role=self.role
            ).first()

            if not capacity_template:
                # Eğer grupta o rol için hiç yer yoksa, dışarıdan da olsa o rolle kimse giremez
                raise ValidationError(_("Bu seansın grubunda %(role)s rolü için bir kontenjan tanımlanmamış.") % {'role': self.role.name})

            # FİİLİ DOLULUK (O andaki seansın salon durumu)
            current_count = SeanceAttendance.active_objects.filter(
                seance=self.seance,
                role=self.role,
                status__in=occupying_statuses
            ).exclude(id=self.id).count()

            if current_count >= capacity_template.capacity:
                raise ValidationError(_("%(role)s kontenjanı dolu (Maks: %(limit)s).") % 
                                     {'role': self.role.name, 'limit': capacity_template.capacity})

    def save(self, *args, **kwargs):
        # OTOMATİK ROL ATAMA MANTIĞI (Esnetilmiş)
        if not self.role_id:
            # Önce grupta üye mi diye bak
            member = GroupMember.objects.filter(
                group=self.seance.course_group, 
                user=self.attender
            ).first()
            
            if member:
                self.role = member.role
            else:
                # Grupta üye değilse ve rol de seçilmemişse hata ver (Dışarıdan geliyorsa rol seçilmeli)
                raise ValidationError(_("Bu katılımcı grubun üyesi değil. Lütfen bir katılım rolü seçiniz."))
        
        self.full_clean()
        super().save(*args, **kwargs)
