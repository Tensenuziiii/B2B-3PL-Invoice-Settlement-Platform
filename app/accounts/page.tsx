"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Receipt,
  FileText,
  Clock,
  Settings,
  Search,
  CheckCircle2,
  DollarSign,
  AlertCircle,
  Truck,
  ExternalLink,
  Smartphone,
  LayoutDashboard,
  FileCheck2,
  Printer,
  Download,
  Building,
  CreditCard,
  Send,
  Building2,
  ArrowUpRight,
  Filter,
  CheckSquare,
  Square,
  Calendar,
  Layers,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

import { apiClient, ApiError } from "@/lib/api/client";
import type { Trip, Invoice, Paginated } from "@/lib/api/types";

// Types
interface CreditNote {
  noteNo: string;
  invoiceNo: string;
  clientName: string;
  issueDate: string;
  amount: number;
  reason: string;
  status: "Draft" | "Issued";
}

export default function LogisticsAccountsBilling() {
  const [activeMenu, setActiveMenu] = useState("Unbilled Trips");
  const [activeTab, setActiveTab] = useState("pending-billing");
  const [searchQuery, setSearchQuery] = useState("");

  // API State
  const [unbilledTrips, setUnbilledTrips] = useState<Trip[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedTripIds, setSelectedTripIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Credit Notes State
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [creditNoteInvoiceNo, setCreditNoteInvoiceNo] = useState("");
  const [creditNoteAmount, setCreditNoteAmount] = useState("");
  const [creditNoteReason, setCreditNoteReason] = useState("");

  // Settings State
  const [apContactEmail, setApContactEmail] = useState("billing.finance@vectologistics.in");
  const [billingPreferences, setBillingPreferences] = useState({
    invoiceReminders: true,
    overdueAlerts: true,
    fridayAutoBatch: true,
  });
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Modal State for Invoice Generation Preview
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

  // On mount, fetch both lists in parallel
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [tripsRes, invoicesRes] = await Promise.all([
          apiClient.get<Paginated<Trip>>("/trips?status=READY_FOR_BILLING"),
          apiClient.get<Paginated<Invoice>>("/invoices"),
        ]);
        if (!cancelled) {
          setUnbilledTrips(tripsRes.data);
          setInvoices(invoicesRes.data);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load billing data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Sync default credit note invoice when invoices load
  useEffect(() => {
    if (invoices.length > 0 && !creditNoteInvoiceNo) {
      const firstOpen = invoices.find((inv) => String(inv.status ?? "").toUpperCase() !== "PAID");
      if (firstOpen) {
        setCreditNoteInvoiceNo(String(firstOpen.invoiceNumber ?? firstOpen.invoiceNo ?? firstOpen.id ?? ""));
      }
    }
  }, [invoices, creditNoteInvoiceNo]);

  // Dynamic GST rate: read from the most recent invoice's gst_rate if available, else 18 as fallback
  const gstRate = useMemo(() => {
    if (invoices.length > 0) {
      const raw = invoices[0].gst_rate ?? invoices[0].gstRate;
      if (raw !== undefined && raw !== null) {
        const num = Number(raw);
        if (!isNaN(num) && num > 0) {
          return num <= 1 ? num * 100 : num;
        }
      }
    }
    return 18;
  }, [invoices]);

  // Filtered Unbilled Trips
  const filteredUnbilledTrips = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return unbilledTrips.filter((t) => {
      if (!q) return true;
      const id = String(t.id ?? "");
      const client = String(t.clientName ?? t.client ?? "");
      const lr = String(t.lrNumber ?? t.tripNumber ?? "");
      const dest = String(t.destination ?? "");
      return (
        id.toLowerCase().includes(q) ||
        client.toLowerCase().includes(q) ||
        lr.toLowerCase().includes(q) ||
        dest.toLowerCase().includes(q)
      );
    });
  }, [unbilledTrips, searchQuery]);

  // Filtered AR Invoices
  const filteredArInvoices = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return invoices.filter((invoice) => {
      if (!query) return true;
      const invNo = String(invoice.invoiceNumber ?? invoice.invoiceNo ?? invoice.id ?? "");
      const client = String(invoice.clientName ?? invoice.client ?? "");
      const status = String(invoice.status ?? "");
      return `${invNo} ${client} ${status}`.toLowerCase().includes(query);
    });
  }, [invoices, searchQuery]);

  // Filtered Credit Notes
  const filteredCreditNotes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return creditNotes.filter((note) =>
      !query || `${note.noteNo} ${note.invoiceNo} ${note.clientName} ${note.reason} ${note.status}`.toLowerCase().includes(query),
    );
  }, [creditNotes, searchQuery]);

  // Financial aggregates
  const unbilledTotal = useMemo(() => {
    return unbilledTrips.reduce((total, trip) => {
      const freight = Number(trip.amount ?? trip.baseFreight ?? trip.freightCharge ?? 0);
      const toll = Number(trip.tollCharge ?? 0);
      const dem = Number(trip.demurrageCharge ?? 0);
      return total + freight + toll + dem;
    }, 0);
  }, [unbilledTrips]);

  const openArInvoices = useMemo(() => {
    return invoices.filter((invoice) => String(invoice.status ?? "").toUpperCase() !== "PAID");
  }, [invoices]);

  const openArTotal = useMemo(() => {
    return openArInvoices.reduce((total, invoice) => {
      return total + Number(invoice.totalAmount ?? invoice.total ?? 0);
    }, 0);
  }, [openArInvoices]);

  const overdueArInvoices = useMemo(() => {
    return invoices.filter((invoice) => String(invoice.status ?? "").toUpperCase() === "OVERDUE");
  }, [invoices]);

  const overdueArTotal = useMemo(() => {
    return overdueArInvoices.reduce((total, invoice) => {
      return total + Number(invoice.totalAmount ?? invoice.total ?? 0);
    }, 0);
  }, [overdueArInvoices]);

  const paidInvoices = useMemo(() => {
    return invoices.filter((invoice) => String(invoice.status ?? "").toUpperCase() === "PAID");
  }, [invoices]);

  // Selected Trips Objects
  const selectedTripsList = useMemo(() => {
    return unbilledTrips.filter((t) => selectedTripIds.includes(String(t.id ?? "")));
  }, [unbilledTrips, selectedTripIds]);

  // Financial Calculations for Selection
  const selectedSubtotal = useMemo(() => {
    return selectedTripsList.reduce((sum, trip) => {
      const freight = Number(trip.amount ?? trip.baseFreight ?? trip.freightCharge ?? 0);
      const toll = Number(trip.tollCharge ?? 0);
      const dem = Number(trip.demurrageCharge ?? 0);
      return sum + freight + toll + dem;
    }, 0);
  }, [selectedTripsList]);

  const selectedGst = useMemo(() => Math.round(selectedSubtotal * (gstRate / 100)), [selectedSubtotal, gstRate]);
  const selectedGrandTotal = selectedSubtotal + selectedGst;

  // Toggle selection
  const handleToggleSelectTrip = (id: string) => {
    setSelectedTripIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTripIds(filteredUnbilledTrips.map((t) => String(t.id ?? "")));
    } else {
      setSelectedTripIds([]);
    }
  };

  const isAllSelected =
    filteredUnbilledTrips.length > 0 &&
    filteredUnbilledTrips.every((t) => selectedTripIds.includes(String(t.id ?? "")));

  // Primary Client for Invoice Draft Modal
  const invoiceTargetClient = selectedTripsList[0] || unbilledTrips[0] || null;

  // Generate Invoice Handler
  const handleGenerateInvoice = async () => {
    if (selectedTripIds.length === 0) return;
    setGenerating(true);
    setError(null);
    try {
      const firstTrip = selectedTripsList[0];
      const clientId = String(
        firstTrip?.clientId ??
        firstTrip?.client_id ??
        firstTrip?.client ??
        "CLT-DEFAULT"
      );

      const todayStr = new Date().toISOString().split("T")[0];
      const dates = selectedTripsList
        .map((t) => String(t.deliveryDate ?? t.delivery_date ?? t.date ?? t.createdAt ?? ""))
        .filter(Boolean)
        .map((d) => new Date(d))
        .filter((d) => !isNaN(d.getTime()))
        .sort((a, b) => a.getTime() - b.getTime());

      const periodStart = dates.length > 0 ? dates[0].toISOString().split("T")[0] : todayStr;
      const periodEnd = dates.length > 0 ? dates[dates.length - 1].toISOString().split("T")[0] : todayStr;

      const res = await apiClient.post<{ invoiceNumber: string; total: number; gst: number }>(
        "/invoices",
        { clientId, tripIds: selectedTripIds, periodStart, periodEnd }
      );

      setNotice({
        type: "success",
        message: `Invoice ${res.invoiceNumber} successfully generated! Total: ₹${Number(res.total ?? 0).toLocaleString("en-IN")}.`,
      });
      setSelectedTripIds([]);
      setIsInvoiceModalOpen(false);

      // refetch both lists
      const [tripsRes, invoicesRes] = await Promise.all([
        apiClient.get<Paginated<Trip>>("/trips?status=READY_FOR_BILLING"),
        apiClient.get<Paginated<Invoice>>("/invoices"),
      ]);
      setUnbilledTrips(tripsRes.data);
      setInvoices(invoicesRes.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to generate invoice");
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateCreditNote = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const invoice = invoices.find((item) => String(item.invoiceNumber ?? item.invoiceNo ?? item.id) === creditNoteInvoiceNo);
    const amount = Number(creditNoteAmount);
    const totalAmount = Number(invoice?.totalAmount ?? invoice?.total ?? 0);
    if (!invoice || String(invoice.status ?? "").toUpperCase() === "PAID" || !Number.isFinite(amount) || amount <= 0 || amount > totalAmount) {
      return;
    }

    const note: CreditNote = {
      noteNo: `CN-${String(creditNotes.length + 1).padStart(4, "0")}`,
      invoiceNo: String(invoice.invoiceNumber ?? invoice.invoiceNo ?? invoice.id),
      clientName: String(invoice.clientName ?? invoice.client ?? "—"),
      issueDate: new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      amount,
      reason: creditNoteReason.trim(),
      status: "Draft",
    };
    setCreditNotes((current) => [...current, note]);
    setCreditNoteAmount("");
    setCreditNoteReason("");
  };

  const handleIssueCreditNote = (noteNo: string) => {
    setCreditNotes((current) =>
      current.map((note) => (note.noteNo === noteNo ? { ...note, status: "Issued" } : note))
    );
  };

  const handleSaveBillingPreferences = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSettingsSaved(true);
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-800 font-sans antialiased overflow-hidden">
      {/* 1. LEFT SIDEBAR (Brand-Consistent Vecto Logistics) */}
      <aside className="w-64 flex-shrink-0 flex flex-col border-r border-slate-200 bg-white">
        {/* Brand / Logo */}
        <div className="h-14 border-b border-slate-200 px-5 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="h-7 w-7 rounded-md bg-slate-900 flex items-center justify-center text-white font-bold text-xs shadow-xs">
              <Truck className="h-4 w-4" />
            </div>
            <div>
              <span className="font-semibold text-sm tracking-tight text-slate-900 block leading-tight">
                VECTO LOGISTICS
              </span>
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-600 block">
                ACCOUNTS & BILLING
              </span>
            </div>
          </div>
        </div>

        {/* Role Identity Tag */}
        <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 rounded-full bg-blue-600 ring-2 ring-blue-100" />
              <span className="text-xs font-medium text-slate-700">
                Logistics Accounts & Billing
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-600">ACC-01</span>
          </div>
          <p className="text-[11px] text-slate-600 mt-1 truncate">
            Corporate AR & Freight Invoicing
          </p>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {[
            { name: "Dashboard", icon: LayoutDashboard },
            { name: "Unbilled Trips", icon: Receipt, badge: `${unbilledTrips.length}` },
            { name: "Invoices & AR", icon: FileText, badge: `${invoices.length}` },
            { name: "Credit Notes", icon: CreditCard, badge: creditNotes.length ? `${creditNotes.length}` : null },
            { name: "Settings", icon: Settings, badge: null },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeMenu === item.name;
            return (
              <button
                key={item.name}
                type="button"
                onClick={() => {
                  setActiveMenu(item.name);
                  if (item.name === "Unbilled Trips") setActiveTab("pending-billing");
                  if (item.name === "Invoices & AR") setActiveTab("ar-invoices");
                  setSearchQuery("");
                }}
                aria-current={isActive ? "page" : undefined}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-slate-500"}`} />
                <span>{item.name}</span>
                {item.badge && (
                  <span
                    className={`ml-auto text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold ${
                      isActive
                        ? "bg-slate-800 text-slate-200"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Multi-Role Switcher Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/50">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 px-1 mb-1.5 block">
            Switch Platform Roles
          </span>
          <div className="space-y-1">
            <Link
              href="/dispatch"
              className="flex items-center justify-between text-xs text-slate-600 hover:text-slate-900 p-1.5 rounded hover:bg-slate-100 transition-colors"
            >
              <span className="flex items-center gap-1.5 font-medium">
                <LayoutDashboard className="h-3.5 w-3.5 text-slate-500" />
                Dispatch Ops
              </span>
              <ExternalLink className="h-3 w-3 text-slate-400" />
            </Link>
            <Link
              href="/audit"
              className="flex items-center justify-between text-xs text-slate-600 hover:text-slate-900 p-1.5 rounded hover:bg-slate-100 transition-colors"
            >
              <span className="flex items-center gap-1.5 font-medium">
                <FileCheck2 className="h-3.5 w-3.5 text-indigo-600" />
                Internal Audit
              </span>
              <ExternalLink className="h-3 w-3 text-slate-400" />
            </Link>
            <Link
              href="/driver"
              className="flex items-center justify-between text-xs text-slate-600 hover:text-slate-900 p-1.5 rounded hover:bg-slate-100 transition-colors"
            >
              <span className="flex items-center gap-1.5 font-medium">
                <Smartphone className="h-3.5 w-3.5 text-blue-600" />
                Driver Mobile
              </span>
              <ExternalLink className="h-3 w-3 text-slate-400" />
            </Link>
          </div>
        </div>
      </aside>

      {/* RIGHT MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* 2. TOP HEADER */}
        <header className="h-14 border-b border-slate-200 bg-white px-6 flex items-center justify-between gap-4 flex-shrink-0">
          {/* Search bar */}
          <div className="relative w-80">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              type="text"
              placeholder={activeMenu === "Settings" ? "Search unavailable in Settings" : "Search by Client, Invoice No, Trip ID..."}
              disabled={activeMenu === "Settings"}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs bg-slate-50/50 border-slate-200 focus-visible:bg-white"
            />
          </div>

          {/* Financial Metric Pills */}
          <div className="flex items-center space-x-3">
            <Badge
              variant="outline"
              className="bg-slate-50 border-slate-200 text-slate-700 font-mono text-xs px-2.5 py-1 flex items-center gap-1.5"
            >
              <span className="text-slate-500 font-sans">Outstanding AR:</span>
              <span className="font-bold text-slate-900">₹{openArTotal.toLocaleString("en-IN")}</span>
              <span className="text-slate-300">|</span>
              <span className="text-red-600 font-sans">Overdue:</span>
              <span className="font-bold text-red-600">₹{overdueArTotal.toLocaleString("en-IN")}</span>
              <span className="text-slate-300">|</span>
              <span className="text-emerald-700 font-sans">Ready to Bill:</span>
              <span className="font-bold text-emerald-700">₹{unbilledTotal.toLocaleString("en-IN")}</span>
            </Badge>

            <span className="text-xs text-slate-500 font-mono">
              GST Cycle: Oct 2026
            </span>
          </div>
        </header>

        {/* 3. MAIN CONTENT */}
        <main className="flex-1 overflow-y-auto p-6 space-y-4 relative">
          {/* Inline Dismissible Notification Alert */}
          {notice && (
            <div
              role="status"
              className={`p-3.5 border rounded-lg text-xs flex items-center justify-between shadow-xs animate-in fade-in-50 ${
                notice.type === "success"
                  ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                  : "bg-red-50 border-red-300 text-red-900"
              }`}
            >
              <div className="flex items-center space-x-2">
                {notice.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                )}
                <span className="font-medium">{notice.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setNotice(null)}
                className={`font-bold underline ${
                  notice.type === "success"
                    ? "text-emerald-700 hover:text-emerald-900"
                    : "text-red-700 hover:text-red-900"
                }`}
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div
              role="alert"
              className="p-3.5 bg-red-50 border border-red-300 rounded-lg text-red-900 text-xs flex items-center justify-between shadow-xs animate-in fade-in-50"
            >
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                <span className="font-medium">{error}</span>
              </div>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-red-700 hover:text-red-900 font-bold underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* DASHBOARD VIEW */}
          {activeMenu === "Dashboard" && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: "Unbilled Trips", value: unbilledTrips.length.toString(), meta: `₹${unbilledTotal.toLocaleString("en-IN")} ready to bill`, icon: Receipt },
                  { label: "Open Receivables", value: `₹${openArTotal.toLocaleString("en-IN")}`, meta: `${openArInvoices.length} open invoices`, icon: FileText },
                  { label: "Overdue Invoices", value: overdueArInvoices.length.toString(), meta: `₹${overdueArTotal.toLocaleString("en-IN")} outstanding`, icon: Clock },
                  { label: "Generated Invoices", value: invoices.length.toString(), meta: `${paidInvoices.length} paid`, icon: CheckCircle2 },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <Card key={item.label} className="shadow-none border-slate-200 bg-white">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between text-xs text-slate-600">
                          <span>{item.label}</span>
                          <Icon className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="mt-2 text-xl font-bold text-slate-900">{item.value}</div>
                        <div className="mt-1 text-[11px] text-slate-500">{item.meta}</div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <Card className="shadow-none border-slate-200 bg-white">
                <CardHeader className="p-4 border-b border-slate-200 flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-sm font-semibold text-slate-900">Recent Accounts Receivable</CardTitle>
                    <CardDescription className="mt-0.5 text-xs text-slate-500">Latest generated invoices and collection status.</CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setActiveMenu("Invoices & AR");
                      setActiveTab("ar-invoices");
                    }}
                    className="h-7 text-xs border-slate-300"
                  >
                    Open AR Ledger
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-slate-50/75">
                      <TableRow className="border-b border-slate-200">
                        <TableHead className="py-2.5 text-xs font-semibold text-slate-600">Invoice</TableHead>
                        <TableHead className="py-2.5 text-xs font-semibold text-slate-600">Client</TableHead>
                        <TableHead className="py-2.5 text-xs font-semibold text-slate-600">Due Date</TableHead>
                        <TableHead className="py-2.5 text-right text-xs font-semibold text-slate-600">Total</TableHead>
                        <TableHead className="py-2.5 text-center text-xs font-semibold text-slate-600">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-8 text-center text-xs text-slate-500">
                            Loading invoices...
                          </TableCell>
                        </TableRow>
                      ) : invoices.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-8 text-center text-xs text-slate-500">
                            No invoices generated yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        invoices.slice(0, 4).map((invoice) => {
                          const invNo = String(invoice.invoiceNumber ?? invoice.invoiceNo ?? invoice.id ?? "—");
                          const clientName = String(invoice.clientName ?? invoice.client ?? "—");
                          const dueDate = String(invoice.dueDate ?? "—");
                          const total = Number(invoice.totalAmount ?? invoice.total ?? 0);
                          const status = String(invoice.status ?? "PENDING");
                          const isPaid = status.toUpperCase() === "PAID";
                          const isOverdue = status.toUpperCase() === "OVERDUE";

                          return (
                            <TableRow key={invNo} className="border-b border-slate-200 text-xs">
                              <TableCell className="py-2.5 font-mono font-bold text-slate-900">{invNo}</TableCell>
                              <TableCell className="py-2.5 text-slate-700">{clientName}</TableCell>
                              <TableCell className="py-2.5 font-mono text-slate-600">{dueDate}</TableCell>
                              <TableCell className="py-2.5 text-right font-mono font-bold text-slate-900">
                                ₹{total.toLocaleString("en-IN")}
                              </TableCell>
                              <TableCell className="py-2.5 text-center">
                                <Badge
                                  variant="outline"
                                  className={
                                    isPaid
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                      : isOverdue
                                      ? "bg-red-50 text-red-700 border-red-300"
                                      : "bg-amber-50 text-amber-700 border-amber-300"
                                  }
                                >
                                  {status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* CREDIT NOTES VIEW */}
          {activeMenu === "Credit Notes" && (
            <div className="grid gap-4 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.2fr)]">
              <Card className="shadow-none border-slate-200 bg-white">
                <CardHeader className="p-4 border-b border-slate-200">
                  <CardTitle className="text-sm font-semibold text-slate-900">Create Credit Note</CardTitle>
                  <CardDescription className="mt-0.5 text-xs text-slate-500">Link a credit adjustment to an open invoice.</CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  <form onSubmit={handleCreateCreditNote} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="credit-invoice" className="text-xs font-semibold text-slate-700">Open invoice</Label>
                      <select
                        id="credit-invoice"
                        value={creditNoteInvoiceNo}
                        onChange={(event) => setCreditNoteInvoiceNo(event.target.value)}
                        className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900"
                      >
                        {openArInvoices.map((invoice) => {
                          const invNo = String(invoice.invoiceNumber ?? invoice.invoiceNo ?? invoice.id);
                          const total = Number(invoice.totalAmount ?? invoice.total ?? 0);
                          return (
                            <option key={invNo} value={invNo}>
                              {invNo} · ₹{total.toLocaleString("en-IN")}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="credit-amount" className="text-xs font-semibold text-slate-700">Credit amount (₹)</Label>
                      <Input
                        id="credit-amount"
                        type="number"
                        min="1"
                        step="1"
                        required
                        value={creditNoteAmount}
                        onChange={(event) => setCreditNoteAmount(event.target.value)}
                        className="h-9 text-xs"
                        placeholder="Enter amount"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="credit-reason" className="text-xs font-semibold text-slate-700">Reason</Label>
                      <Input
                        id="credit-reason"
                        required
                        maxLength={160}
                        value={creditNoteReason}
                        onChange={(event) => setCreditNoteReason(event.target.value)}
                        className="h-9 text-xs"
                        placeholder="e.g. Freight adjustment"
                      />
                    </div>
                    <Button type="submit" className="h-8 bg-blue-600 text-xs font-semibold text-white hover:bg-blue-500">
                      Save Draft Credit Note
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="shadow-none border-slate-200 bg-white">
                <CardHeader className="p-4 border-b border-slate-200 flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-sm font-semibold text-slate-900">Credit Notes</CardTitle>
                    <CardDescription className="mt-0.5 text-xs text-slate-500">Draft and issued adjustments.</CardDescription>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs">{filteredCreditNotes.length} Notes</Badge>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-slate-50/75">
                      <TableRow className="border-b border-slate-200">
                        <TableHead className="py-2.5 text-xs font-semibold text-slate-600">Credit Note</TableHead>
                        <TableHead className="py-2.5 text-xs font-semibold text-slate-600">Invoice / Client</TableHead>
                        <TableHead className="py-2.5 text-xs font-semibold text-slate-600">Reason</TableHead>
                        <TableHead className="py-2.5 text-right text-xs font-semibold text-slate-600">Amount</TableHead>
                        <TableHead className="py-2.5 text-center text-xs font-semibold text-slate-600">Status</TableHead>
                        <TableHead className="py-2.5 text-right text-xs font-semibold text-slate-600">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCreditNotes.length ? (
                        filteredCreditNotes.map((note) => (
                          <TableRow key={note.noteNo} className="border-b border-slate-200 text-xs">
                            <TableCell className="py-2.5 font-mono font-bold text-slate-900">
                              {note.noteNo}
                              <span className="block text-[10px] font-normal text-slate-500">{note.issueDate}</span>
                            </TableCell>
                            <TableCell className="py-2.5">
                              <div className="font-mono text-slate-800">{note.invoiceNo}</div>
                              <div className="text-[10px] text-slate-500">{note.clientName}</div>
                            </TableCell>
                            <TableCell className="py-2.5 text-slate-700">{note.reason}</TableCell>
                            <TableCell className="py-2.5 text-right font-mono font-bold text-slate-900">
                              ₹{note.amount.toLocaleString("en-IN")}
                            </TableCell>
                            <TableCell className="py-2.5 text-center">
                              <Badge
                                variant="outline"
                                className={
                                  note.status === "Issued"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                    : "bg-amber-50 text-amber-700 border-amber-300"
                                }
                              >
                                {note.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2.5 text-right">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={note.status === "Issued"}
                                onClick={() => handleIssueCreditNote(note.noteNo)}
                                className="h-7 text-[10px]"
                              >
                                {note.status === "Issued" ? "Issued" : "Issue"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="py-10 text-center text-sm text-slate-500">
                            No credit notes yet. Create a draft to begin.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* SETTINGS VIEW */}
          {activeMenu === "Settings" && (
            <Card className="max-w-3xl shadow-none border-slate-200 bg-white">
              <CardHeader className="p-4 border-b border-slate-200">
                <CardTitle className="text-sm font-semibold text-slate-900">Accounts & Billing Settings</CardTitle>
                <CardDescription className="mt-0.5 text-xs text-slate-500">Manage billing alerts and invoice batching preferences.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 p-5">
                <div className="grid gap-4 border-b border-slate-200 pb-4 sm:grid-cols-3">
                  <div>
                    <div className="text-[10px] uppercase text-slate-500">Legal Entity</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">Vecto Logistics India Pvt Ltd</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-slate-500">GSTIN</div>
                    <div className="mt-1 font-mono text-sm text-slate-800">—</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-slate-500">GST Cycle</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">Oct 2026</div>
                  </div>
                </div>
                <form onSubmit={handleSaveBillingPreferences} className="max-w-xl space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="billing-contact" className="text-xs font-semibold text-slate-700">Billing notification email</Label>
                    <Input
                      id="billing-contact"
                      type="email"
                      required
                      value={apContactEmail}
                      onChange={(event) => {
                        setApContactEmail(event.target.value);
                        setSettingsSaved(false);
                      }}
                      className="h-9 max-w-md text-xs"
                    />
                  </div>
                  <fieldset className="space-y-2">
                    <legend className="text-xs font-semibold text-slate-700">Billing preferences</legend>
                    {([
                      ["invoiceReminders", "Invoice approval and payment reminders"],
                      ["overdueAlerts", "Overdue receivable alerts"],
                      ["fridayAutoBatch", "Friday 18:00 IST invoice batching"],
                    ] as const).map(([key, label]) => (
                      <label key={key} className="flex max-w-md items-center justify-between border-b border-slate-200 py-2 text-xs text-slate-700">
                        <span>{label}</span>
                        <input
                          type="checkbox"
                          checked={billingPreferences[key]}
                          onChange={(event) => {
                            setBillingPreferences((current) => ({ ...current, [key]: event.target.checked }));
                            setSettingsSaved(false);
                          }}
                          className="h-4 w-4 accent-blue-500"
                        />
                      </label>
                    ))}
                  </fieldset>
                  <div className="flex items-center gap-3">
                    <Button type="submit" className="h-8 bg-blue-600 text-xs font-semibold text-white hover:bg-blue-500">
                      Save Settings
                    </Button>
                    {settingsSaved && <span role="status" className="text-xs font-medium text-emerald-600">Settings saved for this session.</span>}
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* DUAL-TAB LAYOUT (Unbilled Trips / Invoices & AR) */}
          {(activeMenu === "Unbilled Trips" || activeMenu === "Invoices & AR") && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
              {/* Tab Navigation Pill Bar */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <TabsList className="bg-slate-200/80 p-0.5 h-8">
                  <TabsTrigger
                    value="pending-billing"
                    className="h-7 text-xs font-semibold data-[state=active]:bg-white"
                  >
                    Pending Billing (Unbilled Trips)
                    <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700 font-mono">
                      {unbilledTrips.length}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="ar-invoices"
                    className="h-7 text-xs font-semibold data-[state=active]:bg-white"
                  >
                    Accounts Receivable (Generated Invoices)
                    <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700 font-mono">
                      {invoices.length}
                    </span>
                  </TabsTrigger>
                </TabsList>

                <div className="text-xs text-slate-500 font-mono">
                  Auto-batching: Every Friday 18:00 IST
                </div>
              </div>

              {/* ========================================================================= */}
              {/* TAB 1: PENDING BILLING (MAIN VIEW) */}
              {/* ========================================================================= */}
              <TabsContent value="pending-billing" className="space-y-4 mt-0">
                <Card className="shadow-none border-slate-200 bg-white">
                  <CardHeader className="p-4 border-b border-slate-200 flex flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle className="text-sm font-semibold text-slate-900">
                        Audit-Cleared Trips Ready for Billing
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500 mt-0.5">
                        Select individual or grouped trips for a client to generate consolidated GST tax invoices.
                      </CardDescription>
                    </div>
                    <div className="flex items-center space-x-2 text-xs">
                      <span className="text-slate-500">Showing {filteredUnbilledTrips.length} unbilled trips</span>
                    </div>
                  </CardHeader>

                  <CardContent className="p-0">
                    <Table>
                      <TableHeader className="bg-slate-50/75">
                        <TableRow className="border-b border-slate-200 hover:bg-transparent">
                          <TableHead className="w-10 py-2.5 text-center">
                            <Checkbox
                              checked={isAllSelected}
                              onCheckedChange={handleSelectAll}
                              aria-label="Select all trips"
                            />
                          </TableHead>
                          <TableHead className="text-xs font-semibold text-slate-600 py-2.5 w-[140px]">
                            Trip ID & LR No
                          </TableHead>
                          <TableHead className="text-xs font-semibold text-slate-600 py-2.5">
                            Client & Consignee
                          </TableHead>
                          <TableHead className="text-xs font-semibold text-slate-600 py-2.5 w-[150px]">
                            Route & Delivery Date
                          </TableHead>
                          <TableHead className="text-xs font-semibold text-slate-600 py-2.5 text-right w-[130px]">
                            Freight Charge
                          </TableHead>
                          <TableHead className="text-xs font-semibold text-slate-600 py-2.5 text-right w-[150px]">
                            Addl. Charges (Toll/Dem)
                          </TableHead>
                          <TableHead className="text-xs font-semibold text-slate-600 py-2.5 text-right w-[140px]">
                            Total Billable
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          <TableRow>
                            <TableCell colSpan={7} className="py-12 text-center text-xs text-slate-500">
                              <div className="flex flex-col items-center justify-center space-y-2">
                                <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                                <span>Loading unbilled trips...</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : filteredUnbilledTrips.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="py-12 text-center text-xs text-slate-500">
                              No unbilled trips ready for billing.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredUnbilledTrips.map((trip) => {
                            const tripId = String(trip.id ?? "");
                            const isSelected = selectedTripIds.includes(tripId);
                            const lrNo = String(trip.lrNumber ?? trip.tripNumber ?? "—");
                            const clientName = String(trip.clientName ?? trip.client ?? "—");
                            const clientGstin = String(trip.clientGstin ?? trip.gstin ?? "—");
                            const origin = String(trip.origin ?? "—");
                            const destination = String(trip.destination ?? "—");
                            const delDate = String(trip.deliveryDate ?? trip.eta ?? trip.date ?? "—");
                            const freightCharge = Number(trip.amount ?? trip.baseFreight ?? trip.freightCharge ?? 0);
                            const toll = Number(trip.tollCharge ?? 0);
                            const dem = Number(trip.demurrageCharge ?? 0);
                            const accessorials = toll + dem;
                            const netAmount = freightCharge + accessorials;

                            return (
                              <TableRow
                                key={tripId}
                                className={`border-b border-slate-200 text-xs transition-colors ${
                                  isSelected ? "bg-blue-50/40" : "hover:bg-slate-50/70"
                                }`}
                              >
                                {/* Checkbox */}
                                <TableCell className="text-center py-2.5">
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => handleToggleSelectTrip(tripId)}
                                    aria-label={`Select ${tripId}`}
                                  />
                                </TableCell>

                                {/* Trip ID & LR */}
                                <TableCell className="py-2.5 font-mono">
                                  <div className="font-bold text-slate-900">{tripId}</div>
                                  <div className="text-[10px] text-slate-500 font-sans">{lrNo}</div>
                                </TableCell>

                                {/* Client */}
                                <TableCell className="py-2.5">
                                  <div className="font-medium text-slate-900">{clientName}</div>
                                  <div className="text-[10px] text-slate-500 font-mono">
                                    GSTIN: {clientGstin}
                                  </div>
                                </TableCell>

                                {/* Route & Delivery */}
                                <TableCell className="py-2.5">
                                  <div className="text-slate-800 truncate max-w-[150px]">
                                    {origin} → {destination}
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-mono">
                                    Del: {delDate}
                                  </div>
                                </TableCell>

                                {/* Freight Charge */}
                                <TableCell className="py-2.5 text-right font-mono font-medium text-slate-800">
                                  ₹{freightCharge.toLocaleString("en-IN")}
                                </TableCell>

                                {/* Additional Charges */}
                                <TableCell className="py-2.5 text-right font-mono text-slate-700">
                                  <div>₹{accessorials.toLocaleString("en-IN")}</div>
                                  <div className="text-[10px] text-slate-500">
                                    Toll: ₹{toll.toLocaleString("en-IN")} • Dem: ₹{dem.toLocaleString("en-IN")}
                                  </div>
                                </TableCell>

                                {/* Total Billable */}
                                <TableCell className="py-2.5 text-right font-mono font-bold text-slate-900">
                                  ₹{netAmount.toLocaleString("en-IN")}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>

                  <div className="p-3 bg-slate-50/50 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
                    <span>Selected: {selectedTripIds.length} of {filteredUnbilledTrips.length} trips</span>
                    <span className="font-mono">Audit Certification: Digital POD Cleared</span>
                  </div>
                </Card>
              </TabsContent>

              {/* ========================================================================= */}
              {/* TAB 2: ACCOUNTS RECEIVABLE (GENERATED INVOICES) */}
              {/* ========================================================================= */}
              <TabsContent value="ar-invoices" className="space-y-4 mt-0">
                <Card className="shadow-none border-slate-200 bg-white">
                  <CardHeader className="p-4 border-b border-slate-200 flex flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle className="text-sm font-semibold text-slate-900">
                        Accounts Receivable Ledger
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500 mt-0.5">
                        Track published GST invoices, overdue collections, and client settlement status.
                      </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" className="h-7 text-xs border-slate-200">
                      <Download className="h-3 w-3 mr-1" /> Export AR Aging (.CSV)
                    </Button>
                  </CardHeader>

                  <CardContent className="p-0">
                    <Table>
                      <TableHeader className="bg-slate-50/75">
                        <TableRow className="border-b border-slate-200">
                          <TableHead className="text-xs font-semibold text-slate-600 py-2.5 w-[160px]">
                            Invoice No
                          </TableHead>
                          <TableHead className="text-xs font-semibold text-slate-600 py-2.5">
                            Client Account
                          </TableHead>
                          <TableHead className="text-xs font-semibold text-slate-600 py-2.5 w-[140px]">
                            Issue / Due Date
                          </TableHead>
                          <TableHead className="text-xs font-semibold text-slate-600 py-2.5 text-center w-[90px]">
                            Trips
                          </TableHead>
                          <TableHead className="text-xs font-semibold text-slate-600 py-2.5 text-right w-[130px]">
                            Subtotal
                          </TableHead>
                          <TableHead className="text-xs font-semibold text-slate-600 py-2.5 text-right w-[140px]">
                            Grand Total ({gstRate}% GST)
                          </TableHead>
                          <TableHead className="text-xs font-semibold text-slate-600 py-2.5 text-center w-[110px]">
                            Status
                          </TableHead>
                          <TableHead className="text-xs font-semibold text-slate-600 py-2.5 text-right w-[120px]">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          <TableRow>
                            <TableCell colSpan={8} className="py-12 text-center text-xs text-slate-500">
                              <div className="flex flex-col items-center justify-center space-y-2">
                                <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                                <span>Loading accounts receivable invoices...</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : filteredArInvoices.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="py-12 text-center text-xs text-slate-500">
                              No invoices found in ledger.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredArInvoices.map((inv) => {
                            const invNo = String(inv.invoiceNumber ?? inv.invoiceNo ?? inv.id ?? "—");
                            const clientName = String(inv.clientName ?? inv.client ?? "—");
                            const issueDate = String(inv.issueDate ?? inv.createdAt ?? "—");
                            const dueDate = String(inv.dueDate ?? "—");
                            const tripsCount = Array.isArray(inv.tripIds)
                              ? inv.tripIds.length
                              : Array.isArray(inv.trips)
                              ? inv.trips.length
                              : typeof inv.tripsCount === "number"
                              ? inv.tripsCount
                              : 1;
                            const totalAmount = Number(inv.totalAmount ?? inv.total ?? 0);
                            const gstAmount = Number(inv.gstAmount ?? inv.gst ?? 0);
                            const subtotal = typeof inv.subtotal === "number" ? inv.subtotal : totalAmount - gstAmount;
                            const status = String(inv.status ?? "PENDING");
                            const isPaid = status.toUpperCase() === "PAID";
                            const isOverdue = status.toUpperCase() === "OVERDUE";

                            return (
                              <TableRow key={invNo} className="border-b border-slate-200 text-xs">
                                <TableCell className="py-2.5 font-mono font-bold text-slate-900">
                                  {invNo}
                                </TableCell>
                                <TableCell className="py-2.5 font-medium text-slate-800">
                                  {clientName}
                                </TableCell>
                                <TableCell className="py-2.5 font-mono text-[11px] text-slate-600">
                                  <div>Iss: {issueDate}</div>
                                  <div>Due: {dueDate}</div>
                                </TableCell>
                                <TableCell className="py-2.5 text-center font-mono text-slate-700">
                                  {tripsCount}
                                </TableCell>
                                <TableCell className="py-2.5 text-right font-mono text-slate-800">
                                  ₹{subtotal.toLocaleString("en-IN")}
                                </TableCell>
                                <TableCell className="py-2.5 text-right font-mono font-bold text-slate-900">
                                  ₹{totalAmount.toLocaleString("en-IN")}
                                </TableCell>
                                <TableCell className="py-2.5 text-center">
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                      isPaid
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                        : isOverdue
                                        ? "bg-red-50 text-red-700 border-red-300"
                                        : "bg-amber-50 text-amber-700 border-amber-300"
                                    }`}
                                  >
                                    {status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="py-2.5 text-right">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled
                                    title="PDF generation coming soon"
                                    className="h-6 text-[10px] px-2 border-slate-200 opacity-60 cursor-not-allowed"
                                  >
                                    PDF
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}

          {/* STICKY BOTTOM ACTION BAR (Appears when rows are selected in Tab 1) */}
          {activeMenu === "Unbilled Trips" && activeTab === "pending-billing" && selectedTripIds.length > 0 && (
            <div className="fixed bottom-6 left-72 right-8 z-30 animate-in slide-in-from-bottom-4 duration-200">
              <div className="bg-slate-900 text-white rounded-xl p-3.5 px-5 shadow-2xl border border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-6">
                  <div className="flex items-center space-x-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <span className="font-bold text-sm">
                      {selectedTripIds.length} Trips Selected
                    </span>
                  </div>

                  <div className="text-xs font-mono text-slate-300 flex items-center space-x-4 border-l border-slate-700 pl-4">
                    <span>
                      Subtotal: <strong className="text-white">₹{selectedSubtotal.toLocaleString("en-IN")}</strong>
                    </span>
                    <span>
                      Est. GST ({gstRate}%): <strong className="text-white">₹{selectedGst.toLocaleString("en-IN")}</strong>
                    </span>
                    <span>
                      Grand Total: <strong className="text-emerald-400 font-bold">₹{selectedGrandTotal.toLocaleString("en-IN")}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedTripIds([])}
                    className="h-8 text-xs bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white"
                  >
                    Clear Selection
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsInvoiceModalOpen(true)}
                    className="h-8 text-xs bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white flex items-center gap-1.5"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Draft Preview
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={generating}
                    onClick={handleGenerateInvoice}
                    className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 shadow-md flex items-center gap-1.5"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {generating ? "Generating..." : "Generate Invoice"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ========================================================================= */}
      {/* WIDGET: INVOICE DRAFT GENERATOR (MODAL / DIALOG) */}
      {/* ========================================================================= */}
      <Dialog open={isInvoiceModalOpen} onOpenChange={setIsInvoiceModalOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden border-slate-200 shadow-2xl max-h-[90vh] flex flex-col">
          {/* Dialog Header */}
          <DialogHeader className="p-4 px-6 border-b border-slate-200 bg-slate-50/90 flex-shrink-0 flex flex-row items-center justify-between space-y-0">
            <div>
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Receipt className="h-4 w-4 text-blue-600" />
                GST Tax Invoice Preview (Draft)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Rule 46 Tax Invoice compliant with Indian CGST / SGST Rules.
              </DialogDescription>
            </div>
            <Badge variant="outline" className="font-mono text-xs bg-white">
              DRAFT-PREVIEW
            </Badge>
          </DialogHeader>

          {/* Formal Invoice Printable Sheet Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-slate-800 bg-white">
            {/* Header: Company Details vs Client Bill-To Details */}
            <div className="grid grid-cols-2 gap-6 p-4 rounded-lg border border-slate-200 bg-slate-50/40">
              {/* Seller / Logistics Company Details */}
              <div className="space-y-1">
                <div className="flex items-center space-x-1.5 text-slate-900 font-bold">
                  <Building2 className="h-4 w-4 text-slate-700" />
                  <span>VECTO LOGISTICS INDIA PVT LTD</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-tight">
                  —
                </p>
                <div className="text-[11px] font-mono text-slate-600 pt-1 space-y-0.5">
                  <div>GSTIN: <span className="font-bold text-slate-800">—</span></div>
                  <div>PAN: <span className="font-bold text-slate-800">—</span></div>
                  <div>State Code: —</div>
                </div>
              </div>

              {/* Client Bill-To Details */}
              <div className="space-y-1 border-l border-slate-200 pl-6">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">
                  Billed To (Client Consignee)
                </span>
                <div className="font-bold text-slate-900 text-sm">
                  {invoiceTargetClient ? String(invoiceTargetClient.clientName ?? invoiceTargetClient.client ?? "—") : "—"}
                </div>
                <p className="text-[11px] text-slate-600 leading-tight">
                  {invoiceTargetClient ? String(invoiceTargetClient.clientAddress ?? invoiceTargetClient.address ?? "—") : "—"}
                </p>
                <div className="text-[11px] font-mono text-slate-600 pt-1 space-y-0.5">
                  <div>Client GSTIN: <span className="font-bold text-slate-800">{invoiceTargetClient ? String(invoiceTargetClient.clientGstin ?? invoiceTargetClient.gstin ?? "—") : "—"}</span></div>
                  <div>Payment Terms: <span className="font-bold text-slate-800">{invoiceTargetClient ? String(invoiceTargetClient.paymentTerms ?? "Net 30 Days") : "—"}</span></div>
                  <div>Place of Supply: —</div>
                </div>
              </div>
            </div>

            {/* Itemized Table of Selected Trips */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-xs uppercase tracking-wide text-slate-900">
                  Itemized Freight & Transport Consignments
                </h4>
                <span className="text-[11px] font-mono text-slate-500">
                  SAC Code: 996511 (Goods Transport by Road)
                </span>
              </div>

              <div className="rounded border border-slate-200 overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-100 text-[11px]">
                    <TableRow className="border-b border-slate-200">
                      <TableHead className="py-2 font-bold text-slate-700">Trip / LR No</TableHead>
                      <TableHead className="py-2 font-bold text-slate-700">Route & Consignment</TableHead>
                      <TableHead className="py-2 text-right font-bold text-slate-700">Freight (₹)</TableHead>
                      <TableHead className="py-2 text-right font-bold text-slate-700">Toll (₹)</TableHead>
                      <TableHead className="py-2 text-right font-bold text-slate-700">Demurrage (₹)</TableHead>
                      <TableHead className="py-2 text-right font-bold text-slate-700">Line Total (₹)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs font-mono">
                    {selectedTripsList.map((t) => {
                      const tripId = String(t.id ?? "");
                      const lrNumber = String(t.lrNumber ?? t.tripNumber ?? "—");
                      const origin = String(t.origin ?? "—");
                      const destination = String(t.destination ?? "—");
                      const freight = Number(t.amount ?? t.baseFreight ?? t.freightCharge ?? 0);
                      const toll = Number(t.tollCharge ?? 0);
                      const dem = Number(t.demurrageCharge ?? 0);
                      const lineTotal = freight + toll + dem;

                      return (
                        <TableRow key={tripId} className="border-b border-slate-100">
                          <TableCell className="py-2 font-sans font-bold text-slate-900">
                            {tripId}
                            <span className="text-[10px] text-slate-500 block font-mono">{lrNumber}</span>
                          </TableCell>
                          <TableCell className="py-2 font-sans text-slate-700">
                            {origin} → {destination}
                          </TableCell>
                          <TableCell className="py-2 text-right">
                            {freight.toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className="py-2 text-right text-slate-600">
                            {toll.toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className="py-2 text-right text-slate-600">
                            {dem.toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className="py-2 text-right font-bold text-slate-900">
                            {lineTotal.toLocaleString("en-IN")}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Footer Summary & GST Math */}
            <div className="grid grid-cols-2 gap-6 pt-2">
              {/* Bank Remittance Instructions */}
              <div className="p-3 bg-slate-50 rounded border border-slate-200 text-[11px] space-y-1">
                <span className="font-bold text-slate-800 block uppercase">
                  Remittance Bank Details
                </span>
                <div>Bank Name: <strong className="text-slate-900">—</strong></div>
                <div>Account No: <strong className="font-mono text-slate-900">—</strong></div>
                <div>IFSC Code: <strong className="font-mono text-slate-900">—</strong></div>
                <div>UPI VPA: <strong className="font-mono text-slate-900">—</strong></div>
              </div>

              {/* Subtotal, GST & Grand Total */}
              <div className="space-y-2 border border-slate-200 rounded p-3 bg-slate-50/50">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>Taxable Subtotal Value:</span>
                  <span className="font-mono font-medium text-slate-800">
                    ₹{selectedSubtotal.toLocaleString("en-IN")}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>IGST @ {gstRate}% (Inter-state Freight):</span>
                  <span className="font-mono font-medium text-slate-800">
                    ₹{selectedGst.toLocaleString("en-IN")}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
                  <span>Invoice Grand Total:</span>
                  <span className="font-mono text-base text-blue-700">
                    ₹{selectedGrandTotal.toLocaleString("en-IN")}
                  </span>
                </div>

                <p className="text-[10px] text-slate-600 italic text-right font-sans">
                  Total in words: Indian Rupees {Math.round(selectedGrandTotal).toLocaleString("en-IN")} Only
                </p>
              </div>
            </div>
          </div>

          {/* Dialog Footer Actions */}
          <DialogFooter className="p-4 px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-2 flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsInvoiceModalOpen(false)}
              className="h-8 text-xs border-slate-200"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setNotice({ type: "success", message: "Invoice Draft saved to AR Drafts." });
                setIsInvoiceModalOpen(false);
              }}
              className="h-8 text-xs border-slate-300 text-slate-800"
            >
              Save Draft
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={generating}
              onClick={handleGenerateInvoice}
              className="h-8 text-xs bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 flex items-center gap-1.5 shadow-sm"
            >
              <Send className="h-3.5 w-3.5 text-blue-400" />
              {generating ? "Generating..." : "Publish & Send to Client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
