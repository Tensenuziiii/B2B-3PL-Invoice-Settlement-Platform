"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  LogOut,
  History,
  PhoneCall,
  ShieldCheck,
  Check,
  AlertTriangle,
  Eye,
  ChevronRight,
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
import { Textarea } from "@/components/ui/textarea";

import { apiClient, ApiError } from "@/lib/api/client";
import type { Trip, Invoice, Paginated, Pod, InvoiceStage, InvoiceFollowUp } from "@/lib/api/types";
import { getDisplayName, formatRupees, formatNumber, formatDate, paiseToRupees, logoutUser } from "@/lib/api/utils";

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
  const router = useRouter();
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

  // Invoice Review, Multi-Stage Approval & CRM State (R1-TASK-6.1 & R1-TASK-6.2)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isInvoiceDetailOpen, setIsInvoiceDetailOpen] = useState(false);
  const [invoiceStages, setInvoiceStages] = useState<InvoiceStage[]>([]);
  const [invoiceFollowUps, setInvoiceFollowUps] = useState<InvoiceFollowUp[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [stageActionLoading, setStageActionLoading] = useState(false);

  // Stage approval comment state
  const [stageComments, setStageComments] = useState("");
  // Stage hold modal state
  const [holdingStageId, setHoldingStageId] = useState<string | null>(null);
  const [stageHoldReason, setStageHoldReason] = useState("DISPUTED_LINE");
  const [stageHoldRemarks, setStageHoldRemarks] = useState("");
  // Stage release hold state
  const [releasingStageId, setReleasingStageId] = useState<string | null>(null);
  const [stageReleaseRemarks, setStageReleaseRemarks] = useState("");

  // CRM Follow-Up form state
  const [crmContactedPerson, setCrmContactedPerson] = useState("");
  const [crmContactEmail, setCrmContactEmail] = useState("");
  const [crmContactPhone, setCrmContactPhone] = useState("");
  const [crmChannel, setCrmChannel] = useState("PHONE");
  const [crmOutcome, setCrmOutcome] = useState("PROMISE_TO_PAY");
  const [crmNotes, setCrmNotes] = useState("");
  const [crmNextDate, setCrmNextDate] = useState("");
  const [crmLoading, setCrmLoading] = useState(false);

  // Record Payment form state
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("NEFT");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);

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
        setCreditNoteInvoiceNo(String(firstOpen.invoiceNumber ?? firstOpen.id ?? ""));
      }
    }
  }, [invoices, creditNoteInvoiceNo]);

  // Dynamic GST rate: read from the most recent invoice's gst_rate if available, else 18 as fallback
  const gstRate = useMemo(() => {
    if (invoices.length > 0) {
      const raw = invoices[0].gstRate;
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
      const client = String((t as any).clientName ?? t.client?.name ?? "");
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
      const invNo = String(invoice.invoiceNumber ?? invoice.id ?? "");
      const client = String((invoice as any).clientName ?? invoice.client?.name ?? "");
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
      const freight = Number((trip as any).amount ?? (trip as any).baseFreight ?? (trip as any).freightCharge ?? 0);
      const toll = Number((trip as any).tollCharge ?? 0);
      const dem = Number((trip as any).demurrageCharge ?? 0);
      return total + freight + toll + dem;
    }, 0);
  }, [unbilledTrips]);

  const openArInvoices = useMemo(() => {
    return invoices.filter((invoice) => String(invoice.status ?? "").toUpperCase() !== "PAID");
  }, [invoices]);

  const openArTotal = useMemo(() => {
    return openArInvoices.reduce((total, invoice) => {
      return total + Number(invoice.total ?? 0);
    }, 0);
  }, [openArInvoices]);

  const overdueArInvoices = useMemo(() => {
    return invoices.filter((invoice) => String(invoice.status ?? "").toUpperCase() === "OVERDUE");
  }, [invoices]);

  const overdueArTotal = useMemo(() => {
    return overdueArInvoices.reduce((total, invoice) => {
      return total + Number(invoice.total ?? 0);
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
      const freight = Number((trip as any).amount ?? (trip as any).baseFreight ?? (trip as any).freightCharge ?? 0);
      const toll = Number((trip as any).tollCharge ?? 0);
      const dem = Number((trip as any).demurrageCharge ?? 0);
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
        firstTrip?.client?.id ??
        "CLT-DEFAULT"
      );

      const todayStr = new Date().toISOString().split("T")[0];
      const dates = selectedTripsList
        .map((t) => String(t.deliveredAt ?? t.createdAt ?? ""))
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
        message: `Invoice ${res.invoiceNumber} successfully generated! Total: ${formatRupees(res.total)}.`,
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

  // R1 Handlers for POD Invoicing, Stage Approvals & CRM
  const handleGenerateFromPod = async (tripId: string) => {
    setGenerating(true);
    setError(null);
    try {
      const pod = await apiClient.get<Pod>(`/pods/by-trip/${tripId}`);
      if (!pod || !pod.id) {
        setError("No POD found for this trip. Trip must reach DELIVERED status first.");
        return;
      }
      if (pod.currentStatus === "ON_HOLD") {
        setError(`Cannot generate invoice: POD is ON_HOLD (${pod.holdReason}). Release hold in Audit Desk first.`);
        return;
      }
      const invoice = await apiClient.post<Invoice>("/invoices/generate-from-pod", {
        podId: pod.id,
      });
      setNotice({
        type: "success",
        message: `Invoice ${invoice.invoiceNumber} successfully generated from POD! Customer approval stages snapshotted.`,
      });
      setSelectedTripIds([]);
      // Refetch
      const [tripsRes, invoicesRes] = await Promise.all([
        apiClient.get<Paginated<Trip>>("/trips?status=READY_FOR_BILLING"),
        apiClient.get<Paginated<Invoice>>("/invoices"),
      ]);
      setUnbilledTrips(tripsRes.data);
      setInvoices(invoicesRes.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to generate invoice from POD");
    } finally {
      setGenerating(false);
    }
  };

  const handleOpenInvoiceDetail = async (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsInvoiceDetailOpen(true);
    setDetailLoading(true);
    try {
      const [stages, followUps] = await Promise.all([
        apiClient.get<InvoiceStage[]>(`/invoices/${invoice.id}/stages`),
        apiClient.get<InvoiceFollowUp[]>(`/invoices/${invoice.id}/follow-ups`),
      ]);
      setInvoiceStages(stages);
      setInvoiceFollowUps(followUps);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load invoice stages/follow-ups");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleApproveStage = async (stageId: string) => {
    if (!selectedInvoice) return;
    setStageActionLoading(true);
    try {
      const updatedInvoice = await apiClient.post<Invoice>(
        `/invoices/${selectedInvoice.id}/stages/${stageId}/approve`,
        { comments: stageComments.trim() || undefined }
      );
      setSelectedInvoice(updatedInvoice);
      setStageComments("");
      const stages = await apiClient.get<InvoiceStage[]>(`/invoices/${selectedInvoice.id}/stages`);
      setInvoiceStages(stages);
      const invRes = await apiClient.get<Paginated<Invoice>>("/invoices");
      setInvoices(invRes.data);
      setNotice({
        type: "success",
        message: `Stage approved! Invoice status: ${updatedInvoice.status}`,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to approve stage");
    } finally {
      setStageActionLoading(false);
    }
  };

  const handleHoldStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice || !holdingStageId) return;
    setStageActionLoading(true);
    try {
      const updatedInvoice = await apiClient.post<Invoice>(
        `/invoices/${selectedInvoice.id}/stages/${holdingStageId}/hold`,
        { holdReason: stageHoldReason, holdRemarks: stageHoldRemarks.trim() }
      );
      setSelectedInvoice(updatedInvoice);
      setHoldingStageId(null);
      setStageHoldRemarks("");
      const stages = await apiClient.get<InvoiceStage[]>(`/invoices/${selectedInvoice.id}/stages`);
      setInvoiceStages(stages);
      const invRes = await apiClient.get<Paginated<Invoice>>("/invoices");
      setInvoices(invRes.data);
      setNotice({ type: "success", message: `Invoice stage placed on hold (${stageHoldReason}).` });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to place stage on hold");
    } finally {
      setStageActionLoading(false);
    }
  };

  const handleReleaseStageHold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice || !releasingStageId) return;
    setStageActionLoading(true);
    try {
      const updatedInvoice = await apiClient.post<Invoice>(
        `/invoices/${selectedInvoice.id}/stages/${releasingStageId}/release-hold`,
        { releaseRemarks: stageReleaseRemarks.trim() || "Hold released by accounts" }
      );
      setSelectedInvoice(updatedInvoice);
      setReleasingStageId(null);
      setStageReleaseRemarks("");
      const stages = await apiClient.get<InvoiceStage[]>(`/invoices/${selectedInvoice.id}/stages`);
      setInvoiceStages(stages);
      const invRes = await apiClient.get<Paginated<Invoice>>("/invoices");
      setInvoices(invRes.data);
      setNotice({ type: "success", message: "Invoice stage hold released." });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to release stage hold");
    } finally {
      setStageActionLoading(false);
    }
  };

  const handleCreateFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    setCrmLoading(true);
    try {
      const newFollowUp = await apiClient.post<InvoiceFollowUp>(
        `/invoices/${selectedInvoice.id}/follow-ups`,
        {
          contactedPerson: crmContactedPerson.trim() || undefined,
          contactEmail: crmContactEmail.trim() || undefined,
          contactPhone: crmContactPhone.trim() || undefined,
          channel: crmChannel,
          outcome: crmOutcome || undefined,
          notes: crmNotes.trim() || undefined,
          nextFollowUpDate: crmNextDate || undefined,
        }
      );
      setInvoiceFollowUps((prev) => [newFollowUp, ...prev]);
      setCrmNotes("");
      setNotice({ type: "success", message: "CRM follow-up touchpoint recorded!" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to record follow-up");
    } finally {
      setCrmLoading(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    const amt = Number(paymentAmount);
    if (isNaN(amt) || amt <= 0) return;
    setPaymentLoading(true);
    try {
      await apiClient.post("/payments", {
        invoiceId: selectedInvoice.id,
        amount: amt,
        paymentMethod,
        referenceNumber: paymentReference.trim() || undefined,
        paymentDate: paymentDate || undefined,
      });
      setPaymentAmount("");
      setPaymentReference("");
      const invRes = await apiClient.get<Paginated<Invoice>>("/invoices");
      setInvoices(invRes.data);
      const updated = invRes.data.find((i) => i.id === selectedInvoice.id);
      if (updated) setSelectedInvoice(updated);
      setNotice({ type: "success", message: `Payment of ${formatRupees(amt)} recorded successfully!` });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to record payment");
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleCreateCreditNote = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const invoice = invoices.find((item) => String(item.invoiceNumber ?? item.id) === creditNoteInvoiceNo);
    const amount = Number(creditNoteAmount);
    const totalAmount = Number(invoice?.total ?? 0);
    if (!invoice || String(invoice.status ?? "").toUpperCase() === "PAID" || !Number.isFinite(amount) || amount <= 0 || amount > totalAmount) {
      return;
    }

    const note: CreditNote = {
      noteNo: `CN-${String(creditNotes.length + 1).padStart(4, "0")}`,
      invoiceNo: String(invoice.invoiceNumber ?? invoice.id),
      clientName: String((invoice as any).clientName ?? invoice.client?.name ?? "—"),
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
            <button
              type="button"
              onClick={() => logoutUser(router)}
              className="w-full flex items-center justify-between text-xs text-red-600 hover:text-red-700 p-1.5 rounded hover:bg-red-50 transition-colors font-medium cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <LogOut className="h-3.5 w-3.5" />
                Log Out
              </span>
            </button>
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
              <span className="font-bold text-slate-900">{formatRupees(openArTotal)}</span>
              <span className="text-slate-300">|</span>
              <span className="text-red-600 font-sans">Overdue:</span>
              <span className="font-bold text-red-600">{formatRupees(overdueArTotal)}</span>
              <span className="text-slate-300">|</span>
              <span className="text-emerald-700 font-sans">Ready to Bill:</span>
              <span className="font-bold text-emerald-700">{formatRupees(unbilledTotal)}</span>
            </Badge>

            <span className="text-xs text-slate-500 font-mono">
              GST Cycle: Oct 2026
            </span>

            <button
              type="button"
              onClick={() => logoutUser(router)}
              className="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              Log Out
            </button>
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
              <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "Unbilled Trips", value: unbilledTrips.length.toString(), meta: `${formatRupees(unbilledTotal)} ready to bill`, icon: Receipt },
                  { label: "Open Receivables", value: formatRupees(openArTotal), meta: `${openArInvoices.length} open invoices`, icon: FileText },
                  { label: "Overdue Invoices", value: overdueArInvoices.length.toString(), meta: `${formatRupees(overdueArTotal)} outstanding`, icon: Clock },
                  { label: "Generated Invoices", value: invoices.length.toString(), meta: `${paidInvoices.length} paid`, icon: CheckCircle2 },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <Card key={item.label} className="border border-slate-200 bg-white shadow-md">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between text-sm font-semibold text-slate-500">
                          <span>{item.label}</span>
                          <Icon className="h-5 w-5 text-royal" />
                        </div>
                        <div className="mt-3 text-4xl font-bold leading-none text-void">{item.value}</div>
                        <div className="mt-2 text-xs text-slate-400">{item.meta}</div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <Card className="border border-slate-200 bg-white shadow-md">
                <CardHeader className="p-6 border-b border-slate-200 flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base font-bold text-void">Recent Accounts Receivable</CardTitle>
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
                    className="h-9 text-xs border-slate-300 font-semibold"
                  >
                    Open AR Ledger
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-slate-50/75">
                      <TableRow className="border-b border-slate-200">
                        <TableHead className="py-3 text-xs font-semibold text-slate-600">Invoice</TableHead>
                        <TableHead className="py-3 text-xs font-semibold text-slate-600">Client</TableHead>
                        <TableHead className="py-3 text-xs font-semibold text-slate-600">Due Date</TableHead>
                        <TableHead className="py-3 text-right text-xs font-semibold text-slate-600">Total</TableHead>
                        <TableHead className="py-3 text-center text-xs font-semibold text-slate-600">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-8 text-center text-sm text-slate-500">
                            Loading invoices...
                          </TableCell>
                        </TableRow>
                      ) : invoices.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-8 text-center text-sm text-slate-500">
                            No invoices generated yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        invoices.slice(0, 4).map((invoice) => {
                          const invNo = String(invoice.invoiceNumber ?? invoice.id ?? "—");
                          const clientName = getDisplayName(invoice.client, (invoice as any).clientName ?? "—");
                          const dueDate = String(invoice.dueDate ?? "—");
                          const total = Number(invoice.total ?? 0);
                          const status = String(invoice.status ?? "PENDING");
                          const isPaid = status.toUpperCase() === "PAID";
                          const isOverdue = status.toUpperCase() === "OVERDUE";

                          return (
                            <TableRow key={invNo} className="border-b border-slate-200 text-sm">
                              <TableCell className="py-3 font-mono font-bold text-void">{invNo}</TableCell>
                              <TableCell className="py-3 font-medium text-slate-800">{clientName}</TableCell>
                              <TableCell className="py-3 font-mono text-slate-600">{dueDate}</TableCell>
                              <TableCell className="py-3 text-right font-mono font-bold text-void">
                                {formatRupees(total)}
                              </TableCell>
                              <TableCell className="py-3 text-center">
                                <Badge
                                  className={
                                    isPaid
                                      ? "bg-turquoise text-void font-bold border-transparent"
                                      : isOverdue
                                      ? "bg-magenta text-white font-bold border-transparent"
                                      : "bg-slate-200 text-void font-semibold border-transparent"
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
                          const invNo = String(invoice.invoiceNumber ?? invoice.id);
                          const total = Number(invoice.total ?? 0);
                          return (
                            <option key={invNo} value={invNo}>
                              {invNo} · {formatRupees(total)}
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
                              {formatRupees(note.amount)}
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
                          <TableHead className="text-xs font-semibold text-slate-600 py-2.5 text-right w-[110px]">
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
                                <span>Loading unbilled trips...</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : filteredUnbilledTrips.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="py-12 text-center text-xs text-slate-500">
                              No unbilled trips ready for billing.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredUnbilledTrips.map((trip) => {
                            const tripId = String(trip.id ?? "");
                            const isSelected = selectedTripIds.includes(tripId);
                            const lrNo = String(trip.lrNumber ?? trip.tripNumber ?? "—");
                            const clientName = getDisplayName(trip.client, (trip as any).clientName ?? "—");
                            const clientGstin = String((trip as any).clientGstin ?? trip.client?.gstin ?? "—");
                            const origin = String(trip.origin ?? "—");
                            const destination = String(trip.destination ?? "—");
                            const delDate = String(trip.deliveredAt ?? trip.eta ?? trip.createdAt ?? "—");
                            const freightCharge = Number((trip as any).amount ?? (trip as any).baseFreight ?? (trip as any).freightCharge ?? 0);
                            const toll = Number((trip as any).tollCharge ?? 0);
                            const dem = Number((trip as any).demurrageCharge ?? 0);
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
                                  {formatRupees(freightCharge)}
                                </TableCell>

                                {/* Additional Charges */}
                                <TableCell className="py-2.5 text-right font-mono text-slate-700">
                                  <div>{formatRupees(accessorials)}</div>
                                  <div className="text-[10px] text-slate-500">
                                    Toll: {formatRupees(toll)} • Dem: {formatRupees(dem)}
                                  </div>
                                </TableCell>

                                {/* Total Billable */}
                                <TableCell className="py-2.5 text-right font-mono font-bold text-slate-900">
                                  {formatRupees(netAmount)}
                                </TableCell>

                                {/* R1: Generate from POD Button */}
                                <TableCell className="py-2.5 text-right">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={generating}
                                    onClick={() => handleGenerateFromPod(tripId)}
                                    className="h-6 text-[10px] px-2 font-bold text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                                  >
                                    Bill from POD
                                  </Button>
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
                            const invNo = String(inv.invoiceNumber ?? inv.id ?? "—");
                            const clientName = getDisplayName(inv.client, (inv as any).clientName ?? "—");
                            const issueDate = String(inv.issueDate ?? inv.createdAt ?? "—");
                            const dueDate = String(inv.dueDate ?? "—");
                            const tripsCount = Array.isArray(inv.lines)
                              ? inv.lines.length
                              : (Array.isArray((inv as any).trips)
                              ? (inv as any).trips.length
                              : typeof (inv as any).tripsCount === "number"
                              ? (inv as any).tripsCount
                              : 1);
                            const totalAmount = Number(inv.total ?? 0);
                            const gstAmount = Number(inv.gstAmount ?? 0);
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
                                  {formatRupees(subtotal)}
                                </TableCell>
                                <TableCell className="py-2.5 text-right font-mono font-bold text-slate-900">
                                  {formatRupees(totalAmount)}
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
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleOpenInvoiceDetail(inv)}
                                    className="h-6 text-[10px] px-2 border-slate-300 font-semibold text-royal hover:bg-royal/10"
                                  >
                                    Review & Stages
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
                      Subtotal: <strong className="text-white">{formatRupees(selectedSubtotal)}</strong>
                    </span>
                    <span>
                      Est. GST ({gstRate}%): <strong className="text-white">{formatRupees(selectedGst)}</strong>
                    </span>
                    <span>
                      Grand Total: <strong className="text-emerald-400 font-bold">{formatRupees(selectedGrandTotal)}</strong>
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
                  {selectedTripIds.length === 1 && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={generating}
                      onClick={() => handleGenerateFromPod(selectedTripIds[0])}
                      className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 shadow-md flex items-center gap-1.5"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {generating ? "Generating..." : "Generate from POD"}
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    disabled={generating}
                    onClick={handleGenerateInvoice}
                    className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 shadow-md flex items-center gap-1.5"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {generating ? "Generating..." : "Generate Consolidated Invoice"}
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
                  {invoiceTargetClient ? getDisplayName(invoiceTargetClient.client, (invoiceTargetClient as any).clientName ?? "—") : "—"}
                </div>
                <p className="text-[11px] text-slate-600 leading-tight">
                  {invoiceTargetClient ? String((invoiceTargetClient as any).clientAddress ?? (invoiceTargetClient as any).address ?? "—") : "—"}
                </p>
                <div className="text-[11px] font-mono text-slate-600 pt-1 space-y-0.5">
                  <div>Client GSTIN: <span className="font-bold text-slate-800">{invoiceTargetClient ? String((invoiceTargetClient as any).clientGstin ?? invoiceTargetClient.client?.gstin ?? "—") : "—"}</span></div>
                  <div>Payment Terms: <span className="font-bold text-slate-800">{invoiceTargetClient ? String((invoiceTargetClient as any).paymentTerms ?? "Net 30 Days") : "—"}</span></div>
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
                      const freight = Number((t as any).amount ?? (t as any).baseFreight ?? (t as any).freightCharge ?? 0);
                      const toll = Number((t as any).tollCharge ?? 0);
                      const dem = Number((t as any).demurrageCharge ?? 0);
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
                            {formatRupees(freight)}
                          </TableCell>
                          <TableCell className="py-2 text-right text-slate-600">
                            {formatRupees(toll)}
                          </TableCell>
                          <TableCell className="py-2 text-right text-slate-600">
                            {formatRupees(dem)}
                          </TableCell>
                          <TableCell className="py-2 text-right font-bold text-slate-900">
                            {formatRupees(lineTotal)}
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
                    {formatRupees(selectedSubtotal)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>IGST @ {gstRate}% (Inter-state Freight):</span>
                  <span className="font-mono font-medium text-slate-800">
                    {formatRupees(selectedGst)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
                  <span>Invoice Grand Total:</span>
                  <span className="font-mono text-base text-blue-700">
                    {formatRupees(selectedGrandTotal)}
                  </span>
                </div>

                <p className="text-[10px] text-slate-600 italic text-right font-sans">
                  Total in words: Indian Rupees {formatNumber(paiseToRupees(selectedGrandTotal))} Only
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

      {/* INVOICE REVIEW, MULTI-STAGE APPROVAL & CRM MODAL */}
      <Dialog open={isInvoiceDetailOpen} onOpenChange={setIsInvoiceDetailOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden border-slate-200 shadow-2xl max-h-[92vh] flex flex-col">
          <DialogHeader className="p-4 px-6 border-b border-slate-200 bg-slate-50/90 flex-shrink-0 flex flex-row items-center justify-between space-y-0">
            <div>
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Receipt className="h-4 w-4 text-royal" />
                Invoice {selectedInvoice?.invoiceNumber ?? selectedInvoice?.id}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Multi-stage customer approval, CRM touchpoints, and payment settlement ledger.
              </DialogDescription>
            </div>
            <Badge
              variant="outline"
              className={`font-mono text-xs font-bold uppercase ${
                selectedInvoice?.status === "PAID"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                  : selectedInvoice?.status === "FULLY_APPROVED"
                  ? "bg-teal-50 text-teal-700 border-teal-300"
                  : selectedInvoice?.status === "IN_STAGE"
                  ? "bg-blue-50 text-blue-700 border-blue-300"
                  : selectedInvoice?.status === "OVERDUE"
                  ? "bg-red-50 text-red-700 border-red-300"
                  : "bg-amber-50 text-amber-700 border-amber-300"
              }`}
            >
              {selectedInvoice?.status ?? "DRAFT"}
            </Badge>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-800 bg-white">
            {/* 1. Header Overview Cards */}
            <div className="grid grid-cols-4 gap-3 p-3.5 rounded-lg border border-slate-200 bg-slate-50/60 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Client Account</span>
                <span className="font-bold text-slate-900 mt-0.5 block truncate">
                  {getDisplayName(selectedInvoice?.client, (selectedInvoice as any)?.clientName ?? "—")}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Due Date</span>
                <span className="font-mono text-slate-800 mt-0.5 block">
                  {selectedInvoice?.dueDate ? String(selectedInvoice.dueDate) : "—"}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Subtotal (Net)</span>
                <span className="font-mono font-bold text-slate-900 mt-0.5 block">
                  {formatRupees(Number(selectedInvoice?.subtotal ?? (Number(selectedInvoice?.total ?? 0) - Number(selectedInvoice?.gstAmount ?? 0))))}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Grand Total (incl. GST)</span>
                <span className="font-mono font-bold text-emerald-700 text-sm mt-0.5 block">
                  {formatRupees(Number(selectedInvoice?.total ?? 0))}
                </span>
              </div>
            </div>

            {/* 2. Multi-Stage Approval Pipeline */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-royal" /> Sequential Approval Stages (R1 Pipeline)
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  {invoiceStages.filter((s) => s.status === "APPROVED").length} of {invoiceStages.length} Approved
                </span>
              </div>

              {detailLoading ? (
                <div className="p-6 text-center text-slate-400">Loading approval pipeline...</div>
              ) : invoiceStages.length === 0 ? (
                <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 text-center">
                  No approval stage templates were configured for this customer.
                </div>
              ) : (
                <div className="space-y-2">
                  {invoiceStages.map((st) => (
                    <div
                      key={st.id}
                      className={`p-3 rounded-lg border text-xs transition-all ${
                        st.status === "APPROVED"
                          ? "bg-emerald-50/40 border-emerald-300"
                          : st.status === "ON_HOLD"
                          ? "bg-red-50/50 border-red-300"
                          : "bg-white border-slate-200 shadow-xs"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-100 font-mono text-[11px] font-bold text-slate-700">
                            {st.stageOrder}
                          </span>
                          <span className="font-bold text-slate-900">{st.stageName}</span>
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                            Role: {st.approverRole}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[9px] font-bold px-1.5 py-0 uppercase ${
                            st.status === "APPROVED"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                              : st.status === "ON_HOLD"
                              ? "bg-red-50 text-red-700 border-red-300"
                              : "bg-amber-50 text-amber-700 border-amber-300"
                          }`}
                        >
                          {st.status}
                        </Badge>
                      </div>

                      {st.comments && (
                        <div className="mt-1.5 text-[11px] text-slate-600 italic">
                          Comments: &ldquo;{st.comments}&rdquo;
                        </div>
                      )}
                      {st.approvedAt && (
                        <div className="mt-1 text-[10px] text-slate-500 font-mono">
                          Approved On: {formatDate(st.approvedAt as any)}
                        </div>
                      )}

                      {/* Actions for Pending or On Hold stages */}
                      {st.status === "PENDING" && (
                        <div className="mt-2.5 flex items-center gap-2 pt-2 border-t border-slate-100">
                          <Input
                            placeholder="Approval remarks (optional)..."
                            value={stageComments}
                            onChange={(e) => setStageComments(e.target.value)}
                            className="h-7 text-[11px] max-w-xs"
                          />
                          <Button
                            type="button"
                            size="sm"
                            disabled={stageActionLoading}
                            onClick={() => handleApproveStage(st.id)}
                            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                          >
                            <Check className="h-3 w-3 mr-1" /> Approve Stage
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={stageActionLoading}
                            onClick={() => setHoldingStageId(st.id)}
                            className="h-7 text-xs border-red-300 text-red-700 hover:bg-red-50"
                          >
                            <AlertTriangle className="h-3 w-3 mr-1" /> Hold Stage
                          </Button>
                        </div>
                      )}

                      {st.status === "ON_HOLD" && (
                        <div className="mt-2 flex items-center gap-2 pt-2 border-t border-red-100">
                          <Button
                            type="button"
                            size="sm"
                            disabled={stageActionLoading}
                            onClick={() => setReleasingStageId(st.id)}
                            className="h-7 text-xs bg-red-700 hover:bg-red-800 text-white font-bold"
                          >
                            Release Stage Hold
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. CRM Follow-Up Ledger */}
            <div className="space-y-3 pt-3 border-t border-slate-200">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                <PhoneCall className="h-4 w-4 text-royal" /> Collections CRM & Touchpoint History
              </span>

              {/* Log new CRM touchpoint form */}
              <form onSubmit={handleCreateFollowUp} className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-3">
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <Label className="text-[10px] font-bold text-slate-700">Channel *</Label>
                    <select
                      value={crmChannel}
                      onChange={(e) => setCrmChannel(e.target.value)}
                      className="mt-1 h-8 w-full rounded border border-slate-300 bg-white px-2 text-xs"
                    >
                      <option value="PHONE">PHONE</option>
                      <option value="EMAIL">EMAIL</option>
                      <option value="IN_PERSON">IN_PERSON</option>
                      <option value="PORTAL">PORTAL</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-[10px] font-bold text-slate-700">Contacted Person</Label>
                    <Input
                      placeholder="e.g. Ramesh Accounts"
                      value={crmContactedPerson}
                      onChange={(e) => setCrmContactedPerson(e.target.value)}
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] font-bold text-slate-700">Outcome</Label>
                    <select
                      value={crmOutcome}
                      onChange={(e) => setCrmOutcome(e.target.value)}
                      className="mt-1 h-8 w-full rounded border border-slate-300 bg-white px-2 text-xs"
                    >
                      <option value="PROMISE_TO_PAY">PROMISE_TO_PAY</option>
                      <option value="DISPUTE_RAISED">DISPUTE_RAISED</option>
                      <option value="SENT_REMINDER">SENT_REMINDER</option>
                      <option value="ESCALATED">ESCALATED</option>
                      <option value="OTHER">OTHER</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-[10px] font-bold text-slate-700">Next Follow-Up</Label>
                    <Input
                      type="date"
                      value={crmNextDate}
                      onChange={(e) => setCrmNextDate(e.target.value)}
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="Touchpoint notes / customer promise details..."
                    value={crmNotes}
                    onChange={(e) => setCrmNotes(e.target.value)}
                    className="h-8 text-xs flex-1"
                  />
                  <Button type="submit" disabled={crmLoading} size="sm" className="h-8 bg-royal text-white text-xs font-bold px-3">
                    {crmLoading ? "Logging..." : "Log CRM Touchpoint"}
                  </Button>
                </div>
              </form>

              {/* Past follow-ups list */}
              <div className="space-y-2">
                {invoiceFollowUps.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-2">No previous CRM follow-up logs recorded.</p>
                ) : (
                  invoiceFollowUps.map((fu, idx) => (
                    <div key={fu.id || idx} className="p-2.5 rounded border border-slate-200 bg-white text-xs space-y-1">
                      <div className="flex items-center justify-between font-mono">
                        <span className="font-bold text-slate-800">
                          [{fu.channel}] {fu.contactedPerson ?? "Client AP"} · Outcome: <strong className="text-royal">{fu.outcome ?? "—"}</strong>
                        </span>
                        <span className="text-[10px] text-slate-500">{formatDate(fu.createdAt as any)}</span>
                      </div>
                      {fu.notes && <p className="text-[11px] text-slate-600 mb-0 italic">&ldquo;{fu.notes}&rdquo;</p>}
                      {fu.nextFollowUpDate && (
                        <div className="text-[10px] font-mono text-amber-700">Next Follow-Up On: {fu.nextFollowUpDate}</div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 4. Record Payment Settlement */}
            <div className="space-y-3 pt-3 border-t border-slate-200">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                <CreditCard className="h-4 w-4 text-emerald-600" /> Record Financial Payment Settlement
              </span>

              {selectedInvoice?.status === "PAID" ? (
                <div className="p-3 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 font-bold text-xs flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Invoice is fully paid and settled.
                </div>
              ) : (
                <form onSubmit={handleRecordPayment} className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-3">
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <Label className="text-[10px] font-bold text-slate-700">Payment Amount (₹) *</Label>
                      <Input
                        type="number"
                        min="1"
                        placeholder="Amount in Rupees"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        className="mt-1 h-8 text-xs"
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] font-bold text-slate-700">Method *</Label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="mt-1 h-8 w-full rounded border border-slate-300 bg-white px-2 text-xs"
                      >
                        <option value="NEFT">NEFT</option>
                        <option value="RTGS">RTGS</option>
                        <option value="UPI">UPI</option>
                        <option value="CHEQUE">CHEQUE</option>
                        <option value="CASH">CASH</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-[10px] font-bold text-slate-700">UTR / Reference No</Label>
                      <Input
                        placeholder="e.g. UTR-98234123"
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value)}
                        className="mt-1 h-8 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] font-bold text-slate-700">Payment Date</Label>
                      <Input
                        type="date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        className="mt-1 h-8 text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button type="submit" disabled={paymentLoading} size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4">
                      {paymentLoading ? "Recording..." : "Record Payment & Settle"}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>

          <DialogFooter className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsInvoiceDetailOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* HOLD STAGE MODAL */}
      <Dialog open={Boolean(holdingStageId)} onOpenChange={(open) => !open && setHoldingStageId(null)}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden border-slate-200 shadow-xl">
          <DialogHeader className="p-5 border-b border-slate-200 bg-red-50/60">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <DialogTitle className="text-base font-semibold text-red-950">Place Approval Stage on Hold</DialogTitle>
            </div>
          </DialogHeader>

          <form onSubmit={handleHoldStage}>
            <div className="p-5 space-y-3">
              <div>
                <Label htmlFor="stageHoldReason" className="text-xs font-bold text-slate-800">Hold Reason *</Label>
                <select
                  id="stageHoldReason"
                  value={stageHoldReason}
                  onChange={(e) => setStageHoldReason(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-xs text-slate-900"
                >
                  <option value="DISPUTED_LINE">DISPUTED_LINE - Client disputes specific charge line</option>
                  <option value="RATE_CARD_MISMATCH">RATE_CARD_MISMATCH - Freight calculated differs from contract</option>
                  <option value="DOCUMENT_MISSING">DOCUMENT_MISSING - Supporting voucher/challan not attached</option>
                  <option value="OTHER">OTHER - Custom approval exception</option>
                </select>
              </div>

              <div>
                <Label htmlFor="stageHoldRemarks" className="text-xs font-bold text-slate-800">Remarks *</Label>
                <Textarea
                  id="stageHoldRemarks"
                  rows={3}
                  value={stageHoldRemarks}
                  onChange={(e) => setStageHoldRemarks(e.target.value)}
                  placeholder="Detail the dispute or discrepancy..."
                  className="mt-1 text-xs border-slate-300"
                  required
                />
              </div>
            </div>

            <DialogFooter className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setHoldingStageId(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={stageActionLoading} className="bg-red-600 hover:bg-red-700 text-white font-semibold">
                {stageActionLoading ? "Submitting..." : "Confirm Stage Hold"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* RELEASE STAGE HOLD MODAL */}
      <Dialog open={Boolean(releasingStageId)} onOpenChange={(open) => !open && setReleasingStageId(null)}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden border-slate-200 shadow-xl">
          <DialogHeader className="p-5 border-b border-slate-200 bg-emerald-50/60">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <DialogTitle className="text-base font-semibold text-emerald-950">Release Stage Hold</DialogTitle>
            </div>
          </DialogHeader>

          <form onSubmit={handleReleaseStageHold}>
            <div className="p-5 space-y-3">
              <div>
                <Label htmlFor="stageReleaseRemarks" className="text-xs font-bold text-slate-800">Resolution Remarks *</Label>
                <Textarea
                  id="stageReleaseRemarks"
                  rows={3}
                  value={stageReleaseRemarks}
                  onChange={(e) => setStageReleaseRemarks(e.target.value)}
                  placeholder="Explain how the dispute was resolved with client..."
                  className="mt-1 text-xs border-slate-300"
                  required
                />
              </div>
            </div>

            <DialogFooter className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setReleasingStageId(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={stageActionLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                {stageActionLoading ? "Submitting..." : "Confirm Release Hold"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
