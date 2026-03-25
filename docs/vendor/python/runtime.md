# Python Runtime

This project runs on **Python 3.14.2**.

## Key Implications

- Pattern matching, typing, and async features follow Python ≥3.13 semantics.
- Legacy Python 3.8–3.10 behavior should NOT be assumed.
- Type annotations are expected to be fully modern (PEP 695+ mindset).

## Virtual Environment

- A local `venv` is used.
- All backend code assumes execution inside this virtual environment.

## Dependency Management

- Dependencies are managed via `pip`.
- Exact versions matter; do not assume backward compatibility.
- Avoid introducing packages that rely on deprecated stdlib APIs.

## Async Expectations

- Async code is allowed and encouraged where supported by Django.
- Blocking I/O inside async contexts must be avoided.

## Agent Rules

- When writing Python code:
  - Target Python 3.14+ syntax.
  - Prefer explicit typing.
  - Avoid legacy compatibility patterns.
