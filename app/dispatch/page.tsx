"use client";

import Link from "next/link";
import { useState } from "react";
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

type TripStatus = "In transit" | "Delayed" | "Unloading" | "EOD pending";
type TripFilter = "All trips" | "In transit" | "Delayed" | "At hub";

const trips: {
  id: string;
  vehicle: string;
  driver: string;
  initials: string;
  origin: string;
  destination: string;
  eta: string;
  status: TripStatus;
  cod: number;
}[] = [
  { id: "TRIP-8842", vehicle: "KA 01 AJ 3319", driver: "Manjunath S.", initials: "MS", origin: "Hosur DC", destination: "Whitefield, Bengaluru", eta: "14:20", status: "In transit", cod: 24500 },
  { id: "TRIP-8841", vehicle: "MH 12 RN 4920", driver: "Rajesh Kumar", initials: "RK", origin: "Bhiwandi Hub", destination: "Sanand Industrial Park", eta: "15:05", status: "Delayed", cod: 48500 },
  { id: "TRIP-8839", vehicle: "TN 22 BQ 4109", driver: "Murugan Selvam", initials: "MS", origin: "Ennore Port", destination: "Coimbatore ICD", eta: "At dock", status: "Unloading", cod: 41000 },
  { id: "TRIP-8837", vehicle: "HR 55 AH 7812", driver: "Sukhwinder Singh", initials: "SS", origin: "Gurugram DC", destination: "Jaipur North Hub", eta: "16:40", status: "In transit", cod: 36200 },
  { id: "TRIP-8835", vehicle: "DL 1M 6023", driver: "Virender Tyagi", initials: "VT", origin: "Okhla Hub", destination: "Lucknow Central", eta: "17:15", status: "In transit", cod: 58700 },
  { id: "TRIP-8832", vehicle: "GJ 01 TX 9044", driver: "Aarav Patel", initials: "AP", origin: "Sanand Plant", destination: "Bhiwandi Hub", eta: "Complete", status: "EOD pending", cod: 31200 },
];

const navigation = [
  { label: "Overview", href: "/dispatch", icon: LayoutDashboard },
  { label: "Driver operations", href: "/driver", icon: Users },
  { label: "Accounts & billing", href: "/accounts", icon: Banknote },
  { label: "Audit desk", href: "/audit", icon: FileCheck2 },
  { label: "Client portal", href: "/client-portal", icon: Boxes },
  { label: "Administration", href: "/admin", icon: Settings2 },
];

const filters: TripFilter[] = ["All trips", "In transit", "Delayed", "At hub"];

const statusStyle: Record<TripStatus, string> = {
  "In transit": "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]",
  Delayed: "border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]",
  Unloading: "border-[#ddd6fe] bg-[#f5f3ff] text-[#6d28d9]",
  "EOD pending": "border-[#fde68a] bg-[#fffbeb] text-[#a16207]",
};

