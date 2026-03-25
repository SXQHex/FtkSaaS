import strawberry
from strawberry import relay, UNSET
from django.core.exceptions import ValidationError
from django.db import transaction

from . import inputs, types, unions
from .. import models

# -----------------------------------------------------------
# MERKEZİ MANTIK (Helper Functions)
# -----------------------------------------------------------

def apply_and_validate(instance, input_data, info=None):
    """PATCH mantığıyla veriyi modele işler ve full_clean() tetikler."""
    # input_data bir Strawberry input objesidir, vars() ile dict'e çevrilir
    data_dict = vars(input_data)
    
    for field, value in data_dict.items():
        # ID'yi güncelleme, geri kalan UNSET olmayan her şeyi işle
        if value is not UNSET and field != "id":
            # Relay GlobalID çözümleme
            if isinstance(value, relay.GlobalID):
                resolved_node = value.resolve_node(info)
                setattr(instance, field, resolved_node)
            # Enum değerlerini işle (enum.value ile integer değerini al)
            elif hasattr(value, 'value'):
                setattr(instance, field, value.value)
            else:
                setattr(instance, field, value)
    
    instance.full_clean()
    instance.save()
    return instance

def get_error(e) -> unions.MutationError:
    """ValidationError'ı merkezi MutationError yapısına dönüştürür."""
    if hasattr(e, 'message_dict'):
        # İlk hata mesajını döndür
        field = list(e.message_dict.keys())[0]
        message = e.message_dict[field][0]
        return unions.MutationError(message=str(message), field=str(field), code="validation_error")
    return unions.MutationError(message=str(e), code="error")

def perform_delete(id: relay.GlobalID, info=None):
    """Soft delete destekli silme işlemi."""
    instance = id.resolve_node(info)
    if not instance:
        return unions.MutationError(message="Kayıt bulunamadı", field="id", code="not_found")
    
    # Modelde is_active alanı varsa pasife çek, yoksa fiziksel sil
    if hasattr(instance, 'is_active'):
        instance.is_active = False
        instance.save()
    else:
        instance.delete()
    return None

# -----------------------------------------------------------
# MUTATION CLASS
# -----------------------------------------------------------

