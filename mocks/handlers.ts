import { http, HttpResponse } from "msw";

interface MockUser {
  id: string;
  email: string;
  name: string;
  role: string;
  displayId: string;
  redirectPath: string;
}

const USERS_BY_EMAIL: Record<string, MockUser> = {
  "admin@vecto.dev": {
    id: "u1",
    email: "admin@vecto.dev",
    name: "Admin User",
    role: "ADMIN",
    displayId: "ADM-01",
    redirectPath: "/admin",
  },
  "dispatch@vecto.dev": {
    id: "u2",
    email: "dispatch@vecto.dev",
    name: "Dispatch Lead",
    role: "DISPATCH_MANAGER",
    displayId: "DSP-01",
    redirectPath: "/dispatch",
  },
  "driver@vecto.dev": {
    id: "u3",
    email: "driver@vecto.dev",
    name: "Rajesh Kumar",
    role: "DRIVER",
    displayId: "DRV-01",
    redirectPath: "/driver",
  },
  "audit@vecto.dev": {
    id: "u4",
    email: "audit@vecto.dev",
    name: "Internal Auditor",
    role: "AUDITOR",
    displayId: "AUD-01",
    redirectPath: "/audit",
  },
  "billing@vecto.dev": {
    id: "u5",
    email: "billing@vecto.dev",
    name: "Finance Controller",
    role: "ACCOUNTS",
    displayId: "ACC-01",
    redirectPath: "/accounts",
  },
  "client@vecto.dev": {
    id: "u6",
    email: "client@vecto.dev",
    name: "Metro Accounts Payable",
    role: "CLIENT_AP",
    displayId: "CLT-01",
    redirectPath: "/client-portal",
  },
  "vendor@vecto.dev": {
    id: "u7",
    email: "vendor@vecto.dev",
    name: "Swift 3PL Partner",
    role: "VENDOR_3PL",
    displayId: "VND-01",
    redirectPath: "/vendor-portal",
  },
};

const mockUsers = [
  { id: "u1", name: "Admin User", email: "admin@vecto.dev", role: "ADMIN", displayId: "ADM-01" },
  { id: "u2", name: "Dispatch Lead", email: "dispatch@vecto.dev", role: "DISPATCH_MANAGER", displayId: "DSP-01" },
  { id: "u3", name: "Rajesh Kumar", email: "driver@vecto.dev", role: "DRIVER", displayId: "DRV-01" },
  { id: "u4", name: "Internal Auditor", email: "audit@vecto.dev", role: "AUDITOR", displayId: "AUD-01" },
  { id: "u5", name: "Finance Controller", email: "billing@vecto.dev", role: "ACCOUNTS", displayId: "ACC-01" },
];

const mockVehicles = [
  { id: "v1", regNo: "MH 12 RN 4920", type: "16T Eicher", active: true },
  { id: "v2", regNo: "DL 01 AB 8842", type: "32T Tata Prima", active: true },
  { id: "v3", regNo: "KA 05 MN 1234", type: "24T Ashok Leyland", active: true },
  { id: "v4", regNo: "GJ 03 XY 7711", type: "10T Eicher Pro", active: true },
  { id: "v5", regNo: "TN 09 PQ 5522", type: "16T BharatBenz", active: false },
];

const mockDrivers = [
  { id: "d1", name: "Rajesh Kumar", phone: "+91 98201 12345", licenseNo: "MH-14-2018-004920", status: "AVAILABLE" },
  { id: "d2", name: "Suresh Patil", phone: "+91 98202 23456", licenseNo: "MH-12-2016-008842", status: "ON_TRIP" },
  { id: "d3", name: "Amit Sharma", phone: "+91 98203 34567", licenseNo: "DL-04-2019-001234", status: "AVAILABLE" },
  { id: "d4", name: "Vikas Verma", phone: "+91 98204 45678", licenseNo: "KA-01-2017-007711", status: "OFF_DUTY" },
  { id: "d5", name: "Ramesh Yadav", phone: "+91 98205 56789", licenseNo: "GJ-06-2020-005522", status: "AVAILABLE" },
];

const mockClients = [
  { id: "c1", code: "CLT-METRO", name: "Metro Cash & Carry", city: "Mumbai", status: "ACTIVE" },
  { id: "c2", code: "CLT-RELIANCE", name: "Reliance Retail Ltd", city: "Bengaluru", status: "ACTIVE" },
  { id: "c3", code: "CLT-AMAZON", name: "Amazon Fulfillment IN", city: "Hyderabad", status: "ACTIVE" },
  { id: "c4", code: "CLT-FLIPKART", name: "Flipkart Internet Logistics", city: "Delhi", status: "ACTIVE" },
  { id: "c5", code: "CLT-DMART", name: "Avenue Supermarts (DMart)", city: "Pune", status: "ACTIVE" },
];

