import strawberry
import strawberry_django
from .. import models

# -----------------------------------------------------------
# 2. ORDERING
# -----------------------------------------------------------

@strawberry_django.order(models.Location)
class LocationOrder:
    name: strawberry.auto
    internal_code: strawberry.auto

@strawberry_django.order(models.Room)
class RoomOrder:
    name: strawberry.auto
    location: "LocationOrder"
    physical_capacity: strawberry.auto

@strawberry_django.order(models.ParticipationRole)
class ParticipationRoleOrder:
    name: strawberry.auto
    courses_staff: strawberry.auto

@strawberry_django.order(models.CourseGroup)
class CourseGroupOrder:
    name: strawberry.auto
    start_date: strawberry.auto
    end_date: strawberry.auto
    status: strawberry.auto

@strawberry_django.order(models.CourseGroupRoleCapacity)
class CourseGroupRoleCapacityOrder:
    capacity: strawberry.auto

@strawberry_django.order(models.GroupMember)
class GroupMemberOrder:
    # User'a göre sıralama yapmak için modeldeki user alanını referans alıyoruz
    user: strawberry.auto 
    is_primary: strawberry.auto

@strawberry_django.order(models.RecurringRule)
class RecurringRuleOrder:
    day_of_week: strawberry.auto
    start_time: strawberry.auto

@strawberry_django.order(models.Seance)
class SeanceOrder:
    start_time: strawberry.auto
    end_time: strawberry.auto
    status: strawberry.auto

@strawberry_django.order(models.SeanceAttendance)
class SeanceAttendanceOrder:
    created_at: strawberry.auto
    status: strawberry.auto