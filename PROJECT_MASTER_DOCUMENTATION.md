# VECTO LOGISTICS: B2B & 3PL POD-TO-CASH SETTLEMENT PLATFORM
## Comprehensive Architecture, Functional Logic, Domain Workflows, API Reference, and Agent Improvement Roadmap

---

## 1. Executive Summary & Platform Identity

### 1.1 What is this Platform?
**Vecto Logistics** is an enterprise-grade, multi-tenant **"Proof of Delivery (POD) to Cash"** dispatch, audit, and invoice settlement platform engineered specifically for **B2B logistics carriers, third-party logistics (3PL) providers, shippers (clients), and fleet operators**.

In commercial freight ecosystems (particularly in India and emerging freight corridors), physical paper Lorry Receipts (LRs), unmonitored cash floats, disputed detention hours, delayed gate stamps, and manual reconciliation between consignees and dispatchers create massive friction:
- **High Days Sales Outstanding (DSO)**: Carrier invoices take 45–90 days to settle due to missing or illegible physical POD receipts.
- **Financial Leakage**: Discrepancies between driver fuel/cash advances, Toll/FASTag deductions, and Cash-on-Delivery (COD) collections.
- **Invoice Discarding**: Enterprise clients frequently reject entire invoices over a single damaged pallet or short shipment instead of settling uncontested line items.

### 1.2 Core Solution
This platform establishes a single, auditable digital thread across seven distinct operational personas:
1. **Dispatch Operations**: Live fleet oversight, cash/fuel float disbursement, and End-of-Day (EOD) terminal reconciliations.
2. **Driver Mobility**: Glare-resistant mobile web HUD, turn-by-turn routing, camera-based LR capture, and glass digital signatures.
3. **Internal Audit Desk**: 50/50 dual-pane visual inspection comparing physical PODs against GPS telematics and odometer metrics.
4. **Finance & Accounts**: Rate card engine, accessorial fee computation, automated Indian GST (18% SAC 996511) tax invoice generation.
5. **Client AP Portal**: External enterprise shipper dashboard to view invoices, inspect digital delivery stamps, raise itemized line-item disputes, and release payments.
6. **3PL Vendor Portal**: Subcontracted transporter portal to view assigned trips, verify payout tariffs, and submit settlements.
7. **System Administration**: Multi-tenant identity governance, password policy enforcement, and master data registries.

---

