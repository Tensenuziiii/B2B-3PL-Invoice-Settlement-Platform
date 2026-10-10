export const INVOICE_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["CLIENT_REVIEW", "CANCELLED"],
  CLIENT_REVIEW: ["APPROVED", "REJECTED", "DISPUTED"],
  APPROVED: ["PAYMENT_QUEUED"],
  PAYMENT_QUEUED: ["PAID"],
  PAID: [],
  REJECTED: [],
  DISPUTED: ["CLIENT_REVIEW", "PAID"],
  CANCELLED: [],
  OVERDUE: ["PAID"],
};

export function canInvoiceTransition(from: string, to: string): boolean {
  return INVOICE_TRANSITIONS[from]?.includes(to) ?? false;
}
