# Construction ERP — Full API Reference

**Base URL:** `http://localhost:3000/api/v1`
**Auth:** `Authorization: Bearer <token>`
**Content-Type:** `application/json`

---

## Authentication

### POST /auth/login
Login and receive tokens.

**Request:**
```json
{ "email": "admin@erp.com", "password": "Admin@123" }
```
**Response:**
```json
{
  "success": true,
  "data": {
    "user": { "id": "...", "email": "...", "role": "ADMIN", "firstName": "Admin" },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

### POST /auth/refresh
Refresh the access token.

**Request:**
```json
{ "refreshToken": "eyJ..." }
```

### POST /auth/logout
Invalidates the refresh token. Pass `X-Refresh-Token` header.

---

## Projects

### GET /projects
List all projects with pagination.

**Query params:** `page`, `pageSize`, `search`, `status`

**Status values:** `PLANNING`, `ACTIVE`, `ON_HOLD`, `COMPLETED`, `CANCELLED`

### POST /projects
Create a new project. *(Admin only)*

**Request:**
```json
{
  "name": "Mumbai Highway Project",
  "clientId": "client-uuid",
  "location": "Mumbai, Maharashtra",
  "budget": 45000000,
  "startDate": "2024-01-15",
  "endDate": "2025-12-31",
  "description": "..."
}
```

---

## Expenses

### GET /expenses
**Query params:** `projectId`, `category`, `approvalStatus`, `startDate`, `endDate`

**Category values:** `MATERIAL`, `LABOUR`, `FUEL`, `MACHINERY`, `TRANSPORTATION`, `MISCELLANEOUS`

### POST /expenses/[id]/approve
Approve or reject an expense. *(Admin/Accountant)*

**Request:**
```json
{ "status": "APPROVED", "remarks": "Verified and approved" }
```

---

## Inventory

### POST /inventory/stock-in
Record incoming stock.

**Request:**
```json
{
  "projectId": "proj-uuid",
  "materialId": "mat-uuid",
  "quantity": 500,
  "rate": 370,
  "notes": "Delivery from vendor",
  "referenceNo": "PO-2024-00001"
}
```

### POST /inventory/stock-out
Issue stock from inventory.

**Request:**
```json
{
  "projectId": "proj-uuid",
  "materialId": "mat-uuid",
  "quantity": 100,
  "notes": "Used for pier foundation"
}
```

---

## Purchase Orders

### POST /purchase-orders
Create a purchase order.

**Request:**
```json
{
  "projectId": "proj-uuid",
  "vendorId": "vendor-uuid",
  "deliveryDate": "2024-02-15",
  "items": [
    { "materialId": "mat-uuid", "quantity": 500, "unit": "Bags", "rate": 370, "taxPct": 18 }
  ]
}
```

### POST /purchase-orders/[id]/submit
Submit PO for approval.

### POST /purchase-orders/[id]/approve
Approve or reject PO. *(Admin only)*

```json
{ "status": "APPROVED" }
```

### POST /purchase-orders/[id]/goods-receipt
Record goods received (updates inventory automatically).

```json
{
  "receiptDate": "2024-02-16",
  "items": [{ "materialId": "mat-uuid", "quantity": 500 }]
}
```

---

## Truck Entries

### POST /truck-entries
```json
{
  "projectId": "proj-uuid",
  "date": "2024-02-10",
  "time": "09:30",
  "truckNumber": "MH-04-XY-1234",
  "driverName": "Ramesh Kumar",
  "vendorId": "vendor-uuid",
  "materialId": "mat-uuid",
  "grossWeight": 22.5,
  "tareWeight": 8.2,
  "notes": "Crushed stone delivery"
}
```
Net weight is automatically computed.

---

## Daily Reports

### POST /daily-reports
Supports offline mode via `isOffline: true` flag.

```json
{
  "projectId": "proj-uuid",
  "reportDate": "2024-02-10",
  "weather": "SUNNY",
  "workDone": "Pier P-12 concrete pouring completed",
  "completionPct": 38.5,
  "notes": "Good progress",
  "isOffline": false,
  "labourEntries": [
    { "labourType": "Concrete Workers", "count": 25 },
    { "labourType": "Steel Fixers", "count": 18 }
  ]
}
```

**Weather values:** `SUNNY`, `CLOUDY`, `RAINY`, `FOGGY`, `STORMY`

### POST /daily-reports/sync
Bulk sync offline reports.

```json
{
  "reports": [
    { "projectId": "...", "reportDate": "...", "workDone": "...", ... }
  ]
}
```

---

## Tasks

### POST /tasks
```json
{
  "projectId": "proj-uuid",
  "title": "Complete pier foundation",
  "description": "...",
  "status": "TODO",
  "priority": "HIGH",
  "assigneeId": "user-uuid",
  "dueDate": "2024-02-20"
}
```

**Status values:** `TODO`, `IN_PROGRESS`, `REVIEW`, `DONE`, `BLOCKED`

**Priority values:** `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`

---

## Analytics

### GET /analytics/dashboard
Returns: total projects, expenses, budget utilization, pending approvals, monthly trend.

### GET /analytics/expenses
**Query params:** `projectId`, `year`

Returns: by category, by month, top vendors.

### GET /analytics/budget
Returns: all projects with budget vs actual spend.

---

## Error Codes

| Code | Meaning |
|------|---------|
| 400  | Bad Request - Invalid input |
| 401  | Unauthorized - Missing or invalid token |
| 403  | Forbidden - Insufficient permissions |
| 404  | Not Found - Resource doesn't exist |
| 409  | Conflict - Duplicate record |
| 429  | Too Many Requests - Rate limit exceeded |
| 500  | Internal Server Error |

**Error response format:**
```json
{
  "success": false,
  "message": "Error description",
  "errors": ["Field-level error messages"]
}
```
