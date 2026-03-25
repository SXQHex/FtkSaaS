# Django Version

This project uses **Django 6.0**.

## Implications

- Django <5.x behavior MUST NOT be assumed.
- Async support is first-class.
- Deprecated APIs from Django 4.x and earlier should not be used.
- Settings, middleware, and ORM behavior follow Django 6.0 semantics.

## Agent Rules

- Always target Django 6.0 APIs.
- Do not generate backward-compatible or legacy patterns.
- Prefer modern Django patterns even if they differ from older tutorials.
