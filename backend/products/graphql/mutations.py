# backend/products/graphql/mutations.py

import strawberry
import strawberry_django
from strawberry_django import mutations
from .types import *
from .inputs import *

@strawberry.type
class ProductsMutation:
    # --- CREATE & UPDATE (Otomatik kalsın) ---
    create_discipline: DisciplineType = mutations.create(DisciplineInput)
    create_style: StyleType = mutations.create(StyleInput)
    create_level: LevelType = mutations.create(LevelInput)
    create_group_type: GroupTypeType = mutations.create(GroupTypeInput)
    create_pricing_plan: PricingPlanType = mutations.create(PricingPlanInput)
    create_package: PackageType = mutations.create(PackageInput)


    update_discipline: DisciplineType = mutations.update(DisciplineInput)
    update_style: StyleType = mutations.update(StyleInput)
    update_level: LevelType = mutations.update(LevelInput)
    update_group_type: GroupTypeType = mutations.update(GroupTypeInput)
    update_pricing_plan: PricingPlanType = mutations.update(PricingPlanInput)
    update_package: PackageType = mutations.update(PackageInput)

    # --- DELETE (Sarmalanmış Yapı) ---
    @strawberry_django.mutation
    def delete_discipline(self, id: relay.GlobalID) -> bool:
        return mutations.delete()(id)

    @strawberry_django.mutation
    def delete_style(self, id: relay.GlobalID) -> bool:
        return mutations.delete()(id)

    @strawberry_django.mutation
    def delete_level(self, id: relay.GlobalID) -> bool:
        return mutations.delete()(id)

    @strawberry_django.mutation
    def delete_group_type(self, id: relay.GlobalID) -> bool:
        return mutations.delete()(id)

    @strawberry_django.mutation
    def delete_pricing_plan(self, id: relay.GlobalID) -> bool:
        return mutations.delete()(id)

    @strawberry_django.mutation
    def delete_package(self, id: relay.GlobalID) -> bool:
        return mutations.delete()(id)