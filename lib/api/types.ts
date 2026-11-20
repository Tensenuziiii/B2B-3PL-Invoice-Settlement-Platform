// =============================================================
// API types — combination of generated DTOs + hand-written entities
// =============================================================

import type { components } from "./generated-types";

// DTOs (auto-generated from OpenAPI request bodies)
export type LoginDto = components["schemas"]["LoginDto"];
export type CreateUserDto = components["schemas"]["CreateUserDto"];
export type UpdateUserDto = components["schemas"]["UpdateUserDto"];
export type CreateTripDto = components["schemas"]["CreateTripDto"];
export type UpdateTripDto = components["schemas"]["UpdateTripDto"];
export type CreateClientDto = components["schemas"]["CreateClientDto"];
export type UpdateClientDto = components["schemas"]["UpdateClientDto"];
export type CreateVehicleDto = components["schemas"]["CreateVehicleDto"];
export type UpdateVehicleDto = components["schemas"]["UpdateVehicleDto"];
export type CreateDriverDto = components["schemas"]["CreateDriverDto"];
export type UpdateDriverDto = components["schemas"]["UpdateDriverDto"];
export type CreateVendorDto = components["schemas"]["CreateVendorDto"];
export type UpdateVendorDto = components["schemas"]["UpdateVendorDto"];
export type CreateRouteDto = components["schemas"]["CreateRouteDto"];
export type UpdateRouteDto = components["schemas"]["UpdateRouteDto"];
export type CreateRateCardDto = components["schemas"]["CreateRateCardDto"];
export type UpdateRateCardDto = components["schemas"]["UpdateRateCardDto"];
export type GenerateInvoiceDto = components["schemas"]["GenerateInvoiceDto"];
export type InvoiceActionDto = components["schemas"]["InvoiceActionDto"];
export type CreateDisputeDto = components["schemas"]["CreateDisputeDto"];
export type ResolveDisputeDto = components["schemas"]["ResolveDisputeDto"];
export type PostMessageDto = components["schemas"]["PostMessageDto"];
export type RecordPaymentDto = components["schemas"]["RecordPaymentDto"];
export type GenerateSettlementDto = components["schemas"]["GenerateSettlementDto"];
export type SettlementActionDto = components["schemas"]["SettlementActionDto"];

// Entities (hand-written, mirror backend response shapes)
export type {
  Role,
  UserStatus,
  TripStatus,
  TripStopStatus,
  PodStatus,
  InvoiceStatus,
  CollectionMode,
  ExpenseType,
  RateType,
  CounterpartyType,
  AuditOutcome,
  DisputeStatus,
  DisputeResolution,
  SettlementStatus,
  PodDocumentType,
  User,
  Organization,
  Trip,
  TripStop,
  Client,
  CustomerContact,
  ApprovalStageTemplate,
  CustomerDocumentRule,
  Owner,
  Vendor,
  Vehicle,
  Driver,
  Route,
  RateCard,
  RateCardItem,
  Invoice,
  InvoiceLine,
  Dispute,
  Message,
  Payment,
  VendorSettlement,
  Settlement,
  VendorSettlementItem,
  PodDocument,
  Collection,
  TripExpense,
  EodTally,
  AuditReview,
  Notification,
  Pod,
  PodCheckItem,
  PodEvent,
  InvoiceStage,
  InvoiceFollowUp,
} from "./entities";

// Error envelope
export type ApiErrorShape = {
  error: { code: string; message: string };
};

// Paginated wrapper
export type Paginated<T> = {
  data: T[];
  meta: { total: number; limit: number; offset: number };
};

// Auth types
export type LoginRequest = { email: string; password: string };
export type LoginResponse = {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: import("./entities").Role;
    displayId: string;
    redirectPath: string;
  };
};
export type RefreshResponse = { accessToken: string };
