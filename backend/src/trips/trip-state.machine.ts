export const TRIP_TRANSITIONS: Record<string, string[]> = {
  // Canonical R1 lifecycle
  PLACED: ["LOADING", "CANCELLED", "IN_PROGRESS"],
  LOADING: ["LOADED", "CANCELLED"],
  LOADED: ["IN_TRANSIT", "CANCELLED"],
  IN_TRANSIT: ["UNLOADING", "VEHICLE_REPLACED", "IN_TRANSIT", "DELIVERED"],
  VEHICLE_REPLACED: ["IN_TRANSIT"],
  UNLOADING: ["DELIVERED", "UNLOADING"],
  DELIVERED: ["CLOSED", "AUDIT_PENDING"],
  CLOSED: [],
  CANCELLED: [],

  // Legacy lifecycle bridging & backwards compatibility
  ASSIGNED: ["IN_PROGRESS", "LOADING", "CANCELLED"],
  IN_PROGRESS: ["DELIVERY_IN_PROGRESS", "UNLOADING", "CANCELLED"],
  DELIVERY_IN_PROGRESS: ["DELIVERED"],
  AUDIT_PENDING: ["AUDITED", "CORRECTION_REQUESTED", "CLOSED"],
  CORRECTION_REQUESTED: ["AUDIT_PENDING"],
  AUDITED: ["READY_FOR_BILLING", "CLOSED"],
  READY_FOR_BILLING: ["CLOSED"],
};

export function canTransition(from: string, to: string): boolean {
  return TRIP_TRANSITIONS[from]?.includes(to) ?? false;
}

export const DRIVER_ALLOWED_TRANSITIONS: Record<string, string[]> = {
  ASSIGNED: ["IN_PROGRESS", "LOADING"],
  PLACED: ["LOADING"],
  LOADING: ["LOADED"],
  LOADED: ["IN_TRANSIT"],
  IN_TRANSIT: ["UNLOADING", "IN_TRANSIT", "DELIVERED"],
  IN_PROGRESS: ["DELIVERY_IN_PROGRESS", "UNLOADING"],
  DELIVERY_IN_PROGRESS: ["DELIVERED"],
  UNLOADING: ["DELIVERED", "UNLOADING"],
};

export function canDriverTransition(from: string, to: string): boolean {
  return DRIVER_ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}
