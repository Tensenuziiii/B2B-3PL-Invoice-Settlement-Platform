import { Prisma } from "@prisma/client";
import { tenantStorage } from "./tenant.context";
import { SCOPED_MODELS } from "./scoped-models";

const NO_TENANT_UUID = "00000000-0000-0000-0000-000000000000";

const MULTI_READ_OPS = new Set([
  "findFirst", "findFirstOrThrow", "findMany",
  "count", "aggregate", "groupBy",
]);

const SINGLE_READ_OPS = new Set(["findUnique", "findUniqueOrThrow"]);

const WRITE_OPS_WITH_WHERE = new Set([
  "update", "updateMany", "delete", "deleteMany",
]);

export const tenantExtension = Prisma.defineExtension((client) =>
  client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !SCOPED_MODELS.has(model)) return query(args);

          // upsert on scoped models is forbidden.
          // The extension cannot safely inject organizationId into upsert.where
          // (which requires unique fields only), and skipping injection would
          // allow cross-tenant writes. Services must use create() or update().
          if (operation === "upsert") {
            throw new Error(
              `upsert is forbidden on scoped model ${model}. Use create() or update() instead.`,
            );
          }

          const orgId = tenantStorage.getStore()?.organizationId;

          // No tenant context
          if (!orgId) {
            if (SINGLE_READ_OPS.has(operation)) return null;
            if (MULTI_READ_OPS.has(operation)) {
              return query({ ...(args as any), where: { AND: [{ id: { equals: NO_TENANT_UUID } }] } });
            }
            if (operation === "create" || operation === "createMany" || WRITE_OPS_WITH_WHERE.has(operation)) {
              throw new Error(`Tenant write without context: ${model}.${operation}`);
            }
            return query(args);
          }

          const a = args as any;

          // Multi-record reads — inject into where
          if (MULTI_READ_OPS.has(operation)) {
            a.where = { ...(a.where ?? {}), organizationId: orgId };
          }

          // Single-record reads — post-verify result
          if (SINGLE_READ_OPS.has(operation)) {
            const result = await query(args);
            if (!result) return result;
            if ((result as any).organizationId !== orgId) {
              if (operation === "findUniqueOrThrow") throw new Error("Record not found");
              return null;
            }
            return result;
          }

          // Multi-record + single-record writes — inject into where
          // Prisma 5+ supports extra filters alongside the unique selector
          if (WRITE_OPS_WITH_WHERE.has(operation)) {
            a.where = { ...(a.where ?? {}), organizationId: orgId };
          }

          // Creates — inject into data
          if (operation === "create") {
            a.data = { ...(a.data ?? {}), organizationId: orgId };
          }
          if (operation === "createMany") {
            a.data = Array.isArray(a.data)
              ? a.data.map((r: any) => ({ ...r, organizationId: orgId }))
              : { ...a.data, organizationId: orgId };
          }

          return query(args);
        },
      },
    },
  }),
);
