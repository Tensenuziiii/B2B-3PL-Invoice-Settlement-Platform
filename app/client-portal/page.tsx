"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Inbox,
  CreditCard,
  AlertTriangle,
  Settings,
  Search,
  CheckCircle2,
  FileText,
  Clock,
  ExternalLink,
  ChevronDown,
  Building2,
  ShieldCheck,
  AlertOctagon,
  Download,
  Eye,
  Check,
  X,
  Layers,
  Calendar,
  Lock,
  Flag,
  ArrowRight,
  Truck,
  RotateCcw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

import { apiClient, ApiError } from "@/lib/api/client";
import type { Invoice, Paginated } from "@/lib/api/types";

interface DisputeMessage {
  id: string;
  author: string;
  body: string;
  createdAt: string;
}

interface DisputeThread {
  id: string;
  status: string;
  messages: DisputeMessage[];
}

export default function ClientAccountsPayablePortal() {
  const [activeMenu, setActiveMenu] = useState("Invoice Inbox");
  const [searchQuery, setSearchQuery] = useState("");

  // API State
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Settings State
  const [apContactEmail, setApContactEmail] = useState("ap.payments@metro-wholesale.in");
  const [notificationPreferences, setNotificationPreferences] = useState({
    invoices: true,
    disputes: true,
    payments: true,
  });
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [approving, setApproving] = useState(false);

  // Line-Item Inline Dispute State
  const [activeDisputeTripId, setActiveDisputeTripId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState("Damaged Goods");
  const [disputeAmountInput, setDisputeAmountInput] = useState("3500");
  const [disputeComments, setDisputeComments] = useState("Carton seals breached upon unloading; goods damaged.");
  const [disputing, setDisputing] = useState(false);

  // Dispute Thread State
  const [activeDisputeThread, setActiveDisputeThread] = useState<DisputeThread | null>(null);
  const [newMessageBody, setNewMessageBody] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  // Fetch Invoices on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get<Paginated<Invoice>>("/invoices");
        if (!cancelled) {
          setInvoices(res.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load invoices");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch invoice items when selectedInvoiceId changes
  useEffect(() => {
    if (!selectedInvoiceId) {
      setInvoiceItems([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get<{ data: Array<Record<string, unknown>> }>(`/invoices/${selectedInvoiceId}/items`);
        if (!cancelled) {
          setInvoiceItems(Array.isArray(res.data) ? res.data : []);
        }
      } catch (err) {
        if (!cancelled) {
          setInvoiceItems([]);
          setError(err instanceof ApiError ? err.message : "Failed to load invoice items");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedInvoiceId]);

  // Selected Invoice Object
  const selectedInvoice = useMemo(() => {
    if (!selectedInvoiceId) return null;
    return invoices.find((inv) => String(inv.id ?? inv.invoiceNumber ?? inv.invoiceNo) === selectedInvoiceId) ?? null;
  }, [invoices, selectedInvoiceId]);

  // Computed Financial Metrics
  const outstandingStatuses = useMemo(() => new Set([
    "PENDING_APPROVAL",
    "PARTIALLY_DISPUTED",
    "APPROVED",
    "OVERDUE",
    "DISPUTED",
    "UNDER_REVIEW",
    "AUDIT_CLEARED",
  ]), []);

  const totalOutstanding = useMemo(() => {
    return invoices.reduce((sum, inv) => {
      const status = String(inv.status ?? "").trim().toUpperCase().replace(/\s+/g, "_");
      if (outstandingStatuses.has(status)) {
        const amt = Number(inv.total ?? inv.grossAmount ?? inv.totalAmount ?? 0);
        return sum + amt;
      }
      return sum;
    }, 0);
  }, [invoices, outstandingStatuses]);

  const dueThisWeek = useMemo(() => {
    const now = new Date();
    const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    let hasValidDueDate = false;
    let sum = 0;

    for (const inv of invoices) {
      const rawDate = inv.dueDate ?? inv.due_date;
      if (rawDate && typeof rawDate === "string") {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
          hasValidDueDate = true;
          if (d >= now && d <= next7Days) {
            sum += Number(inv.total ?? inv.grossAmount ?? inv.totalAmount ?? 0);
          }
        }
      }
    }

    return hasValidDueDate ? `₹${sum.toLocaleString("en-IN")}` : "—";
  }, [invoices]);

  // Filtered Invoices
  const filteredInvoices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (!q) return true;
      const invNo = String(inv.invoiceNumber ?? inv.invoiceNo ?? inv.id ?? "");
      const vendor = String(inv.vendorName ?? inv.vendor ?? "");
      const status = String(inv.status ?? "");
      return (
        invNo.toLowerCase().includes(q) ||
        vendor.toLowerCase().includes(q) ||
        status.toLowerCase().includes(q)
      );
    });
  }, [invoices, searchQuery]);

  const paidInvoices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return invoices.filter((inv) => {
      const isPaid = String(inv.status ?? "").toUpperCase() === "PAID";
      if (!isPaid) return false;
      if (!q) return true;
      const invNo = String(inv.invoiceNumber ?? inv.invoiceNo ?? inv.id ?? "");
      const vendor = String(inv.vendorName ?? inv.vendor ?? "");
      return invNo.toLowerCase().includes(q) || vendor.toLowerCase().includes(q);
    });
  }, [invoices, searchQuery]);

  const disputedInvoices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return invoices.filter((inv) => {
      const status = String(inv.status ?? "").toUpperCase();
      const isDisputed = status.includes("DISPUT");
      if (!isDisputed) return false;
      if (!q) return true;
      const invNo = String(inv.invoiceNumber ?? inv.invoiceNo ?? inv.id ?? "");
      const vendor = String(inv.vendorName ?? inv.vendor ?? "");
      return invNo.toLowerCase().includes(q) || vendor.toLowerCase().includes(q);
    });
  }, [invoices, searchQuery]);

  const pendingInvoiceCount = useMemo(() => {
    return invoices.filter((inv) => {
      const s = String(inv.status ?? "").toUpperCase();
      return s.includes("PENDING") || s.includes("DISPUT");
    }).length;
  }, [invoices]);

  // Calculations for Selected Modal
  const totalDeductions = useMemo(() => {
    return invoiceItems.reduce((sum, item) => {
      const isDisputed = Boolean(item.isDisputed || item.disputeId || item.dispute_id);
      return isDisputed ? sum + Number(item.disputeAmount ?? item.amount ?? 0) : sum;
    }, 0);
  }, [invoiceItems]);

  const selectedGrossAmount = useMemo(() => {
    return Number(selectedInvoice?.total ?? selectedInvoice?.grossAmount ?? selectedInvoice?.totalAmount ?? 0);
  }, [selectedInvoice]);

  const netPayableAuthorized = useMemo(() => {
    return Math.max(selectedGrossAmount - totalDeductions, 0);
  }, [selectedGrossAmount, totalDeductions]);

  // Open Deep-Dive Modal
  const handleOpenInvoiceModal = (inv: Invoice, disputeTripId?: string) => {
    const invId = String(inv.id ?? inv.invoiceNumber ?? inv.invoiceNo ?? "");
    setSelectedInvoiceId(invId);
    setActiveDisputeTripId(disputeTripId ?? null);
    setActiveDisputeThread(null);
    setIsModalOpen(true);
  };

  // View POD
  const handleViewPod = async (podId: string) => {
    try {
      const { url } = await apiClient.get<{ url: string }>(`/pods/${podId}/download-url`);
      if (url) {
        window.open(url, "_blank");
      } else {
        setNotice({ type: "error", message: "Proof of Delivery (POD) download link unavailable." });
      }
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof ApiError ? err.message : "Failed to retrieve POD download URL",
      });
    }
  };

  // Fetch Dispute Thread
  const fetchDisputeThread = async (disputeId: string) => {
    try {
      const thread = await apiClient.get<DisputeThread>(`/disputes/${disputeId}`);
      setActiveDisputeThread(thread);
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof ApiError ? err.message : "Failed to load dispute thread",
      });
    }
  };

  // Send message in Dispute Thread
  const handleSendMessage = async (disputeId: string) => {
    if (!newMessageBody.trim()) return;
    setSendingMessage(true);
    try {
      await apiClient.post(`/disputes/${disputeId}/messages`, {
        body: newMessageBody.trim(),
      });
      setNewMessageBody("");
      const thread = await apiClient.get<DisputeThread>(`/disputes/${disputeId}`);
      setActiveDisputeThread(thread);
      setNotice({ type: "success", message: "Message sent to dispute thread." });
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof ApiError ? err.message : "Failed to post message to dispute",
      });
    } finally {
      setSendingMessage(false);
    }
  };

  // Toggle Inline Dispute on a specific trip
  const handleToggleDisputeRow = (tripId: string, item?: Record<string, unknown>) => {
    if (activeDisputeTripId === tripId) {
      setActiveDisputeTripId(null);
      setActiveDisputeThread(null);
    } else {
      setActiveDisputeTripId(tripId);
      const disputeId = String(item?.disputeId ?? item?.dispute_id ?? "");
      if (disputeId) {
        fetchDisputeThread(disputeId);
      } else {
        setActiveDisputeThread(null);
        setDisputeReason(String(item?.disputeReason ?? "Damaged Goods"));
        setDisputeAmountInput(String(item?.disputeAmount ?? "3500"));
        setDisputeComments(String(item?.disputeComments ?? ""));
      }
    }
  };

  // Raise Dispute (per line item)
  const handleSaveDispute = async (invoiceItemId: string) => {
    if (!selectedInvoiceId) return;
    setDisputing(true);
    try {
      await apiClient.post<{ disputeId: string; success: boolean }>(`/invoices/${selectedInvoiceId}/dispute`, {
        invoiceItemId,
        reasonCode: disputeReason,
        comment: disputeComments,
        amount: Number(disputeAmountInput) || 0,
      });

      setNotice({ type: "success", message: "Dispute submitted." });
      setActiveDisputeTripId(null);

      // refetch items and invoices
      const [itemsRes, invRes] = await Promise.all([
        apiClient.get<{ data: Array<Record<string, unknown>> }>(`/invoices/${selectedInvoiceId}/items`),
        apiClient.get<Paginated<Invoice>>("/invoices"),
      ]);
      setInvoiceItems(Array.isArray(itemsRes.data) ? itemsRes.data : []);
      setInvoices(invRes.data);
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof ApiError ? err.message : "Failed to submit dispute",
      });
    } finally {
      setDisputing(false);
    }
  };

  // Approve Invoice
  const handleApproveInvoice = async () => {
    if (!selectedInvoiceId) return;
    setApproving(true);
    try {
      await apiClient.post(`/invoices/${selectedInvoiceId}/approve`);
      setNotice({ type: "success", message: "Invoice approved." });
      setIsModalOpen(false);

      // refetch invoices list
      const res = await apiClient.get<Paginated<Invoice>>("/invoices");
      setInvoices(res.data);
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof ApiError ? err.message : "Failed to approve invoice",
      });
    } finally {
      setApproving(false);
    }
  };

  const handleSaveVendorSettings = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSettingsSaved(true);
  };

  // Status renderer (Rule 10)
  const renderStatusBadge = (inv: Invoice) => {
    const rawStatus = String(inv.status ?? "PENDING_APPROVAL");
    const invId = String(inv.id ?? inv.invoiceNumber ?? inv.invoiceNo ?? "");
    let displayStatus = rawStatus;

    if (rawStatus === "DISPUTED") {
      if (selectedInvoiceId === invId && invoiceItems.length > 0 && invoiceItems.some((item) => item.isDisputed || item.disputeId)) {
        displayStatus = "Partially Disputed";
      } else {
        displayStatus = "Disputed";
      }
    } else if (rawStatus === "PENDING_APPROVAL") {
      displayStatus = "Pending Approval";
    } else if (rawStatus === "PARTIALLY_DISPUTED") {
      displayStatus = "Partially Disputed";
    } else if (rawStatus === "APPROVED") {
      displayStatus = "Approved";
    } else if (rawStatus === "PAID") {
      displayStatus = "Paid";
    }

    const badgeClass =
      displayStatus === "Approved"
        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
        : displayStatus === "Partially Disputed" || displayStatus === "Disputed"
        ? "bg-amber-50 text-amber-800 border-amber-300"
        : displayStatus === "Paid"
        ? "bg-blue-50 text-blue-700 border-blue-300"
        : displayStatus === "Overdue"
        ? "bg-red-50 text-red-700 border-red-300"
        : "bg-slate-100 text-slate-800 border-slate-300";

    return (
      <Badge variant="outline" className={`text-[11px] font-semibold px-2 py-0.5 rounded ${badgeClass}`}>
        {displayStatus}
      </Badge>
    );
  };

  return (
    <div className="flex h-screen w-full bg-slate-100 text-slate-800 font-sans antialiased overflow-hidden">
      {/* 1. LEFT SIDEBAR */}
      <aside className="w-64 flex-shrink-0 flex flex-col border-r border-slate-200 bg-white shadow-xs">
        {/* Client Brand Logo Header */}
        <div className="h-16 border-b border-slate-200 px-5 flex items-center justify-between bg-white">
          <div className="flex items-center space-x-2.5">
            <div className="h-8 w-8 rounded-lg bg-yellow-400 text-blue-900 flex items-center justify-center font-black text-xs shadow-xs border border-yellow-500">
              M
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-tight text-slate-900 block leading-tight">
                METRO CASH & CARRY
              </span>
              <span className="text-[10px] uppercase font-mono tracking-wider text-blue-700 font-bold block">
                CLIENT AP PORTAL
              </span>
            </div>
          </div>
        </div>

        {/* Client Identity & Account Badge */}
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-100" />
              <span className="text-xs font-semibold text-slate-800">
                Metro Wholesale India
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200 font-bold">
              AP-IND-01
            </span>
          </div>
          <p className="text-[11px] text-slate-600 mt-1 truncate">
            Finance & Vendor Settlements Desk
          </p>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {[
            { name: "Invoice Inbox", icon: Inbox, count: `${pendingInvoiceCount} Pending` },
            { name: "Payment History", icon: CreditCard, count: `${paidInvoices.length} Settled` },
            {
              name: "Active Disputes",
              icon: AlertTriangle,
              count: disputedInvoices.length ? `${disputedInvoices.length} Flagged` : null,
            },
            { name: "Vendor Settings", icon: Settings, count: null },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeMenu === item.name;
            return (
              <button
                key={item.name}
                type="button"
                onClick={() => {
                  setActiveMenu(item.name);
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
                {item.count && (
                  <span
                    className={`ml-auto text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold ${
                      isActive
                        ? "bg-slate-800 text-slate-200"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Switcher to Internal Logistics Tools */}
        <div className="p-3 border-t border-slate-200 bg-slate-50">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 px-1 mb-1.5 block">
            Internal Platform Roles
          </span>
          <div className="space-y-1">
            <Link
              href="/dispatch"
              className="flex items-center justify-between text-xs text-slate-600 hover:text-slate-900 p-1.5 rounded hover:bg-white transition-colors"
            >
              <span className="flex items-center gap-1.5 font-medium">
                <Truck className="h-3.5 w-3.5 text-slate-500" />
                Dispatch Ops
              </span>
              <ExternalLink className="h-3 w-3 text-slate-400" />
            </Link>
            <Link
              href="/audit"
              className="flex items-center justify-between text-xs text-slate-600 hover:text-slate-900 p-1.5 rounded hover:bg-white transition-colors"
            >
              <span className="flex items-center gap-1.5 font-medium">
                <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
                Internal Audit
              </span>
              <ExternalLink className="h-3 w-3 text-slate-400" />
            </Link>
            <Link
              href="/accounts"
              className="flex items-center justify-between text-xs text-slate-600 hover:text-slate-900 p-1.5 rounded hover:bg-white transition-colors"
            >
              <span className="flex items-center gap-1.5 font-medium">
                <FileText className="h-3.5 w-3.5 text-emerald-600" />
                Accounts & Billing
              </span>
              <ExternalLink className="h-3 w-3 text-slate-400" />
            </Link>
          </div>
        </div>
      </aside>

      {/* RIGHT MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        {/* 2. TOP HEADER */}
        <header className="h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between gap-4 flex-shrink-0">
          <div className="flex items-center space-x-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 leading-tight">
                Welcome, Metro Finance Team
              </h2>
              <span className="text-[11px] text-slate-500">
                Logistics Vendor Clearing Account: <strong className="text-slate-700">Vecto Logistics India</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Search Input */}
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                type="text"
                placeholder={
                  activeMenu === "Payment History"
                    ? "Search paid invoices..."
                    : activeMenu === "Active Disputes"
                    ? "Search disputes..."
                    : "Search Invoices, Status..."
                }
                disabled={activeMenu === "Vendor Settings"}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs bg-slate-50 border-slate-200"
              />
            </div>

            {/* Metric Pill */}
            <Badge
              variant="outline"
              className="bg-slate-50 border-slate-200 text-slate-700 font-mono text-xs px-3 py-1 flex items-center gap-1.5"
            >
              <span className="text-slate-500 font-sans">Total Outstanding:</span>
              <span className="font-bold text-slate-900">₹{totalOutstanding.toLocaleString("en-IN")}</span>
              <span className="text-slate-300">|</span>
              <span className="text-amber-600 font-sans">Due This Week:</span>
              <span className="font-bold text-amber-700">{dueThisWeek}</span>
            </Badge>
          </div>
        </header>

        {/* 3. MAIN CONTENT */}
        <main className="flex-1 overflow-y-auto p-6 space-y-4">
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
                  <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
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
                <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
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

          {/* INVOICE INBOX VIEW */}
          {activeMenu === "Invoice Inbox" && (
            <Card className="shadow-none border-slate-200 bg-white">
              <CardHeader className="p-4 border-b border-slate-200 flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Freight Invoices Pending Approval
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 mt-0.5">
                    Review billed trip consignments, verify digital Proof of Delivery (POD), and authorize payments.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="font-mono text-xs">
                  Billing Cycle: Net 30
                </Badge>
              </CardHeader>

              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-50/75">
                    <TableRow className="border-b border-slate-200">
                      <TableHead className="text-xs font-semibold text-slate-600 py-3 w-[160px]">
                        Invoice Number
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600 py-3 w-[130px]">
                        Invoice Date
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600 py-3 w-[150px]">
                        Due Date
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600 py-3 text-right w-[150px]">
                        Total Amount (₹)
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600 py-3 text-center w-[160px]">
                        Status
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600 py-3 text-right w-[140px]">
                        Action
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-12 text-center text-xs text-slate-500">
                          <div className="flex flex-col items-center justify-center space-y-2">
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                            <span>Loading invoices...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredInvoices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-12 text-center text-xs text-slate-500">
                          No invoices found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredInvoices.map((inv) => {
                        const invNo = String(inv.invoiceNumber ?? inv.invoiceNo ?? inv.id ?? "—");
                        const vendor = String(inv.vendorName ?? inv.vendor ?? "—");
                        const issueDate = String(inv.issueDate ?? inv.createdAt ?? inv.date ?? "—");
                        const dueDate = String(inv.dueDate ?? "—");
                        const total = Number(inv.total ?? inv.grossAmount ?? inv.totalAmount ?? 0);

                        return (
                          <TableRow key={invNo} className="border-b border-slate-200 text-xs hover:bg-slate-50/70 transition-colors">
                            {/* Invoice No */}
                            <TableCell className="py-3 font-mono font-bold text-slate-900">
                              {invNo}
                              <span className="text-[10px] text-slate-500 block font-sans">
                                {vendor}
                              </span>
                            </TableCell>

                            {/* Date */}
                            <TableCell className="py-3 font-mono text-slate-700">
                              {issueDate}
                            </TableCell>

                            {/* Due Date */}
                            <TableCell className="py-3 font-mono text-slate-700">
                              {dueDate}
                            </TableCell>

                            {/* Total Amount */}
                            <TableCell className="py-3 text-right font-mono font-bold text-slate-900 text-sm">
                              ₹{total.toLocaleString("en-IN")}
                            </TableCell>

                            {/* Status Badge */}
                            <TableCell className="py-3 text-center">
                              {renderStatusBadge(inv)}
                            </TableCell>

                            {/* Action Button */}
                            <TableCell className="py-3 text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenInvoiceModal(inv)}
                                className="h-7 text-xs border-slate-300 text-slate-900 bg-white hover:bg-slate-100 font-semibold"
                              >
                                View & Approve
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
          )}

          {/* PAYMENT HISTORY VIEW */}
          {activeMenu === "Payment History" && (
            <Card className="shadow-none border-slate-200 bg-white">
              <CardHeader className="p-4 border-b border-slate-200 flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900">Payment History</CardTitle>
                  <CardDescription className="text-xs text-slate-500 mt-0.5">
                    Invoices marked as paid for Metro Wholesale India.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="font-mono text-xs">
                  {paidInvoices.length} Settled
                </Badge>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-50/75">
                    <TableRow className="border-b border-slate-200">
                      <TableHead className="py-3 text-xs font-semibold text-slate-600">Invoice</TableHead>
                      <TableHead className="py-3 text-xs font-semibold text-slate-600">Vendor</TableHead>
                      <TableHead className="py-3 text-xs font-semibold text-slate-600">Invoice Date</TableHead>
                      <TableHead className="py-3 text-right text-xs font-semibold text-slate-600">Amount (₹)</TableHead>
                      <TableHead className="py-3 text-center text-xs font-semibold text-slate-600">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paidInvoices.length ? (
                      paidInvoices.map((invoice) => {
                        const invNo = String(invoice.invoiceNumber ?? invoice.invoiceNo ?? invoice.id ?? "—");
                        const vendor = String(invoice.vendorName ?? invoice.vendor ?? "—");
                        const issueDate = String(invoice.issueDate ?? invoice.createdAt ?? invoice.date ?? "—");
                        const total = Number(invoice.total ?? invoice.grossAmount ?? invoice.totalAmount ?? 0);

                        return (
                          <TableRow key={invNo} className="border-b border-slate-200 text-xs">
                            <TableCell className="py-3 font-mono font-bold text-slate-900">{invNo}</TableCell>
                            <TableCell className="py-3 text-slate-700">{vendor}</TableCell>
                            <TableCell className="py-3 font-mono text-slate-700">{issueDate}</TableCell>
                            <TableCell className="py-3 text-right font-mono font-bold text-slate-900">
                              ₹{total.toLocaleString("en-IN")}
                            </TableCell>
                            <TableCell className="py-3 text-center">
                              <Badge className="border border-emerald-300 bg-emerald-50 text-emerald-700">Paid</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center text-sm text-slate-500">
                          No paid invoices match your search.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* ACTIVE DISPUTES VIEW */}
          {activeMenu === "Active Disputes" && (
            <Card className="shadow-none border-slate-200 bg-white">
              <CardHeader className="p-4 border-b border-slate-200 flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900">Active Disputes</CardTitle>
                  <CardDescription className="text-xs text-slate-500 mt-0.5">
                    Review disputed invoices and flagged line items.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="font-mono text-xs">
                  {disputedInvoices.length} Flagged
                </Badge>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-50/75">
                    <TableRow className="border-b border-slate-200">
                      <TableHead className="py-3 text-xs font-semibold text-slate-600">Invoice</TableHead>
                      <TableHead className="py-3 text-xs font-semibold text-slate-600">Vendor</TableHead>
                      <TableHead className="py-3 text-xs font-semibold text-slate-600">Status</TableHead>
                      <TableHead className="py-3 text-right text-xs font-semibold text-slate-600">Total (₹)</TableHead>
                      <TableHead className="py-3 text-right text-xs font-semibold text-slate-600">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {disputedInvoices.length ? (
                      disputedInvoices.map((inv) => {
                        const invNo = String(inv.invoiceNumber ?? inv.invoiceNo ?? inv.id ?? "—");
                        const vendor = String(inv.vendorName ?? inv.vendor ?? "—");
                        const status = String(inv.status ?? "DISPUTED");
                        const total = Number(inv.total ?? inv.grossAmount ?? inv.totalAmount ?? 0);

                        return (
                          <TableRow key={invNo} className="border-b border-slate-200 text-xs">
                            <TableCell className="py-3 font-mono font-bold text-slate-900">{invNo}</TableCell>
                            <TableCell className="py-3 text-slate-700">{vendor}</TableCell>
                            <TableCell className="py-3">{renderStatusBadge(inv)}</TableCell>
                            <TableCell className="py-3 text-right font-mono font-bold text-red-600">
                              ₹{total.toLocaleString("en-IN")}
                            </TableCell>
                            <TableCell className="py-3 text-right">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenInvoiceModal(inv)}
                                className="h-7 text-xs border-slate-300"
                              >
                                Review
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center text-sm text-slate-500">
                          {searchQuery ? "No disputes match your search." : "There are no active disputes."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* VENDOR SETTINGS VIEW */}
          {activeMenu === "Vendor Settings" && (
            <Card className="shadow-none border-slate-200 bg-white">
              <CardHeader className="p-4 border-b border-slate-200">
                <CardTitle className="text-sm font-bold text-slate-900">Vendor Settings</CardTitle>
                <CardDescription className="text-xs text-slate-500 mt-0.5">
                  Review logistics vendor details and manage AP notification preferences.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 p-5">
                <div className="grid gap-4 border-b border-slate-200 pb-5 sm:grid-cols-3">
                  <div>
                    <span className="block text-[10px] font-semibold uppercase text-slate-500">Vendor</span>
                    <span className="mt-1 block text-sm font-semibold text-slate-900">
                      {String(selectedInvoice?.vendorName ?? selectedInvoice?.vendor ?? "Vecto Logistics India Pvt Ltd")}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-semibold uppercase text-slate-500">GSTIN</span>
                    <span className="mt-1 block font-mono text-sm text-slate-800">
                      {String(selectedInvoice?.vendorGstin ?? selectedInvoice?.gstin ?? "—")}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-semibold uppercase text-slate-500">Payment Terms</span>
                    <span className="mt-1 block text-sm font-semibold text-slate-900">Net 30</span>
                  </div>
                </div>

                <form onSubmit={handleSaveVendorSettings} className="max-w-2xl space-y-5">
                  <div className="space-y-1.5">
                    <label htmlFor="ap-contact-email" className="text-xs font-semibold text-slate-700">AP notification email</label>
                    <Input
                      id="ap-contact-email"
                      type="email"
                      required
                      value={apContactEmail}
                      onChange={(event) => {
                        setApContactEmail(event.target.value);
                        setSettingsSaved(false);
                      }}
                      className="max-w-md text-sm"
                    />
                  </div>

                  <fieldset className="space-y-3">
                    <legend className="text-xs font-semibold text-slate-700">Email notifications</legend>
                    {([
                      ["invoices", "New invoices and approval reminders"],
                      ["disputes", "Dispute updates and resolutions"],
                      ["payments", "Payment confirmations"],
                    ] as const).map(([key, label]) => (
                      <label key={key} className="flex max-w-md items-center justify-between border-b border-slate-200 py-2 text-sm text-slate-700">
                        <span>{label}</span>
                        <input
                          type="checkbox"
                          checked={notificationPreferences[key]}
                          onChange={(event) => {
                            setNotificationPreferences((current) => ({
                              ...current,
                              [key]: event.target.checked,
                            }));
                            setSettingsSaved(false);
                          }}
                          className="h-4 w-4 accent-blue-500"
                        />
                      </label>
                    ))}
                  </fieldset>

                  <div className="flex items-center gap-3">
                    <Button type="submit" className="h-8 text-xs font-semibold">Save preferences</Button>
                    {settingsSaved && <span role="status" className="text-xs font-medium text-emerald-600">Preferences saved for this session.</span>}
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </main>
      </div>

      {/* ========================================================================= */}
      {/* WIDGET: INVOICE DEEP-DIVE & INLINE DISPUTE MODAL */}
      {/* ========================================================================= */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden border-slate-200 shadow-2xl max-h-[92vh] flex flex-col">
          {/* Header */}
          <DialogHeader className="p-5 border-b border-slate-200 bg-slate-50 flex-shrink-0 flex flex-row items-center justify-between space-y-0">
            <div>
              <div className="flex items-center space-x-2">
                <DialogTitle className="text-base font-bold text-slate-900">
                  Invoice {String(selectedInvoice?.invoiceNumber ?? selectedInvoice?.invoiceNo ?? selectedInvoice?.id ?? "—")} Summary
                </DialogTitle>
                {selectedInvoice && renderStatusBadge(selectedInvoice)}
              </div>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Vendor: {String(selectedInvoice?.vendorName ?? selectedInvoice?.vendor ?? "—")} • GSTIN: {String(selectedInvoice?.vendorGstin ?? selectedInvoice?.gstin ?? "—")}
              </DialogDescription>
            </div>

            <div className="text-right">
              <span className="text-[11px] text-slate-500 block">Total Invoice Value:</span>
              <span className="text-lg font-bold font-mono text-slate-900">
                ₹{selectedGrossAmount.toLocaleString("en-IN")}
              </span>
            </div>
          </DialogHeader>

          {/* Modal Body: Line Items & Inline Dispute */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs bg-white">
            {/* Context Alert if Disputed */}
            {totalDeductions > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <AlertOctagon className="h-4 w-4 text-amber-600 flex-shrink-0" />
                  <span>
                    <strong>Dispute Applied:</strong> ₹{totalDeductions.toLocaleString("en-IN")} has been flagged for dispute adjustment. Net authorized payment adjusted.
                  </span>
                </div>
                <Badge className="bg-amber-200 text-amber-900 font-mono text-[10px]">
                  Dispute Pending
                </Badge>
              </div>
            )}

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Trip Line Items & Consignment Breakdown
              </h4>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow className="border-b border-slate-200">
                      <TableHead className="py-2 text-slate-700 font-semibold w-[130px]">Trip & LR</TableHead>
                      <TableHead className="py-2 text-slate-700 font-semibold">Route & Cargo Details</TableHead>
                      <TableHead className="py-2 text-slate-700 font-semibold w-[110px]">Delivery Date</TableHead>
                      <TableHead className="py-2 text-right text-slate-700 font-semibold w-[120px]">Line Total</TableHead>
                      <TableHead className="py-2 text-center text-slate-700 font-semibold w-[110px]">Proof (POD)</TableHead>
                      <TableHead className="py-2 text-center text-slate-700 font-semibold w-[90px]">Dispute</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoiceItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-xs text-slate-500">
                          No line items found for this invoice.
                        </TableCell>
                      </TableRow>
                    ) : (
                      invoiceItems.map((trip, idx) => {
                        const tripId = String(trip.id ?? trip.tripId ?? trip.trip_id ?? `item-${idx}`);
                        const isDisputeRowOpen = activeDisputeTripId === tripId;
                        const lrNumber = String(trip.lrNumber ?? trip.lr_number ?? trip.lrNo ?? trip.tripNumber ?? "—");
                        const route = String(trip.route ?? (trip.origin && trip.destination ? `${trip.origin} → ${trip.destination}` : "—"));
                        const cargo = String(trip.cargo ?? trip.cargoType ?? "—");
                        const deliveryDate = String(trip.deliveryDate ?? trip.delivery_date ?? trip.date ?? "—");
                        const totalAmount = Number(trip.totalAmount ?? trip.total ?? trip.amount ?? trip.freightAmount ?? 0);
                        const isDisputed = Boolean(trip.isDisputed || trip.disputeId || trip.dispute_id);
                        const disputeAmount = Number(trip.disputeAmount ?? trip.dispute_amount ?? 0);
                        const disputeId = String(trip.disputeId ?? trip.dispute_id ?? "");
                        const podId = String(trip.podId ?? trip.pod_id ?? tripId);

                        return (
                          <React.Fragment key={tripId}>
                            <TableRow
                              className={`border-b border-slate-200 text-xs transition-colors ${
                                isDisputed ? "bg-amber-50/40" : "hover:bg-slate-50/50"
                              }`}
                            >
                              {/* Trip & LR */}
                              <TableCell className="py-2.5 font-mono">
                                <span className="font-bold text-slate-900 block">{tripId}</span>
                                <span className="text-[10px] text-slate-500 font-sans">{lrNumber}</span>
                              </TableCell>

                              {/* Route & Cargo */}
                              <TableCell className="py-2.5">
                                <div className="font-medium text-slate-800">{route}</div>
                                <div className="text-[10px] text-slate-500">{cargo}</div>
                              </TableCell>

                              {/* Date */}
                              <TableCell className="py-2.5 font-mono text-slate-700">
                                {deliveryDate}
                              </TableCell>

                              {/* Line Total */}
                              <TableCell className="py-2.5 text-right font-mono font-bold text-slate-900">
                                ₹{totalAmount.toLocaleString("en-IN")}
                                {isDisputed && disputeAmount > 0 && (
                                  <span className="block text-[10px] text-red-600 font-normal">
                                    - ₹{disputeAmount.toLocaleString("en-IN")} Disputed
                                  </span>
                                )}
                              </TableCell>

                              {/* View POD */}
                              <TableCell className="py-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleViewPod(podId)}
                                  className="text-blue-600 hover:text-blue-800 underline font-semibold text-xs inline-flex items-center gap-1"
                                >
                                  <Eye className="h-3 w-3" /> View POD
                                </button>
                              </TableCell>

                              {/* Dispute Flag */}
                              <TableCell className="py-2.5 text-center">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleToggleDisputeRow(tripId, trip)}
                                  className={`h-7 w-7 p-0 rounded-md border ${
                                    isDisputed
                                      ? "bg-red-50 text-red-600 border-red-300 hover:bg-red-100"
                                      : "border-slate-300 text-slate-500 hover:text-red-600 hover:border-red-300"
                                  }`}
                                  title={isDisputed ? "View Dispute" : "Flag Dispute"}
                                >
                                  <Flag className="h-3.5 w-3.5 fill-current" />
                                </Button>
                              </TableCell>
                            </TableRow>

                            {/* Inline Dispute Drawer */}
                            {isDisputeRowOpen && (
                              <TableRow className="bg-amber-50/60 border-b border-slate-200">
                                <TableCell colSpan={6} className="p-4">
                                  <div className="p-4 rounded-lg border border-amber-300 bg-white space-y-3 shadow-xs">
                                    <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                                      <span className="font-bold text-xs text-amber-950 flex items-center gap-1.5">
                                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                                        {isDisputed ? "Dispute Details" : "Flag Dispute"} on {tripId} ({route})
                                      </span>
                                      <span className="text-[11px] text-slate-500">
                                        Line Total: ₹{totalAmount.toLocaleString("en-IN")}
                                      </span>
                                    </div>

                                    {/* Dispute Thread if already disputed and disputeId exists */}
                                    {disputeId && activeDisputeThread && (
                                      <div className="space-y-2 border-b border-amber-100 pb-3">
                                        <h5 className="font-bold text-[11px] text-slate-700">Dispute Discussion Thread</h5>
                                        <div className="max-h-36 overflow-y-auto space-y-1.5 bg-slate-50 p-2.5 rounded border border-slate-200 text-xs">
                                          {activeDisputeThread.messages && activeDisputeThread.messages.length > 0 ? (
                                            activeDisputeThread.messages.map((m) => (
                                              <div key={m.id} className="border-b border-slate-100 pb-1 last:border-none">
                                                <div className="flex items-center justify-between text-[10px] text-slate-500">
                                                  <span className="font-bold text-slate-700">{m.author}</span>
                                                  <span>{m.createdAt}</span>
                                                </div>
                                                <p className="text-slate-800 mt-0.5">{m.body}</p>
                                              </div>
                                            ))
                                          ) : (
                                            <p className="text-slate-400 italic">No messages in this dispute thread yet.</p>
                                          )}
                                        </div>

                                        <div className="flex gap-2 pt-1">
                                          <Input
                                            type="text"
                                            placeholder="Type a response..."
                                            value={newMessageBody}
                                            onChange={(e) => setNewMessageBody(e.target.value)}
                                            className="h-8 text-xs"
                                          />
                                          <Button
                                            type="button"
                                            size="sm"
                                            disabled={sendingMessage || !newMessageBody.trim()}
                                            onClick={() => handleSendMessage(disputeId)}
                                            className="h-8 text-xs bg-slate-900 text-white"
                                          >
                                            {sendingMessage ? "Sending..." : "Reply"}
                                          </Button>
                                        </div>
                                      </div>
                                    )}

                                    {/* Dispute Form (if not yet disputed) */}
                                    {!isDisputed && (
                                      <>
                                        <div className="grid grid-cols-2 gap-3">
                                          <div>
                                            <label className="text-[11px] font-bold text-slate-700 block mb-1">
                                              Dispute Reason *
                                            </label>
                                            <select
                                              value={disputeReason}
                                              onChange={(e) => setDisputeReason(e.target.value)}
                                              className="w-full h-8 text-xs rounded-md border border-slate-300 bg-white px-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-950"
                                            >
                                              <option value="Damaged Goods">Damaged Goods in Transit</option>
                                              <option value="Late Delivery Penalty">Late Delivery SLA Penalty</option>
                                              <option value="Missing Quantity / Shortage">Missing Quantity / Seal Breach</option>
                                              <option value="Incorrect Demurrage / Waiting">Incorrect Demurrage / Waiting Charge</option>
                                              <option value="POD Signature Missing">POD Signature Missing / Invalid</option>
                                            </select>
                                          </div>

                                          <div>
                                            <label className="text-[11px] font-bold text-slate-700 block mb-1">
                                              Deduction Amount (₹) *
                                            </label>
                                            <Input
                                              type="number"
                                              value={disputeAmountInput}
                                              onChange={(e) => setDisputeAmountInput(e.target.value)}
                                              className="h-8 text-xs font-mono"
                                              placeholder="0"
                                            />
                                          </div>
                                        </div>

                                        <div>
                                          <label className="text-[11px] font-bold text-slate-700 block mb-1">
                                            Dispute Justification & Comments *
                                          </label>
                                          <Textarea
                                            rows={2}
                                            value={disputeComments}
                                            onChange={(e) => setDisputeComments(e.target.value)}
                                            className="text-xs border-slate-300"
                                            placeholder="Explain discrepancy details for logistics vendor review..."
                                          />
                                        </div>

                                        <div className="flex items-center justify-end space-x-2 pt-1">
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setActiveDisputeTripId(null)}
                                            className="h-7 text-xs border-slate-300"
                                          >
                                            Cancel
                                          </Button>
                                          <Button
                                            type="button"
                                            size="sm"
                                            disabled={disputing}
                                            onClick={() => handleSaveDispute(tripId)}
                                            className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold"
                                          >
                                            {disputing ? "Submitting..." : "Save Line Dispute"}
                                          </Button>
                                        </div>
                                      </>
                                    )}

                                    {isDisputed && !disputeId && (
                                      <div className="flex items-center justify-between pt-1">
                                        <span className="text-xs text-amber-800">
                                          Dispute logged on this line: {String(trip.disputeReason ?? "Disputed")}
                                        </span>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() => setActiveDisputeTripId(null)}
                                          className="h-7 text-xs border-slate-300"
                                        >
                                          Close
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Reconciliation Balance Strip */}
            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between font-mono text-xs">
              <div>
                <span className="text-slate-500 font-sans block text-[11px]">Gross Invoice Amount</span>
                <span className="font-bold text-slate-800">
                  ₹{selectedGrossAmount.toLocaleString("en-IN")}
                </span>
              </div>

              <div className="text-center">
                <span className="text-slate-500 font-sans block text-[11px]">Disputed Deductions</span>
                <span className="font-bold text-red-600">
                  - ₹{totalDeductions.toLocaleString("en-IN")}
                </span>
              </div>

              <div className="text-right">
                <span className="text-slate-500 font-sans block text-[11px]">Authorized Net Payable</span>
                <span className="text-base font-bold text-emerald-700">
                  ₹{netPayableAuthorized.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <DialogFooter className="p-4 px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center space-x-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled
                title="PDF generation coming soon"
                className="h-8 text-xs border-slate-300 text-slate-700 opacity-60 cursor-not-allowed"
              >
                <Download className="h-3.5 w-3.5 mr-1" />
                Download PDF
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                className="h-8 text-xs border-slate-300"
              >
                Close
              </Button>
            </div>

            <Button
              type="button"
              size="sm"
              disabled={approving}
              onClick={handleApproveInvoice}
              className="h-9 px-4 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md flex items-center gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" />
              {approving
                ? "Approving..."
                : totalDeductions > 0
                ? `Approve with Deductions (₹${netPayableAuthorized.toLocaleString("en-IN")})`
                : "Approve Invoice for Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
