# backend/profiles/schema.py
import strawberry
from .graphql.queries import ProductsQuery 
from .graphql.mutations import ProductsMutation

# 1. Merkezi Query Sınıfı
@strawberry.type
class Query(ProductsQuery):
    pass

# 2. Merkezi Mutation Sınıfı
@strawberry.type
class Mutation(ProductsMutation):
    pass
