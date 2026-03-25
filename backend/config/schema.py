import strawberry
from strawberry_django.optimizer import DjangoOptimizerExtension
from users.graphql.queries import UsersQuery
from users.graphql.mutations import UsersMutation
from products.graphql.queries import ProductsQuery
from products.graphql.mutations import ProductsMutation
from courses.graphql.queries import CoursesQuery
from courses.graphql.mutations import CoursesMutation
from memberships.schema import MembershipsQuery, MembershipsMutation

# 1. Tüm Query sınıflarını burada topluyoruz
@strawberry.type
class Query(UsersQuery, ProductsQuery, CoursesQuery, MembershipsQuery):
    pass

# 2. Tüm Mutation sınıflarını burada topluyoruz
@strawberry.type
class Mutation(UsersMutation, ProductsMutation, CoursesMutation, MembershipsMutation):
    pass

# 3. Şemayı oluşturuyoruz
schema = strawberry.Schema(
    query=Query, 
    mutation=Mutation,
    extensions=[
        DjangoOptimizerExtension, # Veritabanı sorgularını optimize eder ve hataları yönetir
    ]
)