const mockVendors = [
  { id: "vn1", name: "Swift Logistics 3PL", code: "VND-SWIFT", city: "Mumbai", active: true },
  { id: "vn2", name: "Express Roadways Corp", code: "VND-EXPR", city: "Delhi", active: true },
  { id: "vn3", name: "Blueline Freight Carriers", code: "VND-BLUE", city: "Bengaluru", active: true },
  { id: "vn4", name: "Mahalaxmi Transport", code: "VND-MAHA", city: "Ahmedabad", active: true },
  { id: "vn5", name: "Southern Cross Logistics", code: "VND-SOUT", city: "Chennai", active: true },
];

const mockRoutes = [
  { id: "r1", routeCode: "MUM-BLR-01", origin: "Bhiwandi, Mumbai", destination: "Whitefield, Bengaluru", distanceKm: 980 },
  { id: "r2", routeCode: "DEL-MUM-01", origin: "Dharuhera, Delhi NCR", destination: "Kalamboli, Mumbai", distanceKm: 1420 },
  { id: "r3", routeCode: "BLR-HYD-01", origin: "Nelamangala, Bengaluru", destination: "Shamshabad, Hyderabad", distanceKm: 570 },
  { id: "r4", routeCode: "PUN-AMD-01", origin: "Chakan, Pune", destination: "Changodar, Ahmedabad", distanceKm: 650 },
  { id: "r5", routeCode: "CHN-BLR-01", origin: "Sriperumbudur, Chennai", destination: "Hosur, Bengaluru", distanceKm: 340 },
];

const mockRateCards = [
  { id: "rc1", client: "Metro Cash & Carry", vehicleType: "16T Eicher", baseRate: 48000, perKmRate: 42, active: true },
  { id: "rc2", client: "Reliance Retail Ltd", vehicleType: "32T Tata Prima", baseRate: 85000, perKmRate: 65, active: true },
  { id: "rc3", client: "Amazon Fulfillment IN", vehicleType: "24T Ashok Leyland", baseRate: 64000, perKmRate: 54, active: true },
  { id: "rc4", client: "Flipkart Internet Logistics", vehicleType: "16T BharatBenz", baseRate: 51000, perKmRate: 44, active: true },
  { id: "rc5", client: "Avenue Supermarts (DMart)", vehicleType: "10T Eicher Pro", baseRate: 36000, perKmRate: 35, active: true },
];

const mockTrips = [
  { id: "t1", tripNumber: "TRP-202610-0001", status: "IN_PROGRESS", client: "Metro Cash & Carry", destination: "Whitefield, Bengaluru" },
  { id: "t2", tripNumber: "TRP-202610-0002", status: "DISPATCHED", client: "Reliance Retail Ltd", destination: "Kalamboli, Mumbai" },
  { id: "t3", tripNumber: "TRP-202610-0003", status: "POD_SUBMITTED", client: "Amazon Fulfillment IN", destination: "Shamshabad, Hyderabad" },
  { id: "t4", tripNumber: "TRP-202610-0004", status: "SETTLED", client: "Flipkart Internet Logistics", destination: "Chakan, Pune" },
  { id: "t5", tripNumber: "TRP-202610-0005", status: "PLANNED", client: "Avenue Supermarts (DMart)", destination: "Hosur, Bengaluru" },
];

const mockInvoices = [
  { id: "i1", invoiceNumber: "INV-202610-0001", client: "Metro Cash & Carry", total: 118000, status: "PENDING_APPROVAL" },
  { id: "i2", invoiceNumber: "INV-202610-0002", client: "Reliance Retail Ltd", total: 245000, status: "APPROVED" },
  { id: "i3", invoiceNumber: "INV-202610-0003", client: "Amazon Fulfillment IN", total: 89000, status: "AUDIT_CLEARED" },
  { id: "i4", invoiceNumber: "INV-202610-0004", client: "Flipkart Internet Logistics", total: 165000, status: "PAID" },
  { id: "i5", invoiceNumber: "INV-202610-0005", client: "Avenue Supermarts (DMart)", total: 72000, status: "UNDER_REVIEW" },
];

