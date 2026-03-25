# backend/products/graphql/queries.py

import strawberry
import strawberry_django
from strawberry import relay
from typing import Optional
from .types import *


# --- QUERY (Connection & Node) ---

@strawberry.type
class ProductsQuery:
    # Tekil Node erişimleri
    discipline: Optional[DisciplineType] = relay.node()
    style: Optional[StyleType] = relay.node()
    level: Optional[LevelType] = relay.node()
    group_type: Optional[GroupTypeType] = relay.node()
    pricing_plan: Optional[PricingPlanType] = relay.node()
    package: Optional[PackageType] = relay.node()


    # Listeler (Relay Connections)
    disciplines: relay.ListConnection[DisciplineType] = strawberry_django.connection(filters=DisciplineFilter, order=DisciplineOrder)
    styles: relay.ListConnection[StyleType] = strawberry_django.connection(filters=StyleFilter, order=StyleOrder)
    levels: relay.ListConnection[LevelType] = strawberry_django.connection(filters=LevelFilter, order=LevelOrder)
    group_types: relay.ListConnection[GroupTypeType] = strawberry_django.connection(filters=GroupTypeFilter, order=GroupTypeOrder)
    pricing_plans: relay.ListConnection[PricingPlanType] = strawberry_django.connection(filters=PricingPlanFilter, order=PricingPlanOrder)
    packages: relay.ListConnection[PackageType] = strawberry_django.connection(filters=PackageFilter, order=PackageOrder)

    # --- ÖZEL / HIZLI SORGULAR (Shortcut Queries) ---
    
    @strawberry.field
    def active_packages(self) -> List[PackageType]:
        return models.Package.objects.filter(is_active=True).select_related(
            'discipline', 'style', 'level', 'group_type', 'pricing_plan'
        )

    @strawberry.field
    def active_disciplines(self) -> List[DisciplineType]:
        return models.Discipline.objects.filter(is_active=True)