## 2. Full System Architecture & Tech Stack

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   VECTO APPLICATION ECOSYSTEM                                     │
└───────────────────────────────────────────────────────────────────────────────────────────────────┘

   [Next.js 14 Frontend] (:3000)                               [NestJS Backend API] (:3001)
   ┌──────────────────────────────────────────────┐            ┌────────────────────────────────────┐
   │ • App Router (app/*)                         │            │ • Modular REST Controller Pattern  │
   │ • Tailwind CSS + Radix UI (shadcn)           │            │ • ValidationPipe (Joi + class-val) │
   │ • Edge Route Guard (middleware.ts / jose)    │   HTTP     │ • TenantInterceptor (Org Scoping)  │
   │ • HTML5 Canvas Touch Signing Engine          │ ─────────▶ │ • Argon2 Hash + JWT (Access+Refresh)│
   │ • Dynamic Client-Side Math / Reconciler      │   JSON     │ • Rate Card Resolution Service     │
   │ • MSW (Mock Service Worker) for offline dev  │            │ • S3 / MinIO Storage Engine        │
   └──────────────────────────────────────────────┘            └─────────────────┬──────────────────┘
                                                                                 │
                                                                                 │ Prisma ORM 6.x
                                                                                 ▼
                                                               ┌────────────────────────────────────┐
                                                               │ • PostgreSQL Database (:5432)      │
                                                               │   (Native or Embedded PG 18)       │
                                                               │ • Multi-Tenant Foreign Key Tree    │
                                                               │ • S3 / MinIO Bucket (vecto-pods)   │
                                                               └────────────────────────────────────┘
```

### 2.1 Frontend Architecture
- **Framework**: Next.js 14.2 (React 18, TypeScript 5.x) using the **App Router** (`app/` directory).
- **Styling & Design System**: Tailwind CSS with enterprise color palettes:
  - `void`: Dark background slate (`#0B0F19`)
  - `royal`: Primary deep indigo/blue (`#2563EB` / `#1D4ED8`)
  - `turquoise`: Success/live tracking accent (`#06B6D4` / `#10B981`)
  - `magenta`: Danger / Discrepancy / Logout highlight (`#F43F5E`)
  - `platinum`: Clean neutral slate (`#F8FAFC` / `#E2E8F0`)
- **UI Components**: Built using Radix UI primitives (`shadcn/ui` style): `Dialog`, `Table`, `Card`, `Badge`, `Checkbox`, `Tabs`, `Separator`, `ScrollArea`, `Input`, `Textarea`.
- **Icons**: Standardized vector iconography via `lucide-react`.
- **Edge Middleware (`middleware.ts`)**:
  - Intercepts protected route groups (`/dispatch`, `/driver`, `/audit`, `/accounts`, `/client-portal`, `/vendor-portal`, `/admin`).
  - Cryptographically verifies the `vecto_access_token` cookie using `jose` with `JWT_SECRET`.
  - Redirects unauthenticated or role-mismatched requests to `/login?from=<origin>` with zero layout flash.
- **Offline Mock Capability**: Includes MSW (`mocks/browser.ts`, `mocks/handlers.ts`) activated when `NEXT_PUBLIC_USE_MOCKS="true"`.

### 2.2 Backend Architecture
- **Framework**: NestJS 10.x running on Node.js (v18+ to v24+).
- **Language**: TypeScript with strict typing.
- **Database Access**: **Prisma ORM 6.x** targeting PostgreSQL.
- **Multi-Tenancy Engine**:
  - Implemented via `TenantInterceptor` and `PrismaService` client extensions.
  - Organization ID (`orgId`) extracted from verified JWT payload and propagated through `AsyncLocalStorage` context (`tenant.context.ts`).
  - Automatic injection of `organizationId` into all database queries for models registered in `scoped-models.ts`.
- **Storage Subsystem**: S3-compatible object storage via `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`. Supports AWS S3, MinIO, or Supabase Storage for storing images and PDFs with pre-signed upload URLs and SHA-256 validation.
- **Embedded Database Automation (`backend/start-with-db.js`)**:
  - Integrates `embedded-postgres` so the complete backend, database, migrations, and seeds can run with zero external Docker or local PostgreSQL installations required.

---

## 3. The 7 Roles & Security Model

The system enforces strict Role-Based Access Control (RBAC). A user account belongs to an `Organization` and is assigned exactly one `Role`.

### 3.1 Role Directory & Seed Credentials
All pre-seeded demo accounts share the password: `Enterprise@2026`.

| Role Identifier | Default Email | Portal URL | Primary Responsibility |
| :--- | :--- | :--- | :--- |
| `ADMIN` | `admin@vectologistics.in` | `/admin` | Tenant master data, users, vehicles, drivers, rate cards, system settings. |
| `DISPATCH_MANAGER` | `dispatch@vectologistics.in` | `/dispatch` | Fleet dispatching, trip monitoring, cash/fuel advances, and EOD terminal close. |
| `DRIVER` | `driver.rajesh@vectologistics.in` | `/driver` | Mobile HUD navigation, physical LR photo capture, digital sign, COD collection. |
| `AUDITOR` | `audit.lead@vectologistics.in` | `/audit` | 50/50 split-screen POD inspection, GPS vs Odometer checks, gate verification. |
| `ACCOUNTS` | `billing.finance@vectologistics.in` | `/accounts` | Unbilled trip queue, GST tax calculations (SAC 996511), invoice generation, AR ledger. |
| `CLIENT_AP` | `ap.payments@metro-wholesale.in` | `/client-portal` | External shipper invoice verification, inline line-item dispute filing, payments. |
| `VENDOR_3PL` | `partner@3pl-vendor.in` | `/vendor-portal` | Subcontracted transporter payout tracking, settlement submission, payment receipts. |

### 3.2 Authentication & Token Flow
1. **Login (`POST /api/v1/auth/login`)**:
   - Accepts `{ email, password }`.
   - Validates user status (`ACTIVE`), checks lockout timestamps (`lockedUntil`).
   - Verifies password using **Argon2id**.
   - Increments failed login count on failure; locks account for 15 minutes after 5 consecutive failures.
   - On success: Issues a 15-minute signed JWT Access Token and an HttpOnly Refresh Token.
2. **Access Token Payload**:
   ```json
   {
     "sub": "61753ff0-2797-40f9-ab2b-9c65c3f1e000",
     "email": "dispatch@vectologistics.in",
     "role": "DISPATCH_MANAGER",
     "displayId": "DSP-01",
     "hubName": "Bhiwandi Hub #4",
     "orgId": "00000000-0000-0000-0000-000000000001",
     "permissions": ["trips:read", "trips:create", "trips:assign", ...],
     "clientId": null,
     "exp": 1793024561
   }
   ```
3. **Session Cookie**: Stored in `vecto_access_token` cookie (`SameSite=Lax`, `max-age=900` for 15 minutes).
4. **Token Refresh (`POST /api/v1/auth/refresh`)**:
   - Implements refresh token family rotation. If a revoked token is reused, the entire token family is immediately invalidated to prevent replay attacks.
5. **5-Rule Enterprise Password Policy** (enforced on `/invite/accept`):
   - Length $\ge 10$ characters
   - $\ge 1$ Uppercase letter (`[A-Z]`)
   - $\ge 1$ Lowercase letter (`[a-z]`)
   - $\ge 1$ Number (`[0-9]`)
   - $\ge 1$ Special symbol (`[!@#$%^&*(),.?":{}|<>]`)

---

## 4. End-to-End Business Logic & Operational Workflows

The lifecycle of a shipment travels through six coordinated stages:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   THE 6-STAGE SHIPMENT LIFECYCLE                                 │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘

 [Stage 1: Dispatch] ──▶ [Stage 2: Execution & POD] ──▶ [Stage 3: EOD Reconciliation]
  • Create Trip           • Driver Start Shift           • Log Tolls, Fuel, Bhatta
  • Assign Vehicle/Driver • Turn-by-Turn Nav            • Reconcile Actual COD Cash
  • Disburse Cash Advance • Camera LR Photo Capture     • Calculate Float Variance (Δ)
  • Record Start Odometer • Glass Sign on Touchscreen   • Close Shift at Hub Terminal
            │
            ▼
 [Stage 4: Internal Audit] ──▶ [Stage 5: Billing & Invoicing] ──▶ [Stage 6: Settlement & Payment]
  • 50/50 Dual Pane View        • Unbilled Trips Queue             • Client AP Deep Dive Review
  • GPS vs Odo Variance Check   • Rate Card Pricing Engine         • Inline Line-Item Dispute Flag
  • Physical Stamp Verification • Accessorial Charges (Tolls)      • Direct Approval / Debit Note
  • 5-Gate Checklist Approval   • 18% GST (SAC 996511) Tax Inv     • Payment Gateway / Bank Clear
```

---

### Stage 1: Dispatch Control Tower (`/dispatch`)
- **Fleet Grid**: Live monitoring of active trips (`TRP-YYYYMM-XXXX`) displaying vehicle registration, driver contact, corridor, live odometer, and current status (`ASSIGNED`, `IN_PROGRESS`, `DELIVERED`).
- **Driver Cash Advances**: Dispatchers record cash handed to drivers for en-route expenses (fuel, highway tolls, daily driver allowance / *bhatta*).
- **Expense Logging**: Interim expenses can be recorded in real-time or during mid-route stops.

---

### Stage 2: Driver Mobile App (`/driver`)
- **Outdoor Touch Interface**: Designed for in-cab operation with large buttons, high-contrast dark status bar, and glove-friendly touch targets.
- **Trip Navigation**: Real-time HUD showing corridor (e.g. *Bhiwandi to Whitefield, Bangalore*), destination warehouse contact, remaining distance, and ETA.
- **Digital POD Capture**:
  1. **Physical LR Camera Upload**: Driver photographs the physical paper Lorry Receipt containing warehouse inward stamps.
  2. **Sign-on-Glass**: HTML5 canvas allowing warehouse dock receiving managers to sign directly on the mobile screen.
  3. **COD Payment Collection**: Driver records whether payment was collected via physical cash or UPI QR code.

---

### Stage 3: End-of-Day (EOD) Hub Terminal Reconciliation
When the vehicle returns to the hub, the dispatcher executes the EOD tally modal. The system calculates cash discrepancies using the formula:

$$\text{Total Expenses } (E) = \text{Toll} + \text{Driver Allowance} + \text{Emergency Fuel}$$
$$\text{Advance Balance } (B) = \text{Trip Advance} - E$$
$$\text{Net Expected Remittance } (R_{\text{expected}}) = \text{Expected COD} + B$$
$$\text{Discrepancy } (\Delta) = \text{Actual Cash Remitted} - R_{\text{expected}}$$

**Automated Threshold Alerts**:
- $\Delta = 0$: Balanced (Green)
- $\Delta > 0$: Cash Surplus (Blue)
- $\Delta < 0$: Cash Deficit (Red) — flags the trip for audit review.

---

### Stage 4: Freight Audit & Loss Prevention Desk (`/audit`)
Freights cannot be billed to customers until certified by an auditor.
- **50/50 Split-Pane Interface**:
  - **Left Pane (Document Viewer)**: Renders the uploaded LR image and digital signature with interactive zoom (+25% / -25%), 90° rotation, and SHA-256 cryptographic hash verification.
  - **Right Pane (Telematics & Financials)**: Displays departure/arrival timestamps, system GPS distance vs. odometer reading, and policy variance tables.
- **The 5-Gate Mandatory Checklist**:
  1. *Distance Match*: GPS distance vs. Odometer variance within $\pm 3\%$.
  2. *Cash Match*: Remitted COD matches invoice consignment value.
  3. *Signature Match*: Digital sign captured at dock GPS coordinates.
  4. *Consignee Stamp Verified*: Legible physical warehouse gate stamp.
  5. *Document Legibility*: Consignment numbers, serials, and quantities legible.
- **Outcomes**:
  - **Approve**: Transitions trip to `AUDITED` $\rightarrow$ `READY_FOR_BILLING`.
  - **Raise Discrepancy**: Flags trip as `CORRECTION_REQUESTED` and freezes invoice generation until resolved.

---

### Stage 5: Logistics Accounts & Billing (`/accounts`)
Finance teams pool audit-cleared trips into consolidated GST-compliant tax invoices:
- **Rate Card Engine**: Resolves billing tariffs based on priority order:
  1. `FIXED_TRIP`: Flat corridor rate (e.g., ₹48,000 for Mumbai-Bangalore 16T Eicher).
  2. `PER_DELIVERY`: Rate multiplied by verified delivered stops count.
  3. `PER_KM`: Rate multiplied by audited odometer distance.
- **Accessorial Charges**: Automatically rolls verified highway tolls and demurrage/detention charges into the subtotal.
- **Statutory Indian GST Compliance**:
  - Service Accounting Code: **SAC 996511** (Goods Transport Agency services).
  - Rate: **18% IGST** for interstate freight, or **9% CGST + 9% SGST** for intrastate.
  - Generates formal Rule 46 GST tax invoice with full consignor/consignee GSTINs, State Codes, PAN numbers, and bank remittance instructions.

---

### Stage 6: Client AP Portal & Dispute Resolution (`/client-portal`)
Enterprise clients inspect freight invoices and approve them without blocking healthy receivables:
- **Non-Destructive Line-Item Disputes**: If an invoice has 10 consignments and one consignment suffered pallet damage:
  - Consignee opens the itemized breakdown.
  - Consignee clicks **Flag Dispute** on that specific consignment line.
  - Chooses reason (*Damaged Goods in Transit*, *Late Delivery Penalty*, *Shortage / Missing Qty*, *Incorrect Waiting/Demurrage*).
  - Enters deduction amount (₹) and upload debit note.
  - **Net Authorized Payable**: The portal automatically calculates:
    $$\text{Net Payable Authorized} = \text{Gross Invoice Total} - \sum \text{Dispute Deductions}$$
  - The client clicks **"Approve with Debit Note"**, releasing immediate payment for clean shipments while the disputed line item transitions to the dispute resolution workflow.

---

## 5. State Machines & Enums

### 5.1 Trip Lifecycle (`TripStatus`)
```mermaid
stateDiagram-v2
    [*] --> ASSIGNED: Dispatcher assigns vehicle & driver
    ASSIGNED --> IN_PROGRESS: Driver starts shift
    IN_PROGRESS --> DELIVERY_IN_PROGRESS: Driver reaches first stop
    DELIVERY_IN_PROGRESS --> DELIVERED: All stops completed & POD captured
    DELIVERED --> AUDIT_PENDING: EOD cash tally closed
    AUDIT_PENDING --> AUDITED: Auditor clears 5-gate checklist
    AUDIT_PENDING --> CORRECTION_REQUESTED: Auditor flags discrepancy
    CORRECTION_REQUESTED --> AUDIT_PENDING: Driver/Dispatch resubmits proof
    AUDITED --> READY_FOR_BILLING: Certified for invoice batching
    READY_FOR_BILLING --> [*]
```

### 5.2 Customer Invoice Lifecycle (`InvoiceStatus`)
```mermaid
stateDiagram-v2
    [*] --> DRAFT: Batch created in Accounts
    DRAFT --> SUBMITTED: Published to Client AP
    DRAFT --> CANCELLED: Cancelled by Billing
    SUBMITTED --> CLIENT_REVIEW: Viewed by Client Finance
    SUBMITTED --> CANCELLED: Revoked
    CLIENT_REVIEW --> APPROVED: Full payment authorized
    CLIENT_REVIEW --> DISPUTED: One or more lines disputed
    CLIENT_REVIEW --> REJECTED: Full rejection
    DISPUTED --> CLIENT_REVIEW: Disputed line adjusted
    DISPUTED --> PAID: Partial settlement cleared
    APPROVED --> PAYMENT_QUEUED: Transferred to ERP batch
    PAYMENT_QUEUED --> PAID: Bank payment cleared
    PAID --> [*]
```

### 5.3 3PL Vendor Settlement Lifecycle (`SettlementStatus`)
```mermaid
stateDiagram-v2
    [*] --> DRAFT: Aggregated vendor trips
    DRAFT --> SUBMITTED: Transmitted to Vendor for review
    SUBMITTED --> APPROVED: Vendor signs off on amount
    APPROVED --> PAID: Carrier remits payout to vendor
    PAID --> [*]
```

### 5.4 Dispute Resolution Lifecycle (`DisputeStatus`)
- `DISPUTED`: Raised by Client AP with reason code and deduction amount.
- `UNDER_REVIEW`: Billing team opened dispute, initiating message dialogue.
- `RESOLVED`: Closed with resolution type:
  - `ACCEPTED`: Carrier accepts debit note; credit note issued.
  - `REJECTED`: Carrier presents proof (POD/GPS); client waives dispute.
  - `PARTIAL_ADJUSTMENT`: Mutually agreed compromise deduction.

---

## 6. Complete Database Schema Reference (Prisma)

The database schema (`backend/prisma/schema.prisma`) comprises **25 relational models** organized across 6 functional domains:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   DATABASE ENTITY DOMAINS                                   │
├─────────────────────────┬─────────────────────────┬─────────────────────────────────────────┤
│ Domain                  │ Key Models              │ Primary Responsibilities                │
├─────────────────────────┼─────────────────────────┼─────────────────────────────────────────┤
│ 1. Multi-Tenancy & Auth │ Organization            │ Tenant isolation root (UUID)            │
│                         │ User, RolePermission    │ Identity, 7 roles, 31 permissions       │
│                         │ RefreshToken, Invitation│ Security rotation, onboarding invites   │
│                         │ LoginAttempt, Counter   │ Brute-force logs, sequential numbers    │
├─────────────────────────┼─────────────────────────┼─────────────────────────────────────────┤
│ 2. Master Data          │ Client, Vendor          │ Counterparty enterprises & GSTINs       │
│                         │ Vehicle, Driver         │ Fleet assets, odometers, licenses       │
│                         │ Route, RateCard         │ Corridors, tariffs (Fixed/Delivery/Km)  │
│                         │ RateCardItem            │ Line tariffs mapped to routes           │
├─────────────────────────┼─────────────────────────┼─────────────────────────────────────────┤
│ 3. Dispatch & Execution │ Trip, TripStop          │ Corridors, manifests, odometers, ETA    │
│                         │ PodDocument             │ S3 object keys, signatures, gate stamps │
│                         │ Collection, TripExpense │ Cash/UPI receipts, tolls, fuel slips    │
│                         │ EodTally                │ Terminal shift cash variance records    │
├─────────────────────────┼─────────────────────────┼─────────────────────────────────────────┤
│ 4. Audit & Verification │ AuditReview             │ 5-gate checklist records & outcomes     │
│                         │ AuditLog                │ Immutable entity change history         │
├─────────────────────────┼─────────────────────────┼─────────────────────────────────────────┤
│ 5. Invoicing & Billing  │ Invoice, InvoiceLine    │ GST tax invoices (SAC 996511), lines    │
│                         │ Payment                 │ Payment transactions & bank references  │
│                         │ VendorSettlement        │ 3PL subcontracted payout statements     │
│                         │ VendorSettlementItem    │ Trips attached to vendor payout         │
├─────────────────────────┼─────────────────────────┼─────────────────────────────────────────┤
│ 6. Dispute Resolution   │ Dispute                 │ Line-item disputes, deduction amounts   │
│                         │ Message                 │ Client-carrier dispute communication    │
│                         │ Notification            │ System alerts (Trip, Invoice, Dispute)  │
└─────────────────────────┴─────────────────────────┴─────────────────────────────────────────┘
```

### 6.1 Sequential Human-Readable Identifiers
All key entities generate standardized, zero-collision serial codes using the `Counter` model:
- Trips: `TRP-YYYYMM-XXXX` (e.g. `TRP-202610-0001`)
- Invoices: `INV-YYYYMM-XXXX` (e.g. `INV-202610-0001`)
- Disputes: `DSP-YYYYMM-XXXX` (e.g. `DSP-202610-0001`)
- Vendor Settlements: `SET-YYYYMM-XXXX` (e.g. `SET-202610-0001`)

---

## 7. REST API Endpoints Directory

All routes are mounted under `/api/v1` and documented via OpenAPI Swagger at `http://localhost:3001/api/docs`.

### 7.1 Authentication & Profile (`/auth`)
- `POST /api/v1/auth/login` — Authenticate credentials; returns access token + user profile.
- `POST /api/v1/auth/refresh` — Rotate refresh token; returns fresh access token.
- `POST /api/v1/auth/logout` — Revoke active session and refresh token.
- `GET /api/v1/auth/me` — Retrieve active user's permissions, organization, and profile.
- `GET /api/v1/auth/presets` — Return demo login presets for one-click portal access.
- `POST /api/v1/auth/forgot-password` — Issue password reset token.
- `POST /api/v1/auth/reset-password` — Consume reset token and assign new password.
- `POST /api/v1/auth/invite` — (Admin) Generate onboarding invitation token.
- `POST /api/v1/auth/accept-invite` — Complete onboarding and set initial password.

### 7.2 Trips & Dispatch Operations (`/trips`)
- `GET /api/v1/trips` — Query trips with pagination, status filters, driver, and search.
- `POST /api/v1/trips` — Create and dispatch a new trip consignment.
- `GET /api/v1/trips/:id` — Full trip details including stops, expenses, PODs, and audit logs.
- `PATCH /api/v1/trips/:id` — Update trip details (driver reassignment, ETA adjustments).
- `POST /api/v1/trips/:id/stops/:stopId/arrive` — Mark driver arrival at delivery stop.
- `POST /api/v1/trips/:id/stops/:stopId/complete` — Submit delivery completion with POD document IDs.
- `POST /api/v1/trips/:id/collections` — Record COD cash or UPI collection at a stop.
- `POST /api/v1/trips/:id/expenses` — Log fuel, toll, or driver bhatta expenses.
- `POST /api/v1/trips/:id/eod-close` — Finalize EOD cash tally and advance reconciliation.
- `POST /api/v1/trips/:id/audit` — Submit auditor review with checklist pass/fail flags.

### 7.3 POD Documents & Storage (`/pods`)
- `POST /api/v1/pods/presign-upload` — Generate S3 pre-signed upload URL for camera capture.
- `POST /api/v1/pods/confirm-upload` — Confirm S3 upload, validate SHA-256, attach to `TripStop`.
- `GET /api/v1/pods/:id/download-url` — Generate temporary pre-signed read URL for document viewer.

### 7.4 Invoicing & Accounts (`/invoices` & `/billing`)
- `POST /api/v1/billing/calculate-charge` — Dry-run pricing engine on selected trips.
- `POST /api/v1/billing/generate-invoice` — Create consolidated GST invoice from unbilled trips.
- `GET /api/v1/invoices` — List invoices by client, status, and due date.
- `GET /api/v1/invoices/:id` — Full invoice details with itemized trip consignment lines.
- `POST /api/v1/invoices/:id/submit` — Submit draft invoice to client review.
- `POST /api/v1/invoices/:id/approve` — Client approve invoice for payment.
- `POST /api/v1/invoices/:id/reject` — Client reject invoice with formal justification.
- `POST /api/v1/invoices/:id/cancel` — Cancel draft or submitted invoice.

### 7.5 Disputes & Claims (`/disputes`)
- `POST /api/v1/disputes` — Raise line-item dispute against specific invoice line.
- `GET /api/v1/disputes` — List active disputes with status filters.
- `GET /api/v1/disputes/:id` — Full dispute thread, claimed amount, and attached POD proof.
- `POST /api/v1/disputes/:id/start-review` — Mark dispute under active investigation.
- `POST /api/v1/disputes/:id/resolve` — Resolve dispute (Accepted / Rejected / Partial).
- `POST /api/v1/disputes/:id/messages` — Post message in dispute discussion thread.

### 7.6 3PL Vendor Settlements (`/vendor-settlements`)
- `POST /api/v1/vendor-settlements/generate` — Consolidate 3PL vendor trips into payout statement.
- `GET /api/v1/vendor-settlements` — Query settlements by vendor and status.
- `POST /api/v1/vendor-settlements/:id/approve` — Approve vendor settlement.
- `POST /api/v1/vendor-settlements/:id/mark-paid` — Record payment remittance to vendor.

### 7.7 Master Data Registries
- `/api/v1/clients` — Client accounts (consignors / enterprise shippers).
- `/api/v1/vendors` — 3PL transport vendors.
- `/api/v1/vehicles` — Fleet assets and current odometers.
- `/api/v1/drivers` — Driver rosters, duty statuses, and license numbers.
- `/api/v1/routes` — Corridors, standard distances, and expected toll costs.
- `/api/v1/rate-cards` — Client and vendor freight tariffs.
- `/api/v1/users` — Staff directory and role permissions.

---

## 8. Step-by-Step Local Setup & Execution Guide

### 8.1 Prerequisites
- **Node.js**: v18.18+ or v20+ or v22+
- **npm**: v9+
- *(Optional)* Docker Desktop (if using standard PostgreSQL rather than embedded Postgres)

### 8.2 Environment Files Configuration

#### Backend Environment: `backend/.env`
```env
DATABASE_URL=postgresql://postgres:VectoLocalOnly2026!@localhost:5432/postgres?schema=public
JWT_SECRET=local-dev-jwt-secret-only-do-not-use-in-production-2026-10-22
PORT=3001
NODE_ENV=development
FRONTEND_ORIGIN=http://localhost:3000
DEMO_PASSWORD=Enterprise@2026

# Storage configuration (MinIO local or Supabase S3)
STORAGE_ENDPOINT=http://localhost:9000
STORAGE_REGION=ap-south-1
STORAGE_ACCESS_KEY=vecto
STORAGE_SECRET_KEY=vecto-minio-local-only
STORAGE_BUCKET=vecto-pods
STORAGE_FORCE_PATH_STYLE=true
```

#### Frontend Environment: `.env.local`
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
JWT_SECRET=local-dev-jwt-secret-only-do-not-use-in-production-2026-10-22
```

> **Critical**: `JWT_SECRET` in `.env.local` **must exactly match** `JWT_SECRET` in `backend/.env`. Next.js edge middleware uses this secret to verify session tokens issued by the backend.

### 8.3 Starting the System

#### 1-Command Startup for Backend + Database (Recommended)
From the `backend/` directory:
```bash
npm run start:local
```
*What this single command does:*
1. Automatically spins up **embedded PostgreSQL** on port `5432` (no Docker or local Postgres install required).
2. Runs all 15 Prisma migrations (`prisma migrate deploy`).
3. Seeds all 7 demo accounts, vehicles, drivers, clients, routes, and rate cards (`prisma/seed.ts`).
4. Starts the NestJS API server on `http://localhost:3001`.

#### Starting the Frontend
From the root frontend directory (`B2B-3PL-Invoice-Settlement/`):
```bash
npm run dev
```
The Next.js frontend will launch on `http://localhost:3000`.

---

## 9. Codebase Strengths, Known Technical Debt, & Strategic Improvement Roadmap

This section is written specifically for incoming AI coding agents or human engineering teams to immediately identify high-impact areas for enhancement.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    STRATEGIC ROADMAP FOR ENHANCEMENTS                            │
├──────────────────────────┬───────────────────────────────────────────────────────────────────────┤
│ Tier                     │ Priority Focus Areas                                                  │
├──────────────────────────┼───────────────────────────────────────────────────────────────────────┤
│ Priority 1: High ROI     │ • Live WebSockets / SSE for Dispatch Map & Vehicle Statuses           │
│ (Core Operations)        │ • Automated OCR Pipeline for Physical POD LRs (Tesseract / Textract)  │
│                          │ • Real Client-Side PDF Generation for Invoices (SAC 996511)           │
├──────────────────────────┼───────────────────────────────────────────────────────────────────────┤
│ Priority 2: Integrations │ • Real Payment Gateway (Razorpay / Cashfree / Stripe)                 │
│ (Financial & Telematics) │ • FASTag & Telematics GPS API Webhook Handlers                        │
│                          │ • Export to ERP (SAP / Tally XML / QuickBooks)                        │
├──────────────────────────┼───────────────────────────────────────────────────────────────────────┤
│ Priority 3: Architecture │ • Playwright End-to-End Test Suite for All 7 Portals                  │
│ (Enterprise Scale)       │ • Distributed Caching Layer (Redis for Sessions & Rate Cards)         │
│                          │ • Docker Multi-Stage Deployment & CI/CD Pipelines                     │
└──────────────────────────┴───────────────────────────────────────────────────────────────────────┘
```

### 9.1 Priority 1: Operational Core Enhancements

#### 1. Real-Time Telematics & Status Streaming (WebSockets / SSE)
- **Current State**: Frontend relies on manual refetches or page loads to update trip statuses and driver locations.
- **Improvement**: Implement a NestJS Gateway (`@nestjs/websockets`) using Socket.io or Server-Sent Events (SSE) broadcasting:
  - Driver GPS coordinates (`trip:telematics:update`).
  - Trip status changes (`trip:status:changed`).
  - Live dispute notifications to accounts managers.
- **Implementation Target**: `backend/src/trips/trips.gateway.ts` and React hook `useFleetStream()` in `app/dispatch/page.tsx`.

#### 2. Automated OCR & Consignment Stamp Recognition for PODs
- **Current State**: Auditor manually checks whether an LR has a physical stamp and legible signature.
- **Improvement**: Integrate an automated OCR pipeline on POD confirmation:
  - Extract consignment numbers, gross weight, package counts, and consignee gate stamps.
  - Automatically match extracted OCR text against `TripStop.expectedQty` and flag mismatches automatically before the human auditor opens the record.
- **Implementation Target**: `backend/src/pods/pods.service.ts` connecting to Tesseract.js or AWS Textract.

#### 3. True PDF Tax Invoice Export
- **Current State**: Accounts page has a `<Dialog>` tax invoice preview, but the "Download PDF" button triggers a placeholder alert.
- **Improvement**: Implement `@react-pdf/renderer` or server-side `pdfkit` / Puppeteer to render and download official Rule 46 GST tax invoices with QR codes and embedded digital signatures.
- **Implementation Target**: `lib/pdf/generate-invoice-pdf.ts` or `GET /api/v1/invoices/:id/pdf`.

---

### 9.2 Priority 2: Financial & Telematics Integrations

#### 4. Payment Gateway Webhook Integration
- **Current State**: Payments are recorded manually via `POST /api/v1/payments`.
- **Improvement**: Integrate Razorpay or Cashfree webhooks for direct settlement:
  - Generate instant UPI payment links for client invoices.
  - Generate UPI Dynamic QR codes for driver COD collections.
  - Automatically transition `Invoice` to `PAID` upon verified bank webhook signature.
- **Implementation Target**: `backend/src/payments/gateways/razorpay.service.ts`.

#### 5. FASTag / Electronic Toll Integration
- **Current State**: Toll expenses are entered manually during trip closing.
- **Improvement**: Connect with NETC FASTag API (or FASTag statement CSV parser) to automatically pull toll plaza charges linked to `Vehicle.regNo` matching trip departure and arrival timestamps.
- **Implementation Target**: `backend/src/trips/tolls.service.ts`.

#### 6. Tally / SAP ERP Accounting Export
- **Current State**: Invoices live solely inside the platform database.
- **Improvement**: Add an "Export to Tally XML" or "SAP BAPI JSON" feature allowing finance controllers to export batch invoices directly into corporate accounting software.
- **Implementation Target**: `backend/src/invoices/exporters/tally-xml.service.ts`.

---

### 9.3 Priority 3: Reliability, Testing & Production Hardening

#### 7. Playwright End-to-End Test Suite
- **Current State**: Unit tests exist in backend (`*.spec.ts`), but frontend relies on manual verification.
- **Improvement**: Write full end-to-end integration tests using Playwright covering the entire lifecycle:
  1. Login as Dispatcher $\rightarrow$ Create trip.
  2. Login as Driver $\rightarrow$ Complete stops, capture canvas signature, upload POD.
  3. Login as Auditor $\rightarrow$ Complete 5-gate checklist.
  4. Login as Accounts $\rightarrow$ Generate consolidated GST invoice.
  5. Login as Client AP $\rightarrow$ Flag line dispute, verify net payable calculation, approve.
- **Implementation Target**: `test/e2e/shipment-lifecycle.spec.ts`.

#### 8. Containerized Production Deployment
- **Current State**: Development uses local Node.js processes and `start-with-db.js`.
- **Improvement**: Provide optimized multi-stage `Dockerfile` and `docker-compose.prod.yml`:
  - Next.js standalone output (`output: 'standalone'`).
  - NestJS production Alpine bundle.
  - Managed PostgreSQL + Redis for session caching and rate-limiting.
  - Automated database migration runner on container startup.

---

## 10. Summary Cheat Sheet for Developers & Agents

| Item | Value |
| :--- | :--- |
| **Frontend Root** | `c:\Users\aniru\Desktop\B2B-3PL-Invoice-Settlement-Platform 2.0\B2B-3PL-Invoice-Settlement` |
| **Backend Root** | `c:\Users\aniru\Desktop\B2B-3PL-Invoice-Settlement-Platform 2.0\B2B-3PL-Invoice-Settlement\backend` |
| **Frontend Dev Command** | `npm run dev` (starts on port 3000) |
| **Backend Dev Command** | `npm run start:local` (starts embedded PG 18 on 5432 + NestJS on 3001) |
| **OpenAPI / Swagger** | `http://localhost:3001/api/docs` |
| **Prisma Schema** | `backend/prisma/schema.prisma` |
| **Demo Password** | `Enterprise@2026` (same for all 7 seeded accounts) |
| **Primary Test Users** | `dispatch@vectologistics.in`, `driver.rajesh@vectologistics.in`, `audit.lead@vectologistics.in`, `billing.finance@vectologistics.in`, `ap.payments@metro-wholesale.in`, `partner@3pl-vendor.in`, `admin@vectologistics.in` |
| **Edge Guard Auth** | Verified via cookie `vecto_access_token` and `JWT_SECRET` in both `.env` and `.env.local` |
