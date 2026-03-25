# backend/courses/graphql/queries.py
import strawberry
import strawberry_django
from strawberry import relay
from typing import Iterable, Optional
from datetime import date, datetime
from django.utils import timezone
from django.db.models import Q
from .. import models
from . import enums
from .types import *
from .filters import *
from .orders import *


@strawberry.type
class CoursesQuery:
    # -----------------------------------------------------------
    # 1. STANDART RELAY NODE SORGUSU
    # -----------------------------------------------------------
    node: relay.Node = relay.node()

    # -----------------------------------------------------------
    # 2. STANDART TEKİL SORGULAR (Auto-CRUD)
    # -----------------------------------------------------------
    location: Optional[LocationType] = strawberry_django.node()
    room: Optional[RoomType] = strawberry_django.node()
    participation_role: Optional[ParticipationRoleType] = strawberry_django.node()
    course_group: Optional[CourseGroupType] = strawberry_django.node()
    role_capacity: Optional[CourseGroupRoleCapacityType] = strawberry_django.node()
    group_member: Optional[GroupMemberType] = strawberry_django.node()
    recurring_rule: Optional[RecurringRuleType] = strawberry_django.node()
    seance: Optional[SeanceType] = strawberry_django.node()
    attendance: Optional[SeanceAttendanceType] = strawberry_django.node()

    # -----------------------------------------------------------
    # 3. STANDART LİSTE SORGULARI (Auto-CRUD)
    # -----------------------------------------------------------
    locations: relay.Connection[LocationType] = strawberry_django.connection(filters=LocationFilter, order=LocationOrder)
    rooms: relay.Connection[RoomType] = strawberry_django.connection(filters=RoomFilter, order=RoomOrder)
    participation_roles: relay.Connection[ParticipationRoleType] = strawberry_django.connection(filters=ParticipationRoleFilter, order=ParticipationRoleOrder)
    course_groups: relay.Connection[CourseGroupType] = strawberry_django.connection(filters=CourseGroupFilter, order=CourseGroupOrder)
    role_capacities: relay.Connection[CourseGroupRoleCapacityType] = strawberry_django.connection(filters=CourseGroupRoleCapacityFilter, order=CourseGroupRoleCapacityOrder)
    group_members: relay.Connection[GroupMemberType] = strawberry_django.connection(filters=GroupMemberFilter, order=GroupMemberOrder)
    recurring_rules: relay.Connection[RecurringRuleType] = strawberry_django.connection(filters=RecurringRuleFilter, order=RecurringRuleOrder)
    seances: relay.Connection[SeanceType] = strawberry_django.connection(filters=SeanceFilter, order=SeanceOrder)
    attendances: relay.Connection[SeanceAttendanceType] = strawberry_django.connection(filters=SeanceAttendanceFilter, order=SeanceAttendanceOrder)

    # -----------------------------------------------------------
    # 4. ÖZEL İŞ MANTIĞI SORGULARI (Custom Resolvers)
    # -----------------------------------------------------------
    @strawberry_django.connection(relay.Connection[CourseGroupType])
    def active_courses(self) -> Iterable[CourseGroupType]: 
        """Aktif ve bitmemiş kurs gruplarını döner."""
        return models.CourseGroup.objects.filter(
            status=enums.GroupStatusEnum.ACTIVE.value,
            end_date__gte=timezone.now().date(),
            is_active=True # Garantiye almak için
        )

    @strawberry_django.connection(relay.Connection[SeanceType])
    def daily_schedule(self, target_date: Optional[date] = None, location_id: Optional[relay.GlobalID] = None) -> Iterable[SeanceType]:
        """
        Belirli bir günün ve şubenin ders programını getirir.
        Gelecekteki operasyonel dashboard'lar için kritiktir.
        """
        date = target_date or timezone.now().date()
        queryset = models.Seance.active_objects.filter(
            start_time__date=date
        ).select_related('room', 'course_group', 'instructor')

        if location_id:
            queryset = queryset.filter(room__location__id=location_id.node_id)
            
        return queryset


    @strawberry_django.connection(relay.Connection[SeanceType], filters=SeanceFilter, order=SeanceOrder)
    def active_seances(self) -> Iterable[SeanceType]:
        """İptal edilmemiş ve aktif seansları Connection olarak döner."""
        return models.Seance.active_objects.filter(
            status=models.Seance.SeanceStatus.SCHEDULED
        )

    @strawberry_django.connection(relay.Connection[SeanceType], filters=SeanceFilter, order=SeanceOrder)
    def my_schedule(self, info: strawberry.Info) -> Iterable[SeanceType]:
        """Giriş yapmış kullanıcının seanslarını Connection olarak döner."""
        user = info.context.request.user
        if not user or not user.is_authenticated:
            return models.Seance.objects.none()
        
        return models.Seance.active_objects.filter(
            Q(instructor=user) | Q(attendances__attender=user)
        ).distinct()
    
    @strawberry_django.connection(relay.Connection[SeanceAttendanceType])
    def my_upcoming_attendances(self, info: strawberry.Info) -> Iterable[SeanceAttendanceType]:
        """Giriş yapmış olan kullanıcının gelecekteki ders katılım listesini getirir."""
        user = info.context.request.user
        if not user.is_authenticated:
            return models.SeanceAttendance.objects.none()
            
        return models.SeanceAttendance.objects.filter(
            attender=user,
            seance__start_time__gte=timezone.now(),
            status=enums.AttendanceStatusEnum.BOOKED
        ).order_by('seance__start_time')

    @strawberry.field
    def check_room_availability( self, room_id: relay.GlobalID, start_time: datetime, end_time: datetime ) -> bool:
        """
        Belirli bir zaman diliminde salonun müsait olup olmadığını döner.
        Planlama ekranları için yardımcı sorgu.
        """
        conflicting_seances = models.Seance.active_objects.filter(
            room_id=room_id.node_id,
            start_time__lt=end_time,
            end_time__gt=start_time
        ).exists()
        
        return not conflicting_seances
