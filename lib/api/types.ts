export type Role =
  | "ADMIN"
  | "DISPATCH_MANAGER"
  | "DRIVER"
  | "AUDITOR"
  | "ACCOUNTS"
  | "CLIENT_AP"
  | "VENDOR_3PL";

export type ApiErrorShape = {
  error: {
    code: string;
    message: string;
  };
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: Role;
    displayId: string;
    redirectPath: string;
  };
};

export type RefreshResponse = {
  accessToken: string;
};

export type Paginated<T> = {
  data: T[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
};

// TODO: expand when backend ships
export type Trip = Record<string, unknown>;
export type Invoice = Record<string, unknown>;
export type User = Record<string, unknown>;
export type Vehicle = Record<string, unknown>;
export type Driver = Record<string, unknown>;
export type Client = Record<string, unknown>;
export type Vendor = Record<string, unknown>;
export type Route = Record<string, unknown>;
export type RateCard = Record<string, unknown>;
export type Settlement = Record<string, unknown>;
