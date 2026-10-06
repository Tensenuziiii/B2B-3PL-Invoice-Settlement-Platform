export const SCOPED_MODELS = new Set<string>([
  "User",
  "RefreshToken",
  "LoginAttempt",
  "Invitation",
  "Counter",
  "AuditLog",
  "Notification",
  "Client",
  "Vehicle",
  "Driver",
  "Trip",
  "TripStop",
  "Pod",
  "TripExpense",
  "EodTally",
  "AuditReview",
  "Invoice",
  "InvoiceLine",
  "Payment",
]);

// NOT scoped (intentional):
//   - Organization       — it IS the tenant root
//   - IdempotencyKey     — cross-tenant operational cache
//   - PasswordResetToken — auth-only, has no organizationId field
//   - AuditLog           — has organizationId, but writes go through PrismaRootService to allow system-level audits if needed
