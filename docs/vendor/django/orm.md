# Django ORM Usage

This project uses Django ORM as the primary data access layer.

## General Principles

- ORM is preferred over raw SQL.
- Models must be explicit and readable.
- Avoid overly complex querysets.

## Models

- All models must subclass `models.Model`.
- Use explicit field types.
- Avoid implicit defaults.

## Relationships

- ForeignKey, OneToOneField, and ManyToManyField are used normally.
- Always specify `related_name`.
- Avoid circular dependencies between apps.

## Querying

- Use `select_related` and `prefetch_related` where appropriate.
- Avoid N+1 query patterns.
- Annotate queries only when necessary.

## Transactions

- Use `transaction.atomic()` for multi-step writes.
- Do not rely on implicit transaction behavior.

## Agent Rules

- Generated ORM code must be performant by default.
- Avoid clever but unreadable query tricks.
- Prefer clarity over micro-optimizations.
