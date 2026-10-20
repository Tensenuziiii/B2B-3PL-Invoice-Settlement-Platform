"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { apiClient, ApiError } from "@/lib/api/client";
import type { Trip, Paginated } from "@/lib/api/types";
import { getDisplayName, formatRupees, formatDate, logoutUser, getCurrentUser } from "@/lib/api/utils";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Bell,
  Boxes,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileCheck2,
  LayoutDashboard,
  LogOut,
  MapPin,
  Search,
  Settings2,
  ShieldCheck,
  Truck,
  Users,
} from "lucide-react";

type TripFilter = "All trips" | "In transit" | "Delayed" | "At hub";

const navigation = [
  { label: "Overview", href: "/dispatch", icon: LayoutDashboard },
  { label: "Driver Mobile", href: "/driver", icon: Users },
  { label: "Accounts & billing", href: "/accounts", icon: Banknote },
  { label: "Audit Desk", href: "/audit", icon: FileCheck2 },
  { label: "Client portal", href: "/client-portal", icon: Boxes },
  { label: "Administration", href: "/admin", icon: Settings2 },
];

const filters: TripFilter[] = ["All trips", "In transit", "Delayed", "At hub"];

function formatStatus(status: string) {
  if (status === "IN_PROGRESS") return "In transit";
  if (status === "EOD_PENDING") return "EOD pending";
  if (status === "DELIVERED") return "Delivered";
  if (status === "DISPATCHED") return "Dispatched";
  if (status === "POD_SUBMITTED") return "POD submitted";
  return status || "Active";
}

function getStatusStyle(status: string) {
  const s = status.toUpperCase();
  if (s === "IN_PROGRESS" || s === "IN TRANSIT" || s === "DISPATCHED") {
    return "border-royal/30 bg-royal/15 text-royal font-semibold";
  }
  if (s === "DELAYED") {
    return "border-magenta/30 bg-magenta/15 text-magenta font-semibold";
  }
  if (s === "EOD_PENDING" || s === "EOD PENDING" || s === "POD_SUBMITTED") {
    return "border-turquoise/30 bg-turquoise/15 text-void font-semibold";
  }
  if (s === "DELIVERED" || s === "SETTLED") {
    return "border-turquoise/40 bg-turquoise text-void font-bold";
  }
  return "border-slate-300 bg-slate-100 text-void font-medium";
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase() || "TR";
}

