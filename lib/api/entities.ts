// =============================================================
// Hand-crafted entity response types mirroring backend Prisma schema
// =============================================================

// ============================================================
// ENUMS
// ============================================================

export type Role =
  | "ADMIN"
  | "DISPATCH_MANAGER"
  | "DRIVER"
  | "AUDITOR"
  | "ACCOUNTS"
  | "CLIENT_AP"
  | "VENDOR_3PL";

export type UserStatus = "ACTIVE" | "INACTIVE" | "LOCKED";

export type TripStatus =
  | "PLACED"
  | "LOADING"
  | "LOADED"
  | "IN_TRANSIT"
  | "UNLOADING"
  | "DELIVERED"
  | "CLOSED"
  | "CANCELLED"
  | "VEHICLE_REPLACED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "DELIVERY_IN_PROGRESS"
  | "AUDIT_PENDING"
  | "CORRECTION_REQUESTED"
  | "AUDITED"
  | "READY_FOR_BILLING";

export type TripStopStatus = "PENDING" | "IN_PROGRESS" | "DELIVERED" | "FAILED";

export type PodStatus =
  | "PENDING_DELIVERY"
  | "SOFT_COPY_RECEIVED"
  | "SOFT_COPY_CHECKED"
  | "ORIGINAL_DISPATCHED"
  | "ORIGINAL_RECEIVED"
  | "SUBMITTED_TO_CLIENT"
  | "ON_HOLD"
  | "LOST"
  | "DUPLICATE_REQUESTED"
  | "ACKNOWLEDGED";

export type PodDocumentType = "PHOTO" | "SIGNATURE" | "LR" | "OTHER";

export type InvoiceStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "IN_STAGE"
  | "APPROVED_STAGE"
  | "APPROVED"
  | "ON_HOLD"
  | "FULLY_APPROVED"
  | "PARTIALLY_PAID"
  | "CLIENT_REVIEW"
  | "PAYMENT_QUEUED"
  | "PAID"
  | "REJECTED"
  | "DISPUTED"
  | "CANCELLED"
  | "OVERDUE";

export type AuditOutcome = "AUDITED" | "CORRECTION_REQUESTED";

export type CollectionMode = "COD" | "CASH" | "UPI" | "CREDIT";

export type ExpenseType =
  | "FUEL"
  | "TOLL"
  | "PARKING"
  | "DRIVER_ALLOWANCE"
  | "EMERGENCY_FUEL"
  | "REPAIR"
  | "OTHER";

export type NotificationType =
  | "TRIP"
  | "AUDIT"
  | "INVOICE"
  | "DISPUTE"
  | "PAYMENT"
  | "SETTLEMENT"
  | "INVITATION";

export type RateType = "FIXED_TRIP" | "PER_DELIVERY" | "PER_KM";

export type CounterpartyType = "CLIENT" | "VENDOR";

export type DisputeStatus = "DISPUTED" | "UNDER_REVIEW" | "RESOLVED";

export type DisputeResolution = "ACCEPTED" | "REJECTED" | "PARTIAL_ADJUSTMENT";

export type SettlementStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "PAID";

// ============================================================
// ENTITY MODELS
// ============================================================

