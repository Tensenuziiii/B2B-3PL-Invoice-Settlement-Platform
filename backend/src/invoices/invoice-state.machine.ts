export const INVOICE_TRANSITIONS: Record<string, string[]> = {
  // R1 canonical & stage progression lifecycle
  DRAFT: ["SUBMITTED", "IN_STAGE", "CANCELLED"],
  SUBMITTED: ["IN_STAGE", "CLIENT_REVIEW", "CANCELLED"],
  IN_STAGE: ["IN_STAGE", "ON_HOLD", "APPROVED", "FULLY_APPROVED", "REJECTED", "CANCELLED"],
  ON_HOLD: ["IN_STAGE", "CANCELLED"],
  CLIENT_REVIEW: ["APPROVED", "REJECTED", "DISPUTED", "IN_STAGE"],
  APPROVED: ["PAYMENT_QUEUED", "PARTIALLY_PAID", "PAID"],
  FULLY_APPROVED: ["PAYMENT_QUEUED", "PARTIALLY_PAID", "PAID"],
  PAYMENT_QUEUED: ["PARTIALLY_PAID", "PAID"],
  PARTIALLY_PAID: ["PARTIALLY_PAID", "PAID"],
  PAID: [],
  REJECTED: [],
  DISPUTED: ["CLIENT_REVIEW", "IN_STAGE", "PAID"],
  CANCELLED: [],
  OVERDUE: ["PAID", "PARTIALLY_PAID"],
};

export function canInvoiceTransition(from: string, to: string): boolean {
  return INVOICE_TRANSITIONS[from]?.includes(to) ?? false;
}
