# 29. Permission Matrix
| Role | Company | Zone | Customers | Collection | Payments | Cashout | Accounting | GPS | Reports |
|---|---|---|---|---|---|---|---|---|---|
| Admin | All | All | Full | Full | Full | Full | Full | Full | Full |
| Management | View | All | View | View | View | View | View | View | Full |
| Zone Chairman | Zone | Own | Manage | Manage | View | View | View | Zone | Zone |
| Zone Accountant | Zone | Own | View | View | View | View | Manage/View | Zone | Zone |
| Head of Cashiers | Zone | Own | Assigned | View | Manage | Manage | View | Zone | Zone |
| Cashier | Zone | Own | Assigned | View | Manage | Submit | No accounting | Limited | Limited |
| Collector | Task | Own task | Assigned houses | Manage | None | None | None | Route | Task |
| Driver | Task | Own | Route houses | View | None | None | None | Own truck | Task |
| Customer | Own | Own | Own | Own | Own | None | None | Own location if enabled | Own |

Backend must enforce permissions; UI hiding alone is not security.
