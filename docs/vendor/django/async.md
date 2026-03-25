# Async and Concurrency

Django 6.0 async capabilities are enabled and allowed.

## Async Views

- Async views are permitted.
- Blocking operations must not be used inside async views.
- Database access inside async views must follow Django's async guidelines.

## Background Tasks

- Django is not used as a background task runner.
- Long-running jobs should be delegated elsewhere.

## I/O Rules

- Avoid blocking network or file I/O in async contexts.
- Explicitly document any async usage.

## Agent Rules

- Do not generate async code unless it is justified.
- Never mix sync and async patterns incorrectly.
- Prefer sync code unless async brings clear benefits.