export default function DispatchPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<{ role?: string } | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<TripFilter>("All trips");

  useEffect(() => {
    const user = getCurrentUser();
    if (user) setCurrentUser(user);
    apiClient
      .get<{ role?: string }>("/auth/me")
      .then((profile) => {
        if (profile) setCurrentUser(profile);
      })
      .catch(() => {});
  }, []);

  const filteredNavigation = navigation.filter((item) => {
    if (item.href === "/audit") {
      return currentUser?.role === "ADMIN" || currentUser?.role === "AUDITOR";
    }
    if (item.href === "/driver") {
      return currentUser?.role === "ADMIN" || currentUser?.role === "DRIVER";
    }
    return true;
  });

  // Expense modal state
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [selectedTripForExpense, setSelectedTripForExpense] = useState<Trip | null>(null);
  const [expenseType, setExpenseType] = useState("FUEL");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseNote, setExpenseNote] = useState("");

  // EOD close trip modal state
  const [eodModalOpen, setEodModalOpen] = useState(false);
  const [selectedTripForEod, setSelectedTripForEod] = useState<Trip | null>(null);
  const [tollAmount, setTollAmount] = useState("");
  const [allowanceAmount, setAllowanceAmount] = useState("");
  const [fuelAmount, setFuelAmount] = useState("");
  const [actualCashAmount, setActualCashAmount] = useState("");

  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchTrips = async () => {
    try {
      const res = await apiClient.get<Paginated<Trip>>("/trips?status=active");
      setTrips(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load trips");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get<Paginated<Trip>>("/trips?status=active");
        if (!cancelled) setTrips(res.data);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load trips");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openExpenseModal = (trip: Trip) => {
    setSelectedTripForExpense(trip);
    setExpenseType("FUEL");
    setExpenseAmount("");
    setExpenseNote("");
    setModalError(null);
    setExpenseModalOpen(true);
  };

  const handleLogExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTripForExpense) return;
    const tripId = String(selectedTripForExpense.id);
    setModalLoading(true);
    setModalError(null);
    try {
      await apiClient.post(`/trips/${tripId}/expenses`, {
        type: expenseType,
        amount: Number(expenseAmount),
        note: expenseNote,
      });
      await fetchTrips();
      setExpenseModalOpen(false);
      setSelectedTripForExpense(null);
      setExpenseAmount("");
      setExpenseNote("");
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : "Failed to log expense");
    } finally {
      setModalLoading(false);
    }
  };

  const openCloseTripModal = (trip: Trip) => {
    setSelectedTripForEod(trip);
    setTollAmount("");
    setAllowanceAmount("");
    setFuelAmount("");
    setActualCashAmount("");
    setModalError(null);
    setEodModalOpen(true);
  };

  const handleCloseTripSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTripForEod) return;
    const tripId = String(selectedTripForEod.id);
    setModalLoading(true);
    setModalError(null);
    try {
      await apiClient.post(`/trips/${tripId}/eod`, {
        toll: Number(tollAmount),
        allowance: Number(allowanceAmount),
        fuel: Number(fuelAmount),
        actualCash: Number(actualCashAmount),
      });
      await fetchTrips();
      setEodModalOpen(false);
      setSelectedTripForEod(null);
      setTollAmount("");
      setAllowanceAmount("");
      setFuelAmount("");
      setActualCashAmount("");
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : "Failed to close trip");
    } finally {
      setModalLoading(false);
    }
  };

  const visibleTrips = trips.filter((trip) => {
    const tripStatus = String(trip.status ?? "");
    const matchesFilter =
      activeFilter === "All trips" ||
      tripStatus.toLowerCase() === activeFilter.toLowerCase() ||
      (activeFilter === "In transit" && (tripStatus === "IN_PROGRESS" || tripStatus === "In transit" || tripStatus === "DISPATCHED")) ||
      (activeFilter === "Delayed" && (tripStatus === "DELAYED" || tripStatus === "Delayed")) ||
      (activeFilter === "At hub" && (tripStatus === "Unloading" || tripStatus === "EOD pending" || tripStatus === "EOD_PENDING" || tripStatus === "POD_SUBMITTED"));
    const searchText = `${trip.id ?? ""} ${trip.tripNumber ?? ""} ${getDisplayName(trip.vehicle)} ${getDisplayName(trip.driver)} ${trip.origin ?? ""} ${trip.destination ?? ""} ${getDisplayName(trip.client)}`.toLowerCase();
    return matchesFilter && searchText.includes(query.trim().toLowerCase());
  });

  const getTripExpectedCollection = (t: Trip) =>
    t.tripStops?.reduce((s, st) => s + (st.expectedCollection ?? 0), 0) ??
    (typeof (t as any).expectedCollection === "number" ? (t as any).expectedCollection : Number((t as any).expectedCollection) || 0);

  const liveDispatched = trips.filter((t) => t.status === "IN_PROGRESS").length;
  const expectedCODInbound = trips.reduce(
    (sum, t) => sum + getTripExpectedCollection(t),
    0
  );
  const pendingEODAudit = trips.filter((t) => t.status === "AUDIT_PENDING" || (t.status as string) === "EOD_PENDING").length;
  const delivered = trips.filter((t) => t.status === "DELIVERED").length;

  const metrics = [
    {
      label: "Live Dispatched",
      value: String(liveDispatched).padStart(2, "0"),
      detail: "Currently in movement",
      icon: Truck,
      tone: "blue",
    },
    {
      label: "Expected COD Inbound",
      value: formatRupees(expectedCODInbound),
      detail: "Across active manifests",
      icon: Banknote,
      tone: "cyan",
    },
    {
      label: "Delivered",
      value: String(delivered).padStart(2, "0"),
      detail: "Successfully completed",
      icon: CheckCircle2,
      tone: "amber",
    },
    {
      label: "Pending EOD Audit",
      value: String(pendingEODAudit).padStart(2, "0"),
      detail: "Ready for reconciliation",
      icon: FileCheck2,
      tone: "green",
    },
  ];

  return (
    <main className="min-h-screen bg-platinum text-void lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="hidden min-h-screen flex-col bg-void px-5 py-6 text-platinum lg:flex border-r border-void/20">
        <Link href="/dispatch" className="flex items-center gap-3 px-2" aria-label="Vecto Logistics overview">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-royal text-white shadow-lg shadow-royal/30">
            <Truck className="h-6 w-6" />
          </span>
          <span>
            <span className="block text-base font-bold tracking-[0.04em]">VECTO <span className="font-medium text-slate-300">LOGISTICS</span></span>
            <span className="mt-1 block text-[10px] font-semibold tracking-[0.16em] text-turquoise">CONTROL TOWER</span>
          </span>
        </Link>

        <div className="mt-10 px-3 text-xs font-bold tracking-[0.16em] text-slate-400">WORKSPACE</div>
        <nav className="mt-3 grid gap-1.5" aria-label="Workspace navigation">
          {filteredNavigation.map(({ label, href, icon: Icon }) => {
            const isActive = href === "/dispatch";
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-12 items-center gap-3 rounded-lg px-3.5 text-sm font-semibold transition-colors ${isActive ? "bg-royal text-white shadow-md" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                {label}
                {label === "Audit Desk" && pendingEODAudit > 0 && <span className="ml-auto rounded-full bg-magenta px-2.5 py-0.5 text-xs font-bold text-white">{pendingEODAudit}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-xl border border-white/10 bg-white/[0.05] p-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-platinum"><ShieldCheck className="h-4 w-4 text-turquoise" /> Live workspace</div>
          <p className="mb-0 mt-2 text-xs leading-5 text-slate-300">Connected to operational dispatch and settlement endpoints.</p>
        </div>
        <button
          type="button"
          onClick={() => logoutUser(router)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-magenta/40 bg-magenta/15 py-2.5 text-xs font-semibold text-magenta hover:bg-magenta/25 transition cursor-pointer"
        >
          <LogOut className="h-4 w-4" /> Log Out
        </button>
      </aside>

      <section className="min-w-0">
        <header className="flex min-h-[72px] items-center justify-between border-b border-slate-200 bg-white px-6 sm:px-8">
          <div className="min-w-0">
            <div className="text-xs font-medium text-slate-500">Vecto Logistics <span className="mx-1.5 text-slate-300">/</span> <span className="text-slate-700">Dispatch</span></div>
            <div className="mt-1 text-sm font-bold text-void">Bhiwandi Terminal #4 <span className="ml-1 inline-block h-2 w-2 rounded-full bg-turquoise align-middle" /></div>
          </div>
          <div className="flex items-center gap-3 sm:gap-5">
            <div className="hidden items-center gap-2 text-xs font-semibold text-slate-600 sm:flex"><CalendarDays className="h-4 w-4 text-slate-500" /> Today</div>
            <button type="button" className="relative grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 shadow-sm" aria-label="Notifications">
              <Bell className="h-4 w-4" /><span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-royal ring-2 ring-white" />
            </button>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-royal/10 text-xs font-bold text-royal">AM</span>
            <button
              type="button"
              onClick={() => logoutUser(router)}
              className="flex items-center gap-1.5 rounded-lg border border-magenta/30 bg-white px-3 py-2 text-xs font-bold text-magenta hover:bg-magenta/10 transition shadow-sm cursor-pointer"
            >
              <LogOut className="h-4 w-4" /> Log Out
            </button>
          </div>
        </header>

        <div className="mx-auto max-w-[1500px] px-6 py-8 sm:px-8 sm:py-10">
          <nav className="mb-6 flex gap-2 overflow-x-auto pb-1 lg:hidden" aria-label="Workspace navigation">
            {filteredNavigation.map(({ label, href }) => <Link key={href} href={href} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold ${href === "/dispatch" ? "border-royal bg-royal text-white" : "border-slate-300 bg-white text-slate-700"}`}>{label}</Link>)}
          </nav>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-bold tracking-[0.15em] text-royal"><Activity className="h-4 w-4" /> OPERATIONS OVERVIEW</div>
              <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight text-void">Dispatch control tower</h1>
              <p className="mt-2 text-sm text-slate-600">Fleet movement and settlement readiness for active trips.</p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 shadow-sm"><span className="h-2.5 w-2.5 rounded-full bg-royal animate-pulse" /> Active dispatch feed</div>
          </div>

          <div className="mt-8 grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            {metrics.map(({ label, value, detail, icon: Icon, tone }) => {
              const iconColor = tone === "blue" ? "text-royal bg-royal/10" : tone === "cyan" ? "text-void bg-turquoise/25" : tone === "amber" ? "text-magenta bg-magenta/15" : "text-void bg-turquoise/20";
              return (
                <article key={label} className="rounded-xl border border-slate-200 bg-white p-6 shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-500">{label}</div>
                      <div className="mt-3 text-4xl font-bold leading-none text-void">{value}</div>
                    </div>
                    <span className={`grid h-11 w-11 place-items-center rounded-xl ${iconColor}`}><Icon className="h-5 w-5" /></span>
                  </div>
                  <div className="mt-3 text-xs text-slate-400">{detail}</div>
                </article>
              );
            })}
          </div>

          <div className="mt-8 grid items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_340px]">
            <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md" aria-labelledby="fleet-heading">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
                <div><h2 id="fleet-heading" className="text-lg font-bold text-void">Live fleet</h2><p className="mt-1 text-xs text-slate-500">Track active trips across the network</p></div>
                <div className="relative w-full sm:w-[260px]"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search trips, drivers, routes" aria-label="Search trips, drivers, and routes" className="h-10 w-full rounded-lg border border-slate-300 bg-slate-50/60 pl-9 pr-3 text-xs text-void outline-none transition placeholder:text-slate-400 focus:border-royal focus:bg-white focus:ring-2 focus:ring-royal/20" /></div>
              </div>

              <div className="flex gap-2 overflow-x-auto border-b border-slate-200 px-6 pt-3" role="group" aria-label="Filter trips">
                {filters.map((filter) => <button key={filter} type="button" onClick={() => setActiveFilter(filter)} aria-pressed={activeFilter === filter} className={`relative shrink-0 px-3 py-2.5 text-xs font-bold transition-colors ${activeFilter === filter ? "text-royal after:absolute after:inset-x-2 after:bottom-0 after:h-[2px] after:rounded-full after:bg-royal" : "text-slate-600 hover:text-void"}`}>{filter}{filter === "All trips" && <span className="ml-1.5 text-xs text-slate-400">({trips.length})</span>}</button>)}
              </div>

              {error && (
                <div className="mx-6 my-4 rounded-lg border border-magenta/30 bg-magenta/10 p-3.5 text-xs font-semibold text-magenta">
                  {error}
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left">
                  <thead>
                    <tr className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                      <th className="px-6 py-3.5">TRIP / VEHICLE</th>
                      <th className="px-5 py-3.5">DRIVER</th>
                      <th className="px-5 py-3.5">ROUTE</th>
                      <th className="px-5 py-3.5">ETA</th>
                      <th className="px-5 py-3.5">STATUS</th>
                      <th className="px-6 py-3.5 text-right">COD</th>
                      <th className="px-6 py-3.5 text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-500">
                          <div className="flex items-center justify-center gap-2">
                            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-royal border-t-transparent" />
                            <span>Loading trips...</span>
                          </div>
                        </td>
                      </tr>
                    ) : trips.length === 0 && !error ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-500">
                          No active trips
                        </td>
                      </tr>
                    ) : visibleTrips.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-500">
                          No trips match this search.
                        </td>
                      </tr>
                    ) : (
                      visibleTrips.map((trip) => {
                        const tripId = String(trip.id ?? "");
                        const tripNumber = String(trip.tripNumber ?? trip.id ?? "");
                        const vehicle = getDisplayName(trip.vehicle, getDisplayName(trip.client, "—"));
                        const driverName = getDisplayName(trip.driver, "Unassigned");
                        const origin = String(trip.origin ?? "Hub");
                        const destination = String(trip.destination ?? "Destination");
                        const eta = String(trip.eta ?? "In transit");
                        const status = String(trip.status ?? "IN_PROGRESS");
                        const cod = getTripExpectedCollection(trip);

                        return (
                          <tr key={tripId} className="transition-colors hover:bg-slate-50/80">
                            <td className="px-6 py-4">
                              <div className="text-sm font-bold text-void">{tripNumber}</div>
                              <div className="mt-1 text-xs text-slate-500">{vehicle}</div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-void">
                                  {getInitials(driverName)}
                                </span>
                                <span className="whitespace-nowrap text-sm font-semibold text-slate-800">
                                  {driverName}
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                                <MapPin className="h-4 w-4 shrink-0 text-royal" />
                                {origin}
                                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                {destination}
                              </div>
                            </td>
                            <td className="px-5 py-4 text-sm font-semibold text-slate-700">{eta}</td>
                            <td className="px-5 py-4">
                              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${getStatusStyle(status)}`}>
                                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                {formatStatus(status)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right text-sm font-bold tabular-nums text-void">
                              {formatRupees(cod)}
                            </td>
                            <td className="px-6 py-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => openExpenseModal(trip)}
                                  className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-void transition hover:bg-slate-100 shadow-sm"
                                >
                                  Log Expense
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openCloseTripModal(trip)}
                                  className="rounded-lg border-2 border-royal bg-transparent px-3.5 py-1.5 text-xs font-bold text-royal transition hover:bg-royal/10 shadow-sm"
                                >
                                  Close Trip
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 text-xs text-slate-500">
                <span>Showing {visibleTrips.length} of {trips.length} trips</span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-turquoise" /> Live operational data
                </span>
              </div>
            </section>

            <aside className="grid gap-6">
              <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-md" aria-labelledby="attention-heading">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 id="attention-heading" className="text-base font-bold text-void">Needs attention</h2>
                    <p className="mt-1 text-xs text-slate-500">Items to keep operations moving</p>
                  </div>
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-magenta/15 text-magenta"><AlertTriangle className="h-5 w-5" /></span>
                </div>
                <div className="mt-4 divide-y divide-slate-100">
                  <div className="flex gap-3 py-3.5">
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-magenta/10 text-magenta"><Clock3 className="h-4 w-4" /></span>
                    <div>
                      <div className="text-xs font-bold text-void">Arrival tracking</div>
                      <p className="mb-0 mt-1 text-xs leading-4 text-slate-500">Check live transit routes and arrival milestones.</p>
                    </div>
                  </div>
                  <div className="flex gap-3 py-3.5">
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-royal/10 text-royal"><FileCheck2 className="h-4 w-4" /></span>
                    <div>
                      <div className="text-xs font-bold text-void">EOD reconciliation due</div>
                      <p className="mb-0 mt-1 text-xs leading-4 text-slate-500">Reconcile tolls, fuel, and actual cash on completion.</p>
                    </div>
                  </div>
                </div>
                {(currentUser?.role === "ADMIN" || currentUser?.role === "AUDITOR") && (
                  <Link href="/audit" className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-bold text-royal hover:underline">Open audit desk <ArrowUpRight className="h-4 w-4" /></Link>
                )}
              </section>

              <section className="rounded-xl border border-royal/20 bg-royal/5 p-6 shadow-md" aria-labelledby="settlement-heading">
                <div className="flex items-center justify-between"><div className="text-xs font-bold tracking-[0.1em] text-royal">SETTLEMENT READINESS</div><ArrowDownRight className="h-4 w-4 text-royal" /></div>
                <div className="mt-3 flex items-end gap-2"><span className="text-3xl font-extrabold leading-none text-void">100%</span><span className="pb-0.5 text-xs font-bold text-turquoise">Active</span></div>
                <p id="settlement-heading" className="mb-0 mt-2 text-xs leading-5 text-slate-600">Reconciled shipments with verified settlement data.</p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-royal/20"><div className="h-full w-full rounded-full bg-royal" /></div>
              </section>
            </aside>
          </div>

          <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-turquoise" /> Vecto Logistics Operations</span><span>Control tower <span className="mx-1.5">·</span> Active workspace</span></footer>
        </div>
      </section>

      {/* Log Expense Modal */}
      {expenseModalOpen && selectedTripForExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-[12px] bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-[#10233d]">
              Log Expense — {String(selectedTripForExpense.tripNumber || selectedTripForExpense.id)}
            </h3>
            <p className="mt-1 text-xs text-[#718198]">Record an operational expense incurred during transit.</p>
            {modalError && (
              <div className="mt-3 rounded-md bg-red-50 p-2.5 text-xs text-red-700">
                {modalError}
              </div>
            )}
            <form onSubmit={handleLogExpenseSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#40546e]">Expense Type</label>
                <select
                  value={expenseType}
                  onChange={(e) => setExpenseType(e.target.value)}
                  className="mt-1 h-9 w-full rounded-[8px] border border-[#dfe6ee] bg-[#fbfcfe] px-3 text-xs text-[#263c57] outline-none"
                >
                  <option value="FUEL">Fuel</option>
                  <option value="TOLL">Toll</option>
                  <option value="ALLOWANCE">Driver Allowance</option>
                  <option value="REPAIR">Maintenance & Repair</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#40546e]">Amount (₹)</label>
                <input
                  type="number"
                  required
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  placeholder="e.g. 1500"
                  className="mt-1 h-9 w-full rounded-[8px] border border-[#dfe6ee] bg-[#fbfcfe] px-3 text-xs text-[#263c57] outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#40546e]">Note / Reason</label>
                <input
                  type="text"
                  value={expenseNote}
                  onChange={(e) => setExpenseNote(e.target.value)}
                  placeholder="e.g. Expressway toll receipt"
                  className="mt-1 h-9 w-full rounded-[8px] border border-[#dfe6ee] bg-[#fbfcfe] px-3 text-xs text-[#263c57] outline-none"
                />
              </div>
              <div className="mt-6 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={modalLoading}
                  onClick={() => setExpenseModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="rounded-lg bg-royal px-5 py-2 text-sm font-bold text-white hover:bg-royal/90 transition shadow-md disabled:opacity-50"
                >
                  {modalLoading ? "Saving..." : "Log Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Close Trip (EOD) Modal */}
      {eodModalOpen && selectedTripForEod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-void">
              Close Trip (EOD) — {String(selectedTripForEod.tripNumber || selectedTripForEod.id)}
            </h3>
            <p className="mt-1 text-xs text-slate-500">Submit end-of-day reconciliation data for audit clearance.</p>
            {modalError && (
              <div className="mt-3 rounded-md bg-magenta/10 border border-magenta/30 p-2.5 text-xs font-semibold text-magenta">
                {modalError}
              </div>
            )}
            <form onSubmit={handleCloseTripSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700">Toll Expenses (₹)</label>
                <input
                  type="number"
                  value={tollAmount}
                  onChange={(e) => setTollAmount(e.target.value)}
                  placeholder="0"
                  className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-void outline-none focus:border-royal focus:ring-2 focus:ring-royal/20"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700">Driver Allowance (₹)</label>
                <input
                  type="number"
                  value={allowanceAmount}
                  onChange={(e) => setAllowanceAmount(e.target.value)}
                  placeholder="0"
                  className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-void outline-none focus:border-royal focus:ring-2 focus:ring-royal/20"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700">Fuel Expenses (₹)</label>
                <input
                  type="number"
                  value={fuelAmount}
                  onChange={(e) => setFuelAmount(e.target.value)}
                  placeholder="0"
                  className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-void outline-none focus:border-royal focus:ring-2 focus:ring-royal/20"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700">Actual COD Cash Collected (₹)</label>
                <input
                  type="number"
                  value={actualCashAmount}
                  onChange={(e) => setActualCashAmount(e.target.value)}
                  placeholder="0"
                  className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-void outline-none focus:border-royal focus:ring-2 focus:ring-royal/20"
                />
              </div>
              <div className="mt-6 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={modalLoading}
                  onClick={() => setEodModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="rounded-lg bg-royal px-5 py-2 text-sm font-bold text-white hover:bg-royal/90 transition shadow-md disabled:opacity-50"
                >
                  {modalLoading ? "Closing..." : "Close Trip"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