export type Organization = {
  id: string;
  name: string;
  legalName?: string | null;
  gstin?: string | null;
  pan?: string | null;
  stateCode?: string | null;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type User = {
  id: string;
  organizationId: string;
  email: string;
  passwordHash?: string | null;
  name: string;
  initials?: string;
  role: Role;
  status: UserStatus;
  failedLoginAttempts?: number;
  lockedUntil?: string | null;
  displayId: string;
  hubName?: string | null;
  clientId?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;

  organization?: Organization | null;
  client?: Client | null;
};

export type CustomerContact = {
  id: string;
  organizationId: string;
  clientId: string;
  name: string;
  role?: string | null;
  phone?: string | null;
  email?: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ApprovalStageTemplate = {
  id: string;
  organizationId: string;
  clientId: string;
  sequence: number;
  name: string;
  slaHours: number;
  createdAt: string;
  updatedAt: string;
};

export type CustomerDocumentRule = {
  id: string;
  organizationId: string;
  clientId: string;
  documentType: string;
  isMandatory: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Owner = {
  id: string;
  organizationId: string;
  name: string;
  partyType: string;
  pan?: string | null;
  phone?: string | null;
  address?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  trucks?: Vehicle[];
  trips?: Trip[];
};

export type Client = {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  gstin?: string | null;
  stateCode?: string | null;
  paymentTermsDays?: number;
  creditDays?: number;
  digitalPodEnabled?: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;

  users?: User[];
  trips?: Trip[];
  invoices?: Invoice[];
  rateCards?: RateCard[];
  contacts?: CustomerContact[];
  approvalTemplates?: ApprovalStageTemplate[];
  documentRules?: CustomerDocumentRule[];
};

export type Vehicle = {
  id: string;
  organizationId: string;
  regNo: string;
  type?: string | null;
  capacityKg?: number | null;
  currentOdometer: number;
  ownerId?: string | null;
  insuranceExpiry?: string | null;
  fitnessExpiry?: string | null;
  pucExpiry?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;

  owner?: Owner | null;
  trips?: Trip[];
};

export type Driver = {
  id: string;
  organizationId: string;
  name: string;
  phone: string;
  licenseNo?: string | null;
  licenseExpiry?: string | null;
  verificationStatus?: string | null;
  userId?: string | null;
  dutyStatus?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;

  trips?: Trip[];
};

export type Route = {
  id: string;
  organizationId: string;
  name: string;
  origin: string;
  destination: string;
  expectedKm: number;
  standardTollEstimate?: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;

  rateCardItems?: RateCardItem[];
  trips?: Trip[];
};

export type RateCard = {
  id: string;
  organizationId: string;
  name: string;
  counterpartyType: CounterpartyType;
  clientId?: string | null;
  vendorId?: string | null;
  validFrom: string;
  validTo?: string | null;
  status: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;

  client?: Client | { id: string; name: string; code?: string; gstin?: string | null } | null;
  vendor?: Vendor | { id: string; name: string; code?: string; gstin?: string | null } | null;
  items?: RateCardItem[];
};

export type RateCardItem = {
  id: string;
  organizationId: string;
  rateCardId: string;
  rateType: RateType;
  routeId?: string | null;
  tripType?: string | null;
  serviceType?: string | null;
  rate: number;
  notes?: string | null;
  createdAt: string;

  route?: Route | { id: string; name: string; origin: string; destination: string } | null;
};

export type Trip = {
  id: string;
  organizationId: string;
  tripNumber: string;
  lrNumber?: string | null;
  status: TripStatus;
  version: number;
  clientId?: string | null;
  vendorId?: string | null;
  routeId?: string | null;
  driverId?: string | null;
  vehicleId?: string | null;
  origin?: string | null;
  destination?: string | null;
  eta?: string | null;
  odometerStart?: number | null;
  odometerEnd?: number | null;
  delayMinutes?: number;
  delayReason?: string | null;
  assignedAt?: string | null;
  startedAt?: string | null;
  deliveredAt?: string | null;
  closedAt?: string | null;
  auditRequestedAt?: string | null;
  auditedAt?: string | null;
  readyForBillingAt?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;

  client?: Client | { id: string; name: string; code?: string; gstin?: string | null } | null;
  vendor?: Vendor | { id: string; name: string; code?: string; gstin?: string | null } | null;
  driver?: Driver | { id: string; name: string; phone: string } | null;
  vehicle?: Vehicle | { id: string; regNo: string } | null;
  route?: Route | null;
  tripStops?: TripStop[];
  tripExpenses?: TripExpense[];
  eodTally?: EodTally | null;
  auditReviews?: AuditReview[];
  invoiceLine?: InvoiceLine | null;
  vendorSettlementItem?: VendorSettlementItem | null;
  _count?: { tripStops?: number };
};

export type TripStop = {
  id: string;
  organizationId: string;
  tripId: string;
  sequence: number;
  name?: string | null;
  address?: string | null;
  expectedQty?: number | null;
  deliveredQty?: number | null;
  collectionType: CollectionMode;
  expectedCollection: number;
  status: TripStopStatus;
  qtyMismatchFlag?: boolean;
  createdAt: string;

  collection?: Collection | null;
  podDocuments?: PodDocument[];
};

export type PodDocument = {
  id: string;
  organizationId: string;
  tripStopId: string;
  documentType: PodDocumentType;
  s3Key: string;
  contentType: string;
  sizeBytes: number;
  sha256?: string | null;
  signatoryName?: string | null;
  dockGpsLat?: number | null;
  dockGpsLng?: number | null;
  gateInTimestamp?: string | null;
  stampVerified?: boolean;
  authHash?: string | null;
  uploadedById?: string | null;
  ocrResult?: unknown;
  validationResult?: unknown;
  createdAt: string;
};

export type Collection = {
  id: string;
  organizationId: string;
  tripStopId: string;
  actualAmount: number;
  mode: CollectionMode;
  referenceId?: string | null;
  collectedAt: string;
  recordedById?: string | null;
  notes?: string | null;
  createdAt: string;
};

export type TripExpense = {
  id: string;
  organizationId: string;
  tripId: string;
  type: ExpenseType;
  amount: number;
  receiptRef?: string | null;
  note?: string | null;
  createdAt: string;
};

export type EodTally = {
  id: string;
  organizationId: string;
  tripId: string;
  toll: number;
  allowance: number;
  fuel: number;
  actualCash: number;
  netExpected: number;
  discrepancy: number;
  createdAt: string;
};

export type AuditReview = {
  id: string;
  organizationId: string;
  tripId: string;
  reviewerId?: string | null;
  outcome: AuditOutcome;
  checklist?: unknown;
  notes?: string | null;
  createdAt: string;
};

export type Invoice = {
  id: string;
  organizationId: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  version: number;
  clientId?: string | null;
  issueDate: string;
  dueDate?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  subtotal: number;
  gstRate: number;
  gstAmount: number;
  total: number;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  cancelledAt?: string | null;
  deletedAt?: string | null;

  client?: Client | { id: string; name: string; code?: string; gstin?: string | null } | null;
  lines?: InvoiceLine[];
  payments?: Payment[];
};

export type InvoiceLine = {
  id: string;
  organizationId: string;
  invoiceId: string;
  tripId: string;
  lineAmount: number;
  gstAmount: number;
  totalAmount: number;
  snapshot?: unknown;
  createdAt: string;

  trip?: Trip | null;
  dispute?: Dispute | null;
};

export type Payment = {
  id: string;
  organizationId: string;
  invoiceId: string;
  amount: number;
  method?: string | null;
  reference?: string | null;
  paidAt: string;
  createdAt: string;
};

export type Vendor = {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  gstin?: string | null;
  stateCode?: string | null;
  payoutTermsDays?: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;

  rateCards?: RateCard[];
  trips?: Trip[];
  settlements?: VendorSettlement[];
};

export type VendorSettlement = {
  id: string;
  organizationId: string;
  settlementNumber: string;
  vendorId: string;
  status: SettlementStatus;
  version: number;
  periodStart?: string | null;
  periodEnd?: string | null;
  subtotal: number;
  adjustments: number;
  total: number;
  submittedAt?: string | null;
  approvedAt?: string | null;
  paidAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;

  vendor?: Vendor | { id: string; name: string; code: string } | null;
  items?: VendorSettlementItem[];
};

export type Settlement = VendorSettlement;

export type VendorSettlementItem = {
  id: string;
  organizationId: string;
  settlementId: string;
  tripId: string;
  lineAmount: number;
  snapshot?: unknown;
  createdAt: string;

  trip?: Trip | null;
};

export type Dispute = {
  id: string;
  organizationId: string;
  disputeNumber: string;
  invoiceLineId: string;
  raisedById: string;
  reasonCode: string;
  comment: string;
  evidenceDocId?: string | null;
  amountPaise: number;
  status: DisputeStatus;
  resolution?: DisputeResolution | null;
  resolvedById?: string | null;
  resolvedAt?: string | null;
  resolutionNotes?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;

  invoiceLine?: InvoiceLine | null;
  evidenceDoc?: PodDocument | null;
  messages?: Message[];
};

export type Message = {
  id: string;
  organizationId: string;
  disputeId: string;
  authorId: string;
  body: string;
  createdAt: string;
};

export type Notification = {
  id: string;
  organizationId: string;
  userId?: string | null;
  type?: NotificationType | null;
  title: string;
  body: string;
  payload?: unknown;
  readAt?: string | null;
  createdAt: string;
};

export type Pod = {
  id: string;
  organizationId: string;
  tripId: string;
  currentStatus: PodStatus;
  holdReason?: string | null;
  holdRemarks?: string | null;
  courierName?: string | null;
  courierTrackingNo?: string | null;
  courierDispatchedAt?: string | null;
  officeReceivedAt?: string | null;
  officeReceivedBy?: string | null;
  customerSubmittedAt?: string | null;
  customerAcknowledgedAt?: string | null;
  lossReportedAt?: string | null;
  duplicateRequestedAt?: string | null;
  createdAt: string;
  updatedAt: string;

  trip?: Trip | null;
  checkItems?: PodCheckItem[];
  events?: PodEvent[];
};

export type PodCheckItem = {
  id: string;
  podId: string;
  checkType: string;
  passed: boolean;
  remarks?: string | null;
  checkedBy?: string | null;
  createdAt: string;
};

export type PodEvent = {
  id: string;
  podId: string;
  eventType: string;
  fromStatus?: string | null;
  toStatus: string;
  actorId?: string | null;
  notes?: string | null;
  payload?: unknown;
  createdAt: string;
};

export type InvoiceStage = {
  id: string;
  invoiceId: string;
  stageName: string;
  stageOrder: number;
  approverRole: string;
  status: string;
  approvedAt?: string | null;
  approvedById?: string | null;
  comments?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InvoiceFollowUp = {
  id: string;
  invoiceId: string;
  contactedPerson?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  channel: string;
  outcome?: string | null;
  notes?: string | null;
  nextFollowUpDate?: string | null;
  actorId?: string | null;
  createdAt: string;
};
