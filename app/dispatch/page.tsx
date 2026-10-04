"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { apiClient, ApiError } from "@/lib/api/client";
import type { Trip, Paginated } from "@/lib/api/types";
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
  { label: "Driver operations", href: "/driver", icon: Users },
  { label: "Accounts & billing", href: "/accounts", icon: Banknote },
  { label: "Audit desk", href: "/audit", icon: FileCheck2 },
  { label: "Client portal", href: "/client-portal", icon: Boxes },
  { label: "Administration", href: "/admin", icon: Settings2 },
];

const filters: TripFilter[] = ["All trips", "In transit", "Delayed", "At hub"];

function formatRupees(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

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
    return "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]";
  }
  if (s === "DELAYED") {
    return "border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]";
  }
  if (s === "EOD_PENDING" || s === "EOD PENDING") {
    return "border-[#fde68a] bg-[#fffbeb] text-[#a16207]";
  }
  if (s === "DELIVERED" || s === "SETTLED") {
    return "border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]";
  }
  return "border-[#ddd6fe] bg-[#f5f3ff] text-[#6d28d9]";
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase() || "TR";
}

export default function DispatchPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<TripFilter>("All trips");

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
    const searchText = `${trip.id ?? ""} ${trip.tripNumber ?? ""} ${trip.vehicle ?? ""} ${trip.driver ?? ""} ${trip.origin ?? ""} ${trip.destination ?? ""} ${trip.client ?? ""}`.toLowerCase();
    return matchesFilter && searchText.includes(query.trim().toLowerCase());
  });

  const liveDispatched = trips.filter((t) => t.status === "IN_PROGRESS").length;
  const expectedCODInbound = trips.reduce(
    (sum, t) => sum + (typeof t.expectedCollection === "number" ? t.expectedCollection : Number(t.expectedCollection) || 0),
    0
  );
  const pendingEODAudit = trips.filter((t) => t.status === "EOD_PENDING").length;
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
    <main className="min-h-screen bg-[#f4f7fb] text-[#13243a] lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="hidden min-h-screen flex-col bg-[#0b1d38] px-5 py-6 text-white lg:flex">
        <Link href="/dispatch" className="flex items-center gap-3 px-2" aria-label="Vecto Logistics overview">
          <span className="grid h-10 w-10 place-items-center rounded-[12px] border border-white/10 bg-gradient-to-br from-[#1769ff] to-[#38bdf8] shadow-lg shadow-blue-950/30">
            <Truck className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-bold tracking-[0.04em]">VECTO <span className="font-medium text-[#b8c8dc]">LOGISTICS</span></span>
            <span className="mt-1 block text-[9px] font-semibold tracking-[0.16em] text-[#89a0bd]">CONTROL TOWER</span>
          </span>
        </Link>

        <div className="mt-10 px-3 text-[10px] font-bold tracking-[0.16em] text-[#8197b2]">WORKSPACE</div>
        <nav className="mt-3 grid gap-1" aria-label="Workspace navigation">
          {navigation.map(({ label, href, icon: Icon }) => {
            const isActive = href === "/dispatch";
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-[9px] px-3 text-[13px] font-medium transition-colors ${isActive ? "bg-[#173b6c] text-white shadow-inner shadow-white/[0.03]" : "text-[#b5c4d7] hover:bg-white/[0.06] hover:text-white"}`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-[#65baff]" : "text-[#8da2bc]"}`} />
                {label}
                {label === "Audit desk" && pendingEODAudit > 0 && <span className="ml-auto rounded-full bg-[#f59e0b] px-2 py-0.5 text-[10px] font-bold text-[#182234]">{pendingEODAudit}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-[12px] border border-white/10 bg-white/[0.045] p-4">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-[#d8e4f1]"><ShieldCheck className="h-4 w-4 text-[#55c5a0]" /> Live workspace</div>
          <p className="mb-0 mt-2 text-[10px] leading-5 text-[#91a5bd]">Connected to operational dispatch and settlement endpoints.</p>
        </div>
      </aside>

      <section className="min-w-0">
        <header className="flex min-h-[68px] items-center justify-between border-b border-[#e2e8f0] bg-[#ffffff] px-5 sm:px-8">
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-[#8795a8]">Vecto Logistics <span className="mx-1.5 text-[#c4ced9]">/</span> <span className="text-[#41536b]">Dispatch</span></div>
            <div className="mt-1 text-[12px] font-semibold text-[#142640]">Bhiwandi Terminal #4 <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-[#21a67a] align-middle" /></div>
          </div>
          <div className="flex items-center gap-3 sm:gap-5">
            <div className="hidden items-center gap-2 text-[12px] font-medium text-[#5d6f85] sm:flex"><CalendarDays className="h-4 w-4 text-[#8998aa]" /> Today</div>
            <button type="button" className="relative grid h-9 w-9 place-items-center rounded-[9px] border border-[#e3e9f0] bg-[#ffffff] text-[#63758b] transition hover:bg-[#f7f9fc]" aria-label="Notifications">
              <Bell className="h-4 w-4" /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#1769ff] ring-2 ring-white" />
            </button>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#e6efff] text-[11px] font-bold text-[#2257a8]">AM</span>
          </div>
        </header>

        <div className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 sm:py-9">
          <nav className="mb-6 flex gap-2 overflow-x-auto pb-1 lg:hidden" aria-label="Workspace navigation">
            {navigation.map(({ label, href }) => <Link key={href} href={href} className={`shrink-0 rounded-full border px-3 py-2 text-[11px] font-semibold ${href === "/dispatch" ? "border-[#1769ff] bg-[#1769ff] text-white" : "border-[#dfe6ef] bg-[#ffffff] text-[#586b82]"}`}>{label}</Link>)}
          </nav>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-[0.15em] text-[#1769ff]"><Activity className="h-3.5 w-3.5" /> OPERATIONS OVERVIEW</div>
              <h1 className="text-[26px] font-bold leading-tight text-[#10233d] sm:text-[30px]">Dispatch control tower</h1>
              <p className="mt-2 text-[13px] text-[#718198]">Fleet movement and settlement readiness for active trips.</p>
            </div>
            <div className="flex items-center gap-2 rounded-[9px] border border-[#dde5ef] bg-[#ffffff] px-3 py-2 text-[11px] font-semibold text-[#40546e]"><span className="h-2 w-2 rounded-full bg-[#1769ff]" /> Active dispatch feed</div>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map(({ label, value, detail, icon: Icon, tone }) => {
              const iconColor = tone === "blue" ? "text-[#1769ff] bg-[#edf4ff]" : tone === "cyan" ? "text-[#0783a8] bg-[#e8f8fc]" : tone === "amber" ? "text-[#c2760a] bg-[#fff5e7]" : "text-[#16825e] bg-[#eaf8f2]";
              return (
                <article key={label} className="rounded-[12px] border border-[#e2e8f0] bg-[#ffffff] p-4 shadow-[0_2px_8px_rgba(16,35,61,0.025)] sm:p-5">
                  <div className="flex items-start justify-between gap-3"><div><div className="text-[11px] font-semibold text-[#7b8ba0]">{label}</div><div className="mt-3 text-[25px] font-bold leading-none text-[#142640]">{value}</div></div><span className={`grid h-9 w-9 place-items-center rounded-[9px] ${iconColor}`}><Icon className="h-[17px] w-[17px]" /></span></div>
                  <div className="mt-3 text-[10px] text-[#8b99aa]">{detail}</div>
                </article>
              );
            })}
          </div>

          <div className="mt-6 grid items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_310px]">
            <section className="min-w-0 overflow-hidden rounded-[12px] border border-[#e2e8f0] bg-[#ffffff] shadow-[0_2px_8px_rgba(16,35,61,0.025)]" aria-labelledby="fleet-heading">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#edf0f4] px-4 py-4 sm:px-5">
                <div><h2 id="fleet-heading" className="text-[15px] font-bold text-[#172b45]">Live fleet</h2><p className="mt-1 text-[11px] text-[#8291a4]">Track active trips across the network</p></div>
                <div className="relative w-full sm:w-[230px]"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98a5b5]" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search trips, drivers, routes" aria-label="Search trips, drivers, and routes" className="h-9 w-full rounded-[8px] border border-[#dfe6ee] bg-[#fbfcfe] pl-9 pr-3 text-[11px] text-[#263c57] outline-none transition placeholder:text-[#9aa7b6] focus:border-[#70a4ff] focus:bg-[#ffffff] focus:ring-2 focus:ring-[#1769ff]/10" /></div>
              </div>

              <div className="flex gap-1 overflow-x-auto border-b border-[#edf0f4] px-4 pt-2 sm:px-5" role="group" aria-label="Filter trips">
                {filters.map((filter) => <button key={filter} type="button" onClick={() => setActiveFilter(filter)} aria-pressed={activeFilter === filter} className={`relative shrink-0 px-3 py-2.5 text-[11px] font-semibold transition-colors ${activeFilter === filter ? "text-[#1769ff] after:absolute after:inset-x-3 after:bottom-0 after:h-[2px] after:rounded-full after:bg-[#1769ff]" : "text-[#78899d] hover:text-[#344c68]"}`}>{filter}{filter === "All trips" && <span className="ml-1.5 text-[10px] text-[#9aa8b7]">{trips.length}</span>}</button>)}
              </div>

              {error && (
                <div className="mx-4 my-3 rounded-[8px] border border-red-200 bg-red-50 p-3 text-[12px] font-medium text-red-700 sm:mx-5">
                  {error}
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left">
                  <thead>
                    <tr className="bg-[#fafbfd] text-[9px] font-bold tracking-[0.08em] text-[#91a0b0]">
                      <th className="px-5 py-3">TRIP / VEHICLE</th>
                      <th className="px-4 py-3">DRIVER</th>
                      <th className="px-4 py-3">ROUTE</th>
                      <th className="px-4 py-3">ETA</th>
                      <th className="px-4 py-3">STATUS</th>
                      <th className="px-5 py-3 text-right">COD</th>
                      <th className="px-4 py-3 text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf0f4]">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-12 text-center text-[12px] text-[#8291a4]">
                          <div className="flex items-center justify-center gap-2">
                            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#1769ff] border-t-transparent" />
                            <span>Loading trips...</span>
                          </div>
                        </td>
                      </tr>
                    ) : trips.length === 0 && !error ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-12 text-center text-[12px] text-[#8291a4]">
                          No active trips
                        </td>
                      </tr>
                    ) : visibleTrips.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-12 text-center text-[12px] text-[#8291a4]">
                          No trips match this search.
                        </td>
                      </tr>
                    ) : (
                      visibleTrips.map((trip) => {
                        const tripId = String(trip.id ?? "");
                        const tripNumber = String(trip.tripNumber ?? trip.id ?? "");
                        const vehicle = String(trip.vehicle ?? trip.client ?? "—");
                        const driverName = String(trip.driver ?? "Unassigned");
                        const origin = String(trip.origin ?? "Hub");
                        const destination = String(trip.destination ?? "Destination");
                        const eta = String(trip.eta ?? "In transit");
                        const status = String(trip.status ?? "IN_PROGRESS");
                        const cod = typeof trip.expectedCollection === "number" ? trip.expectedCollection : Number(trip.expectedCollection) || 0;

                        return (
                          <tr key={tripId} className="transition-colors hover:bg-[#fbfdff]">
                            <td className="px-5 py-3.5">
                              <div className="text-[11px] font-bold text-[#253b58]">{tripNumber}</div>
                              <div className="mt-1 text-[10px] text-[#8998aa]">{vehicle}</div>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2">
                                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#edf3fa] text-[9px] font-bold text-[#526b88]">
                                  {getInitials(driverName)}
                                </span>
                                <span className="whitespace-nowrap text-[10px] font-semibold text-[#475b74]">
                                  {driverName}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-1.5 text-[10px] font-medium text-[#435973]">
                                <MapPin className="h-3 w-3 shrink-0 text-[#1769ff]" />
                                {origin}
                                <ArrowRight className="h-3 w-3 shrink-0 text-[#a5b0bd]" />
                                {destination}
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-[10px] font-semibold text-[#4a5e77]">{eta}</td>
                            <td className="px-4 py-3.5">
                              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[9px] font-semibold ${getStatusStyle(status)}`}>
                                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                {formatStatus(status)}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right text-[10px] font-semibold tabular-nums text-[#354a64]">
                              {formatRupees(cod)}
                            </td>
                            <td className="px-4 py-3.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openExpenseModal(trip)}
                                  className="rounded-[6px] border border-[#d2def0] bg-[#ffffff] px-2 py-1 text-[10px] font-semibold text-[#1e427b] transition hover:bg-[#edf4ff]"
                                >
                                  Log Expense
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openCloseTripModal(trip)}
                                  className="rounded-[6px] border border-[#fde68a] bg-[#fffbeb] px-2 py-1 text-[10px] font-semibold text-[#92400e] transition hover:bg-[#fef3c7]"
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
              <div className="flex items-center justify-between border-t border-[#edf0f4] px-5 py-3 text-[10px] text-[#8997a8]">
                <span>Showing {visibleTrips.length} of {trips.length} trips</span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#21a67a]" /> Live operational data
                </span>
              </div>
            </section>

            <aside className="grid gap-5">
              <section className="rounded-[12px] border border-[#e2e8f0] bg-[#ffffff] p-4 shadow-[0_2px_8px_rgba(16,35,61,0.025)] sm:p-5" aria-labelledby="attention-heading">
                <div className="flex items-center justify-between"><div><h2 id="attention-heading" className="text-[14px] font-bold text-[#172b45]">Needs attention</h2><p className="mt-1 text-[10px] text-[#8796a8]">Items to keep operations moving</p></div><span className="grid h-8 w-8 place-items-center rounded-[8px] bg-[#fff5e7] text-[#c2760a]"><AlertTriangle className="h-4 w-4" /></span></div>
                <div className="mt-4 divide-y divide-[#edf0f4]">
                  <div className="flex gap-3 py-3"><span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-[8px] bg-[#fff4e8] text-[#d17b10]"><Clock3 className="h-3.5 w-3.5" /></span><div><div className="text-[11px] font-semibold text-[#354a64]">Arrival tracking</div><p className="mb-0 mt-1 text-[10px] leading-4 text-[#8695a7]">Check live transit routes and arrival milestones.</p></div></div>
                  <div className="flex gap-3 py-3"><span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-[8px] bg-[#eef4ff] text-[#3475d8]"><FileCheck2 className="h-3.5 w-3.5" /></span><div><div className="text-[11px] font-semibold text-[#354a64]">EOD reconciliation due</div><p className="mb-0 mt-1 text-[10px] leading-4 text-[#8695a7]">Reconcile tolls, fuel, and actual cash on completion.</p></div></div>
                </div>
                <Link href="/audit" className="mt-2 flex items-center justify-between border-t border-[#edf0f4] pt-3 text-[10px] font-bold text-[#1769ff] hover:text-[#0c4fc4]">Open audit desk <ArrowUpRight className="h-3.5 w-3.5" /></Link>
              </section>

              <section className="rounded-[12px] border border-[#dce7f5] bg-[#edf5ff] p-4 sm:p-5" aria-labelledby="settlement-heading">
                <div className="flex items-center justify-between"><div className="text-[10px] font-bold tracking-[0.1em] text-[#46709f]">SETTLEMENT READINESS</div><ArrowDownRight className="h-4 w-4 text-[#4b85c8]" /></div>
                <div className="mt-3 flex items-end gap-2"><span className="text-[28px] font-bold leading-none text-[#153c70]">100%</span><span className="pb-0.5 text-[10px] font-semibold text-[#32805f]">Active</span></div>
                <p id="settlement-heading" className="mb-0 mt-2 text-[10px] leading-4 text-[#66809f]">Reconciled shipments with verified settlement data.</p>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#d8e7f8]"><div className="h-full w-full rounded-full bg-gradient-to-r from-[#1769ff] to-[#38bdf8]" /></div>
              </section>
            </aside>
          </div>

          <footer className="mt-7 flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#99a5b4]"><span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Vecto Logistics Operations</span><span>Control tower <span className="mx-1.5">·</span> Active workspace</span></footer>
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
              <div className="mt-5 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={modalLoading}
                  onClick={() => setExpenseModalOpen(false)}
                  className="rounded-[8px] border border-[#dfe6ee] px-3 py-1.5 text-xs font-semibold text-[#586b82] hover:bg-[#f7f9fc]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="rounded-[8px] bg-[#1769ff] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#1255d4] disabled:opacity-50"
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
          <div className="w-full max-w-md rounded-[12px] bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-[#10233d]">
              Close Trip (EOD) — {String(selectedTripForEod.tripNumber || selectedTripForEod.id)}
            </h3>
            <p className="mt-1 text-xs text-[#718198]">Submit end-of-day reconciliation data for audit clearance.</p>
            {modalError && (
              <div className="mt-3 rounded-md bg-red-50 p-2.5 text-xs text-red-700">
                {modalError}
              </div>
            )}
            <form onSubmit={handleCloseTripSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#40546e]">Toll Expenses (₹)</label>
                <input
                  type="number"
                  value={tollAmount}
                  onChange={(e) => setTollAmount(e.target.value)}
                  placeholder="0"
                  className="mt-1 h-9 w-full rounded-[8px] border border-[#dfe6ee] bg-[#fbfcfe] px-3 text-xs text-[#263c57] outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#40546e]">Driver Allowance (₹)</label>
                <input
                  type="number"
                  value={allowanceAmount}
                  onChange={(e) => setAllowanceAmount(e.target.value)}
                  placeholder="0"
                  className="mt-1 h-9 w-full rounded-[8px] border border-[#dfe6ee] bg-[#fbfcfe] px-3 text-xs text-[#263c57] outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#40546e]">Fuel Expenses (₹)</label>
                <input
                  type="number"
                  value={fuelAmount}
                  onChange={(e) => setFuelAmount(e.target.value)}
                  placeholder="0"
                  className="mt-1 h-9 w-full rounded-[8px] border border-[#dfe6ee] bg-[#fbfcfe] px-3 text-xs text-[#263c57] outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#40546e]">Actual COD Cash Collected (₹)</label>
                <input
                  type="number"
                  value={actualCashAmount}
                  onChange={(e) => setActualCashAmount(e.target.value)}
                  placeholder="0"
                  className="mt-1 h-9 w-full rounded-[8px] border border-[#dfe6ee] bg-[#fbfcfe] px-3 text-xs text-[#263c57] outline-none"
                />
              </div>
              <div className="mt-5 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={modalLoading}
                  onClick={() => setEodModalOpen(false)}
                  className="rounded-[8px] border border-[#dfe6ee] px-3 py-1.5 text-xs font-semibold text-[#586b82] hover:bg-[#f7f9fc]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="rounded-[8px] bg-[#1769ff] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#1255d4] disabled:opacity-50"
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