@strawberry.type
class CoursesMutation:
    
    # --- 1. LOCATION ---
    @strawberry.mutation
    def create_location(self, info: strawberry.Info, data: inputs.LocationInput) -> unions.LocationResponse:
        try: return apply_and_validate(models.Location(), data, info)
        except ValidationError as e: return get_error(e)

    @strawberry.mutation
    def update_location(self, info: strawberry.Info, data: inputs.LocationInput) -> unions.LocationResponse:
        try:
            instance = data.id.resolve_node(info)
            return apply_and_validate(instance, data, info)
        except ValidationError as e: return get_error(e)

    @strawberry.mutation
    def delete_location(self, info: strawberry.Info, id: relay.GlobalID) -> unions.LocationResponse:
        err = perform_delete(id, info)
        return err if err else unions.MutationError(message="Başarıyla silindi", code="deleted")

    # --- 2. ROOM ---
    @strawberry.mutation
    def create_room(self, info: strawberry.Info, data: inputs.RoomInput) -> unions.RoomResponse:
        try: return apply_and_validate(models.Room(), data, info)
        except ValidationError as e: return get_error(e)

    @strawberry.mutation
    def update_room(self, info: strawberry.Info, data: inputs.RoomInput) -> unions.RoomResponse:
        try: return apply_and_validate(data.id.resolve_node(info), data, info)
        except ValidationError as e: return get_error(e)

    @strawberry.mutation
    def delete_room(self, info: strawberry.Info, id: relay.GlobalID) -> unions.RoomResponse:
        err = perform_delete(id, info); return err if err else unions.MutationError(message="Silindi", code="deleted")

    # --- 3. PARTICIPATION ROLE ---
    @strawberry.mutation
    def create_participation_role(self, info: strawberry.Info, data: inputs.ParticipationRoleInput) -> unions.ParticipationRoleResponse:
        try: return apply_and_validate(models.ParticipationRole(), data, info)
        except ValidationError as e: return get_error(e)

    @strawberry.mutation
    def update_participation_role(self, info: strawberry.Info, data: inputs.ParticipationRoleInput) -> unions.ParticipationRoleResponse:
        try: return apply_and_validate(data.id.resolve_node(info), data, info)
        except ValidationError as e: return get_error(e)

    @strawberry.mutation
    def delete_participation_role(self, info: strawberry.Info, id: relay.GlobalID) -> unions.ParticipationRoleResponse:
        err = perform_delete(id, info); return err if err else unions.MutationError(message="Silindi", code="deleted")

    # --- 4. COURSE GROUP ---
    @strawberry.mutation
    def create_course_group(self, info: strawberry.Info, data: inputs.CourseGroupInput) -> unions.CourseGroupResponse:
        try: return apply_and_validate(models.CourseGroup(), data, info)
        except ValidationError as e: return get_error(e)

    @strawberry.mutation
    def update_course_group(self, info: strawberry.Info, data: inputs.CourseGroupInput) -> unions.CourseGroupResponse:
        try: return apply_and_validate(data.id.resolve_node(info), data, info)
        except ValidationError as e: return get_error(e)

    @strawberry.mutation
    def delete_course_group(self, info: strawberry.Info, id: relay.GlobalID) -> unions.CourseGroupResponse:
        err = perform_delete(id, info); return err if err else unions.MutationError(message="Silindi", code="deleted")

    # --- 5. ROLE CAPACITY ---
    @strawberry.mutation
    def create_role_capacity(self, info: strawberry.Info, data: inputs.RoleCapacityInput) -> unions.RoleCapacityResponse:
        try: return apply_and_validate(models.CourseGroupRoleCapacity(), data, info)
        except ValidationError as e: return get_error(e)

    @strawberry.mutation
    def update_role_capacity(self, info: strawberry.Info, data: inputs.RoleCapacityInput) -> unions.RoleCapacityResponse:
        try: return apply_and_validate(data.id.resolve_node(info), data, info)
        except ValidationError as e: return get_error(e)

    @strawberry.mutation
    def delete_role_capacity(self, info: strawberry.Info, id: relay.GlobalID) -> unions.RoleCapacityResponse:
        err = perform_delete(id, info); return err if err else unions.MutationError(message="Silindi", code="deleted")

    # --- 6. GROUP MEMBER ---
    @strawberry.mutation
    def create_group_member(self, info: strawberry.Info, data: inputs.GroupMemberInput) -> unions.GroupMemberResponse:
        try: return apply_and_validate(models.GroupMember(), data, info)
        except ValidationError as e: return get_error(e)

    @strawberry.mutation
    def update_group_member(self, info: strawberry.Info, data: inputs.GroupMemberInput) -> unions.GroupMemberResponse:
        try: return apply_and_validate(data.id.resolve_node(info), data, info)
        except ValidationError as e: return get_error(e)

    @strawberry.mutation
    def delete_group_member(self, info: strawberry.Info, id: relay.GlobalID) -> unions.GroupMemberResponse:
        err = perform_delete(id, info); return err if err else unions.MutationError(message="Silindi", code="deleted")

    # --- 7. RECURRING RULE ---
    @strawberry.mutation
    def create_recurring_rule(self, info: strawberry.Info, data: inputs.RecurringRuleInput) -> unions.RecurringRuleResponse:
        try: return apply_and_validate(models.RecurringRule(), data, info)
        except ValidationError as e: return get_error(e)

    @strawberry.mutation
    def update_recurring_rule(self, info: strawberry.Info, data: inputs.RecurringRuleInput) -> unions.RecurringRuleResponse:
        try: return apply_and_validate(data.id.resolve_node(info), data, info)
        except ValidationError as e: return get_error(e)

    @strawberry.mutation
    def delete_recurring_rule(self, info: strawberry.Info, id: relay.GlobalID) -> unions.RecurringRuleResponse:
        err = perform_delete(id, info); return err if err else unions.MutationError(message="Silindi", code="deleted")

    # --- 8. SEANCE ---
    @strawberry.mutation
    @transaction.atomic
    def create_seance(self, info: strawberry.Info, data: inputs.SeanceInput) -> unions.SeanceResponse:
        try: return apply_and_validate(models.Seance(), data, info)
        except ValidationError as e: return get_error(e)

    @strawberry.mutation
    @transaction.atomic
    def update_seance(self, info: strawberry.Info, data: inputs.SeanceInput) -> unions.SeanceResponse:
        try: return apply_and_validate(data.id.resolve_node(info), data, info)
        except ValidationError as e: return get_error(e)

    @strawberry.mutation
    def delete_seance(self, info: strawberry.Info, id: relay.GlobalID) -> unions.SeanceResponse:
        err = perform_delete(id, info); return err if err else unions.MutationError(message="Silindi", code="deleted")

    # --- 9. ATTENDANCE ---
    @strawberry.mutation
    def create_attendance(self, info: strawberry.Info, data: inputs.AttendanceInput) -> unions.AttendanceResponse:
        try: return apply_and_validate(models.SeanceAttendance(), data, info)
        except ValidationError as e: return get_error(e)

    @strawberry.mutation
    def update_attendance(self, info: strawberry.Info, data: inputs.AttendanceInput) -> unions.AttendanceResponse:
        try: return apply_and_validate(data.id.resolve_node(info), data, info)
        except ValidationError as e: return get_error(e)

    @strawberry.mutation
    def delete_attendance(self, info: strawberry.Info, id: relay.GlobalID) -> unions.AttendanceResponse:
        err = perform_delete(id, info); return err if err else unions.MutationError(message="Silindi", code="deleted")