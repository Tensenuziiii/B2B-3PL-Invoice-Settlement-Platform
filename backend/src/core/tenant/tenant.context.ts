import { AsyncLocalStorage } from "node:async_hooks";

export type TenantStore = {
  organizationId: string;
  userId: string;
  clientId?: string | null;
};

export const tenantStorage = new AsyncLocalStorage<TenantStore>();

export function getTenant(): TenantStore | undefined {
  return tenantStorage.getStore();
}

export function requireTenant(): TenantStore {
  const store = tenantStorage.getStore();
  if (!store) {
    throw new Error("No tenant context — ensure TenantInterceptor is registered globally");
  }
  return store;
}
