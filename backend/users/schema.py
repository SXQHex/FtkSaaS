# backend/profiles/schema.py
import strawberry
from .graphql.queries import UsersQuery
from .graphql.mutations import UsersMutation

# 1. Merkezi Query Sınıfı
@strawberry.type
class Query(UsersQuery):
    pass

# 2. Merkezi Mutation Sınıfı
@strawberry.type
class Mutation(UsersMutation):
    pass
