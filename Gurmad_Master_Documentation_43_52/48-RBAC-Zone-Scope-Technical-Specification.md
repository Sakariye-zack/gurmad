# 48. RBAC & Zone Scope Technical Specification

## Authentication
JWT identifies the user.

## Authorization
Permission middleware checks whether the role can perform the requested action.

## Scope
After authentication, backend resolves company/zone/customer/task scope.

## Examples
Admin → all company data.
Zone Chairman → assigned zone.
Head of Cashiers → assigned zone cashiers/cashouts.
Cashier → assigned zone and customer portfolio.
Collector → assigned collection tasks.
Driver → assigned truck/routes.
Customer → own account.

## Security rule
Filtering only in React is insufficient. SQL/API queries must enforce scope.