const mockVendorSettlements = [
  { id: "s1", settlementNumber: "SET-202610-0001", vendor: "Swift Logistics 3PL", amount: 96000, status: "CLEARED" },
  { id: "s2", settlementNumber: "SET-202610-0002", vendor: "Express Roadways Corp", amount: 182000, status: "PENDING" },
  { id: "s3", settlementNumber: "SET-202610-0003", vendor: "Blueline Freight Carriers", amount: 64000, status: "IN_REVIEW" },
  { id: "s4", settlementNumber: "SET-202610-0004", vendor: "Mahalaxmi Transport", amount: 125000, status: "APPROVED" },
  { id: "s5", settlementNumber: "SET-202610-0005", vendor: "Southern Cross Logistics", amount: 53000, status: "CLEARED" },
];

const mockAuditsQueue = [
  { id: "a1", auditNumber: "AUD-202610-0001", tripId: "t3", anomalyType: "DETENTION_VARIANCE", status: "QUEUED" },
  { id: "a2", auditNumber: "AUD-202610-0002", tripId: "t1", anomalyType: "TOLL_DISCREPANCY", status: "IN_REVIEW" },
  { id: "a3", auditNumber: "AUD-202610-0003", tripId: "t4", anomalyType: "POD_LEGIBILITY", status: "QUEUED" },
  { id: "a4", auditNumber: "AUD-202610-0004", tripId: "t2", anomalyType: "KM_TOLERANCE_EXCEEDED", status: "ESCALATED" },
  { id: "a5", auditNumber: "AUD-202610-0005", tripId: "t5", anomalyType: "RATE_CARD_MISMATCH", status: "RESOLVED" },
];

function paginatedResponse(data: unknown[]) {
  return HttpResponse.json({
    data,
    meta: {
      total: data.length,
      limit: 50,
      offset: 0,
    },
  });
}

export const handlers = [
  // 1. POST /api/v1/auth/login
  http.post("*/api/v1/auth/login", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
    };
    const emailKey = body?.email?.toLowerCase().trim();
    const user = emailKey ? USERS_BY_EMAIL[emailKey] : undefined;

    if (user) {
      return HttpResponse.json({
        accessToken: `mock-jwt-${user.role}`,
        user,
      });
    }

    return HttpResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid email or password.",
        },
      },
      { status: 401 }
    );
  }),

  // 2. POST /api/v1/auth/refresh
  http.post("*/api/v1/auth/refresh", () => {
    return HttpResponse.json({
      accessToken: `mock-refreshed-${Date.now()}`,
    });
  }),

  // 3. POST /api/v1/auth/logout
  http.post("*/api/v1/auth/logout", () => {
    return HttpResponse.json({
      success: true,
    });
  }),

  // 4. POST /api/v1/auth/accept-invite
  http.post("*/api/v1/auth/accept-invite", () => {
    return HttpResponse.json({
      success: true,
    });
  }),

  // 5. GET /api/v1/auth/me
  http.get("*/api/v1/auth/me", () => {
    return HttpResponse.json({
      id: "u1",
      email: "admin@vecto.dev",
      role: "ADMIN",
      displayId: "ADM-01",
    });
  }),

  // 6. GET /api/v1/users
  http.get("*/api/v1/users", () => paginatedResponse(mockUsers)),

  // 7. GET /api/v1/vehicles
  http.get("*/api/v1/vehicles", () => paginatedResponse(mockVehicles)),

  // 8. GET /api/v1/drivers
  http.get("*/api/v1/drivers", () => paginatedResponse(mockDrivers)),

  // 9. GET /api/v1/clients
  http.get("*/api/v1/clients", () => paginatedResponse(mockClients)),

  // 10. GET /api/v1/vendors
  http.get("*/api/v1/vendors", () => paginatedResponse(mockVendors)),

  // 11. GET /api/v1/routes
  http.get("*/api/v1/routes", () => paginatedResponse(mockRoutes)),

  // 12. GET /api/v1/rate-cards
  http.get("*/api/v1/rate-cards", () => paginatedResponse(mockRateCards)),

  // 13. GET /api/v1/trips
  http.get("*/api/v1/trips", () => paginatedResponse(mockTrips)),

  // 14. GET /api/v1/invoices
  http.get("*/api/v1/invoices", () => paginatedResponse(mockInvoices)),

  // 15. GET /api/v1/vendor-settlements
  http.get("*/api/v1/vendor-settlements", () => paginatedResponse(mockVendorSettlements)),

  // 16. GET /api/v1/audits/queue
  http.get("*/api/v1/audits/queue", () => paginatedResponse(mockAuditsQueue)),
];
