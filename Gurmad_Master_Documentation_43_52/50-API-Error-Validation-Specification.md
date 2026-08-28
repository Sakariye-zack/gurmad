# 50. API Error & Validation Specification

## Standard errors
400 Validation Error
401 Unauthenticated
403 Forbidden
404 Not Found
409 Conflict
422 Business Rule Violation
429 Rate Limited
500 Internal Server Error

## Financial conflicts
Duplicate payment, invalid amount, unsupported currency, invalid exchange rate, already-approved cashout and invalid reversal must return controlled errors.

## Validation
Validate required fields, data types, phone formats, amounts, dates, IDs, permissions and zone ownership.

## Response principle
Do not expose database internals, SQL text, secrets or sensitive provider details.
