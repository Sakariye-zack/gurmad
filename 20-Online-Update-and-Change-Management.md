# Online Update & Change Management

## Principle
The system is online and must be updated through controlled development and deployment.

## Environments
Development → Staging → Production.

## Process
Requirement → impact review → implementation → testing → staging → approval → production → verification.

## Database
Use versioned migrations. Do not manually modify production schema without a recorded change.

## Documentation
Update the relevant Markdown file and change log for every major feature, permission, API, database or workflow change.

## Code
Use Git. Keep deployment reproducible.