function formatRupees(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function DispatchPage() {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<TripFilter>("All trips");

  const visibleTrips = trips.filter((trip) => {
    const matchesFilter =
      activeFilter === "All trips" ||
      trip.status === activeFilter ||
      (activeFilter === "At hub" && (trip.status === "Unloading" || trip.status === "EOD pending"));
    const searchText = `${trip.id} ${trip.vehicle} ${trip.driver} ${trip.origin} ${trip.destination}`.toLowerCase();
    return matchesFilter && searchText.includes(query.trim().toLowerCase());
  });
  const activeCount = trips.filter((trip) => trip.status === "In transit" || trip.status === "Delayed" || trip.status === "Unloading").length;
  const delayedCount = trips.filter((trip) => trip.status === "Delayed").length;
  const eodCount = trips.filter((trip) => trip.status === "EOD pending").length;
  const codTotal = trips.reduce((total, trip) => total + trip.cod, 0);

  const metrics = [
    { label: "Active trips", value: String(activeCount).padStart(2, "0"), detail: "Across 4 operating hubs", icon: Truck, tone: "blue" },
    { label: "Expected COD", value: formatRupees(codTotal), detail: "Across today's manifest", icon: Banknote, tone: "cyan" },
    { label: "Delayed shipments", value: String(delayedCount).padStart(2, "0"), detail: "Requires attention", icon: AlertTriangle, tone: "amber" },
    { label: "Pending EOD audit", value: String(eodCount).padStart(2, "0"), detail: "Ready for reconciliation", icon: FileCheck2, tone: "green" },
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
                {label === "Audit desk" && eodCount > 0 && <span className="ml-auto rounded-full bg-[#f59e0b] px-2 py-0.5 text-[10px] font-bold text-[#182234]">{eodCount}</span>}
              </Link>
            );
          })}
        </nav>

          <div className="mt-auto rounded-[12px] border border-white/10 bg-white/[0.045] p-4">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-[#d8e4f1]"><ShieldCheck className="h-4 w-4 text-[#55c5a0]" /> Demo workspace</div>
          <p className="mb-0 mt-2 text-[10px] leading-5 text-[#91a5bd]">Sample operations view for dispatch and settlement roles.</p>
        </div>
      </aside>

      <section className="min-w-0">
        <header className="flex min-h-[68px] items-center justify-between border-b border-[#e2e8f0] bg-[#ffffff] px-5 sm:px-8">
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-[#8795a8]">Vecto Logistics <span className="mx-1.5 text-[#c4ced9]">/</span> <span className="text-[#41536b]">Dispatch</span></div>
            <div className="mt-1 text-[12px] font-semibold text-[#142640]">Bhiwandi Terminal #4 <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-[#21a67a] align-middle" /></div>
          </div>
          <div className="flex items-center gap-3 sm:gap-5">
            <div className="hidden items-center gap-2 text-[12px] font-medium text-[#5d6f85] sm:flex"><CalendarDays className="h-4 w-4 text-[#8998aa]" /> Saturday, 03 October</div>
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
              <p className="mt-2 text-[13px] text-[#718198]">Fleet movement and settlement readiness for the demo network.</p>
            </div>
            <div className="flex items-center gap-2 rounded-[9px] border border-[#dde5ef] bg-[#ffffff] px-3 py-2 text-[11px] font-semibold text-[#40546e]"><span className="h-2 w-2 rounded-full bg-[#1769ff]" /> Demo snapshot <span className="ml-1 text-[#a0adbd]">Sample dispatch data</span></div>
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

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left">
                  <thead><tr className="bg-[#fafbfd] text-[9px] font-bold tracking-[0.08em] text-[#91a0b0]"><th className="px-5 py-3">TRIP / VEHICLE</th><th className="px-4 py-3">DRIVER</th><th className="px-4 py-3">ROUTE</th><th className="px-4 py-3">ETA</th><th className="px-4 py-3">STATUS</th><th className="px-5 py-3 text-right">COD</th></tr></thead>
                  <tbody className="divide-y divide-[#edf0f4]">
                    {visibleTrips.map((trip) => (
                      <tr key={trip.id} className="transition-colors hover:bg-[#fbfdff]">
                        <td className="px-5 py-3.5"><div className="text-[11px] font-bold text-[#253b58]">{trip.id}</div><div className="mt-1 text-[10px] text-[#8998aa]">{trip.vehicle}</div></td>
                        <td className="px-4 py-3.5"><div className="flex items-center gap-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#edf3fa] text-[9px] font-bold text-[#526b88]">{trip.initials}</span><span className="whitespace-nowrap text-[10px] font-semibold text-[#475b74]">{trip.driver}</span></div></td>
                        <td className="px-4 py-3.5"><div className="flex items-center gap-1.5 text-[10px] font-medium text-[#435973]"><MapPin className="h-3 w-3 shrink-0 text-[#1769ff]" />{trip.origin}<ArrowRight className="h-3 w-3 shrink-0 text-[#a5b0bd]" />{trip.destination}</div></td>
                        <td className="px-4 py-3.5 text-[10px] font-semibold text-[#4a5e77]">{trip.eta}</td>
                        <td className="px-4 py-3.5"><span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[9px] font-semibold ${statusStyle[trip.status]}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{trip.status}</span></td>
                        <td className="px-5 py-3.5 text-right text-[10px] font-semibold tabular-nums text-[#354a64]">{formatRupees(trip.cod)}</td>
                      </tr>
                    ))}
                    {visibleTrips.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center text-[12px] text-[#8291a4]">No trips match this search.</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-[#edf0f4] px-5 py-3 text-[10px] text-[#8997a8]"><span>Showing {visibleTrips.length} of {trips.length} trips</span><span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-[#21a67a]" /> Demo data</span></div>
            </section>

            <aside className="grid gap-5">
              <section className="rounded-[12px] border border-[#e2e8f0] bg-[#ffffff] p-4 shadow-[0_2px_8px_rgba(16,35,61,0.025)] sm:p-5" aria-labelledby="attention-heading">
                <div className="flex items-center justify-between"><div><h2 id="attention-heading" className="text-[14px] font-bold text-[#172b45]">Needs attention</h2><p className="mt-1 text-[10px] text-[#8796a8]">Items to keep operations moving</p></div><span className="grid h-8 w-8 place-items-center rounded-[8px] bg-[#fff5e7] text-[#c2760a]"><AlertTriangle className="h-4 w-4" /></span></div>
                <div className="mt-4 divide-y divide-[#edf0f4]">
                  <div className="flex gap-3 py-3"><span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-[8px] bg-[#fff4e8] text-[#d17b10]"><Clock3 className="h-3.5 w-3.5" /></span><div><div className="text-[11px] font-semibold text-[#354a64]">Arrival running late</div><p className="mb-0 mt-1 text-[10px] leading-4 text-[#8695a7]">TRIP-8841 · Sanand delivery is 35 min behind ETA.</p></div></div>
                  <div className="flex gap-3 py-3"><span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-[8px] bg-[#eef4ff] text-[#3475d8]"><FileCheck2 className="h-3.5 w-3.5" /></span><div><div className="text-[11px] font-semibold text-[#354a64]">EOD reconciliation due</div><p className="mb-0 mt-1 text-[10px] leading-4 text-[#8695a7]">TRIP-8832 · POD received, settlement review pending.</p></div></div>
                </div>
                <Link href="/audit" className="mt-2 flex items-center justify-between border-t border-[#edf0f4] pt-3 text-[10px] font-bold text-[#1769ff] hover:text-[#0c4fc4]">Open audit desk <ArrowUpRight className="h-3.5 w-3.5" /></Link>
              </section>

              <section className="rounded-[12px] border border-[#dce7f5] bg-[#edf5ff] p-4 sm:p-5" aria-labelledby="settlement-heading">
                <div className="flex items-center justify-between"><div className="text-[10px] font-bold tracking-[0.1em] text-[#46709f]">SETTLEMENT READINESS</div><ArrowDownRight className="h-4 w-4 text-[#4b85c8]" /></div>
                <div className="mt-3 flex items-end gap-2"><span className="text-[28px] font-bold leading-none text-[#153c70]">83%</span><span className="pb-0.5 text-[10px] font-semibold text-[#32805f]">+6.4%</span></div>
                <p id="settlement-heading" className="mb-0 mt-2 text-[10px] leading-4 text-[#66809f]">5 of 6 active shipments have verified proof of delivery.</p>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#d8e7f8]"><div className="h-full w-[83%] rounded-full bg-gradient-to-r from-[#1769ff] to-[#38bdf8]" /></div>
              </section>
            </aside>
          </div>

          <footer className="mt-7 flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#99a5b4]"><span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Vecto Logistics operations demo</span><span>Control tower <span className="mx-1.5">·</span> Sample workspace</span></footer>
        </div>
      </section>
    </main>
  );
}
