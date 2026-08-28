# 42. Existing System Gap Analysis

## Purpose
Compare the current Gurmad implementation with the approved requirements before modifying production.

| Area | Current baseline | Required target | Action |
|---|---|---|---|
| Navigation | activeView SPA | Keep and organize | Refactor |
| Zones | Existing | Multi-resource zones | Verify/modify |
| Trucks | Existing | Multiple per zone | Modify if needed |
| Drivers | Existing | Multiple per zone | Modify if needed |
| Collectors | Existing | 7+ per zone + batches | Modify |
| Cashiers | Existing | 7+ per zone + portfolios | Modify |
| Collection | Existing | Capacity-based batches + history | Major improvement |
| Payments | Existing | Cash/ZAAD/eDahab + partial | Verify/improve |
| Debt | Existing | Full outstanding workflow | Improve |
| Cashout | Existing | Approval/sign/upload/archive | Improve |
| Accounting | Existing/partial | Full accounting | Major improvement |
| Map | Existing | Houses + routes + live trucks | Improve |
| Documents | Existing/partial | Branded document lifecycle | Improve |
| Reports | Existing | Daily to annual + statements | Improve |
| Security | Existing | Backend-enforced scope | Audit |

## Audit method
For every gap record: current behavior, target behavior, database impact, API impact, UI impact, priority, owner and test case.

## Priority
P0 = financial/security/data integrity.  
P1 = core operations.  
P2 = usability/reporting.  
P3 = future enhancement.
