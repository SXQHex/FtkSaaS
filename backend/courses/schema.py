# backend/profiles/schema.py
import strawberry
from .graphql.queries import CoursesQuery 
from .graphql.mutations import CoursesMutation

# 1. Merkezi Query Sınıfı
@strawberry.type
class Query(CoursesQuery):
    pass

# 2. Merkezi Mutation Sınıfı
@strawberry.type
class Mutation(CoursesMutation):
    pass
