export const TRIP_TRANSITIONS: Record<string, string[]> = {
  ASSIGNED: ["IN_PROGRESS"],
  IN_PROGRESS: ["DELIVERY_IN_PROGRESS"],
  DELIVERY_IN_PROGRESS: ["DELIVERED"],
  DELIVERED: ["AUDIT_PENDING"],
  AUDIT_PENDING: ["AUDITED", "CORRECTION_REQUESTED"],
  CORRECTION_REQUESTED: ["AUDIT_PENDING"],
  AUDITED: ["READY_FOR_BILLING"],
  READY_FOR_BILLING: [],
};

export function canTransition(from: string, to: string): boolean {
  return TRIP_TRANSITIONS[from]?.includes(to) ?? false;
}
