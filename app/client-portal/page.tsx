"use client";

import React, { useState, useMemo } from "react";
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

// Types
interface InvoiceLineTrip {
  id: string;
  lrNumber: string;
  route: string;
  cargo: string;
  deliveryDate: string;
  freightAmount: number;
  tollAmount: number;
  demurrageAmount: number;
  totalAmount: number;
  isDisputed: boolean;
  disputeReason?: string;
  disputeAmount?: number;
  disputeComments?: string;
  signatory: string;
  dockStamp: string;
}

interface ClientInvoice {
  invoiceNo: string;
  vendorName: string;
  vendorGstin: string;
  issueDate: string;
  dueDate: string;
  grossAmount: number;
  status: "Pending Approval" | "Partially Disputed" | "Approved" | "Paid";
  lineItems: InvoiceLineTrip[];
}

const INITIAL_INVOICES: ClientInvoice[] = [
  {
    invoiceNo: "INV-2026-9921",
    vendorName: "Vecto Logistics India Pvt Ltd",
    vendorGstin: "27AABCV1234F1Z5",
    issueDate: "02-Oct-2026",
    dueDate: "01-Nov-2026 (Net 30)",
    grossAmount: 94105,
    status: "Pending Approval",
    lineItems: [
      {
        id: "TRIP-8842",
        lrNumber: "LR-BLR-8842",
        route: "Hosur DC (TN) → Whitefield DC (KA)",
        cargo: "12 Pallets FMCG Groceries",
        deliveryDate: "02-Oct-2026",
        freightAmount: 24500,
        tollAmount: 850,
        demurrageAmount: 1200,
        totalAmount: 26550,
        isDisputed: false,
        signatory: "K. Ramesh (Warehouse In-Charge)",
        dockStamp: "STAMPED: Gate Bay #4 Received",
      },
      {
        id: "TRIP-8848",
        lrNumber: "LR-GUJ-5521",
        route: "Hazira Port (GJ) → Pithampur Hub (MP)",
        cargo: "Chemical Drums (Non-Hazardous)",
        deliveryDate: "30-Sep-2026",
        freightAmount: 49500,
        tollAmount: 2200,
        demurrageAmount: 1500,
        totalAmount: 53200,
        isDisputed: false,
        signatory: "D. Chauhan (Materials Inward)",
        dockStamp: "STAMPED: Gate Bay #1 Received",
      },
    ],
  },
  {
    invoiceNo: "INV-2026-8802",
    vendorName: "Vecto Logistics India Pvt Ltd",
    vendorGstin: "27AABCV1234F1Z5",
    issueDate: "25-Sep-2026",
    dueDate: "25-Oct-2026 (Net 30)",
    grossAmount: 124300,
    status: "Partially Disputed",
    lineItems: [
      {
        id: "TRIP-8810",
        lrNumber: "LR-MUM-4011",
        route: "Bhiwandi Hub → Pune DC",
        cargo: "Beverages & Dairy Pallets",
        deliveryDate: "24-Sep-2026",
        freightAmount: 32000,
        tollAmount: 1400,
        demurrageAmount: 2100,
        totalAmount: 35500,
        isDisputed: true,
        disputeReason: "Damaged Goods",
        disputeAmount: 4500,
        disputeComments: "2 pallets arrived with wet cartons; salvage credit deduction.",
        signatory: "M. Joshi (Quality Inspector)",
        dockStamp: "STAMPED: Conditional Delivery",
      },
      {
        id: "TRIP-8812",
        lrNumber: "LR-MUM-4015",
        route: "Panvel Yard → Sanand Plant",
        cargo: "Packaging Consumables",
        deliveryDate: "24-Sep-2026",
        freightAmount: 58000,
        tollAmount: 2800,
        demurrageAmount: 0,
        totalAmount: 60800,
        isDisputed: false,
        signatory: "A. Patel (Store Manager)",
        dockStamp: "STAMPED: Full Clean Delivery",
      },
    ],
  },
  {
    invoiceNo: "INV-2026-7730",
    vendorName: "Vecto Logistics India Pvt Ltd",
    vendorGstin: "27AABCV1234F1Z5",
    issueDate: "15-Sep-2026",
    dueDate: "15-Oct-2026",
    grossAmount: 168400,
    status: "Approved",
    lineItems: [
      {
        id: "TRIP-8760",
        lrNumber: "LR-DEL-3301",
        route: "Kundli DC → Okhla Hub",
        cargo: "Dry Grocery Pallets",
        deliveryDate: "14-Sep-2026",
        freightAmount: 28000,
        tollAmount: 1200,
        demurrageAmount: 0,
        totalAmount: 29200,
        isDisputed: false,
        signatory: "V. Sharma",
        dockStamp: "STAMPED: Verified",
      },
    ],
  },
  {
    invoiceNo: "INV-2026-6612",
    vendorName: "Vecto Logistics India Pvt Ltd",
    vendorGstin: "27AABCV1234F1Z5",
    issueDate: "20-Aug-2026",
    dueDate: "20-Sep-2026",
    grossAmount: 215000,
    status: "Paid",
    lineItems: [],
  },
];

export default function ClientAccountsPayablePortal() {
  const [activeMenu, setActiveMenu] = useState("Invoice Inbox");
  const [searchQuery, setSearchQuery] = useState("");
  const [invoices, setInvoices] = useState<ClientInvoice[]>(INITIAL_INVOICES);
  const [apContactEmail, setApContactEmail] = useState("ap.payments@metro-wholesale.in");
  const [notificationPreferences, setNotificationPreferences] = useState({
    invoices: true,
    disputes: true,
    payments: true,
  });
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Deep-Dive Modal State
  const [selectedInvoice, setSelectedInvoice] = useState<ClientInvoice | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Line-Item Inline Dispute State
  const [activeDisputeTripId, setActiveDisputeTripId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState("Damaged Goods");
  const [disputeAmountInput, setDisputeAmountInput] = useState("3500");
  const [disputeComments, setDisputeComments] = useState("Carton seals breached upon unloading at Bay #4; 3 cases damaged.");

  // POD Viewer Popover State
  const [viewingPodTrip, setViewingPodTrip] = useState<InvoiceLineTrip | null>(null);

  // Filtered Invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const q = searchQuery.toLowerCase();
      return (
        inv.invoiceNo.toLowerCase().includes(q) ||
        inv.vendorName.toLowerCase().includes(q) ||
        inv.status.toLowerCase().includes(q)
      );
    });
  }, [invoices, searchQuery]);

  const matchesSearch = (values: string[]) => {
    const query = searchQuery.trim().toLowerCase();
    return !query || values.some((value) => value.toLowerCase().includes(query));
  };
  const paidInvoices = invoices.filter(
    (invoice) => invoice.status === "Paid" && matchesSearch([invoice.invoiceNo, invoice.vendorName]),
  );
  const disputedLines = invoices.flatMap((invoice) =>
    invoice.lineItems
      .filter((item) => item.isDisputed)
      .map((item) => ({ invoice, item })),
  );
  const filteredDisputedLines = disputedLines.filter(({ invoice, item }) =>
    matchesSearch([
      invoice.invoiceNo,
      item.id,
      item.lrNumber,
      item.disputeReason || "",
      item.disputeComments || "",
    ]),
  );
  const activeDisputeCount = disputedLines.length;
  const pendingInvoiceCount = invoices.filter(
    (invoice) => invoice.status === "Pending Approval" || invoice.status === "Partially Disputed",
  ).length;

  // Open Deep-Dive Modal
  const handleOpenInvoiceModal = (inv: ClientInvoice, disputeTripId?: string) => {
    const invoiceCopy = JSON.parse(JSON.stringify(inv)) as ClientInvoice;
    setSelectedInvoice(invoiceCopy);
    setActiveDisputeTripId(disputeTripId ?? null);
    setViewingPodTrip(null);
    if (disputeTripId) {
      const disputedTrip = invoiceCopy.lineItems.find((item) => item.id === disputeTripId);
      if (disputedTrip) {
        setDisputeReason(disputedTrip.disputeReason || "Damaged Goods");
        setDisputeAmountInput(disputedTrip.disputeAmount?.toString() || "3500");
        setDisputeComments(disputedTrip.disputeComments || "");
      }
    }
    setIsModalOpen(true);
  };

  // Toggle Inline Dispute on a specific trip
  const handleToggleDisputeRow = (tripId: string) => {
    if (activeDisputeTripId === tripId) {
      setActiveDisputeTripId(null);
    } else {
      setActiveDisputeTripId(tripId);
      const trip = selectedInvoice?.lineItems.find((t) => t.id === tripId);
      if (trip && trip.isDisputed) {
        setDisputeReason(trip.disputeReason || "Damaged Goods");
        setDisputeAmountInput(trip.disputeAmount?.toString() || "3500");
        setDisputeComments(trip.disputeComments || "");
      } else {
        setDisputeReason("Damaged Goods");
        setDisputeAmountInput("3500");
        setDisputeComments("Carton seals breached upon unloading at Bay #4; 3 cases damaged.");
      }
    }
  };

  // Save Inline Dispute
  const handleSaveDispute = (tripId: string) => {
    if (!selectedInvoice) return;

    const amt = parseFloat(disputeAmountInput) || 0;
    const updatedLineItems = selectedInvoice.lineItems.map((item) => {
      if (item.id === tripId) {
        return {
          ...item,
          isDisputed: true,
          disputeReason,
          disputeAmount: amt,
          disputeComments,
        };
      }
      return item;
    });

    const updatedInvoice: ClientInvoice = {
      ...selectedInvoice,
      status: "Partially Disputed",
      lineItems: updatedLineItems,
    };

    setSelectedInvoice(updatedInvoice);
    setActiveDisputeTripId(null);

    // Update parent list
    setInvoices((prev) =>
      prev.map((inv) => (inv.invoiceNo === updatedInvoice.invoiceNo ? updatedInvoice : inv))
    );
  };

  // Remove Dispute on a trip
  const handleRemoveDispute = (tripId: string) => {
    if (!selectedInvoice) return;

    const updatedLineItems = selectedInvoice.lineItems.map((item) => {
      if (item.id === tripId) {
        const { disputeReason, disputeAmount, disputeComments, ...rest } = item;
        return { ...rest, isDisputed: false };
      }
      return item;
    });

    const anyStillDisputed = updatedLineItems.some((t) => t.isDisputed);
    const updatedInvoice: ClientInvoice = {
      ...selectedInvoice,
      status: anyStillDisputed ? "Partially Disputed" : "Pending Approval",
      lineItems: updatedLineItems,
    };

    setSelectedInvoice(updatedInvoice);
    setActiveDisputeTripId(null);

    setInvoices((prev) =>
      prev.map((inv) => (inv.invoiceNo === updatedInvoice.invoiceNo ? updatedInvoice : inv))
    );
  };

  // Calculations for Selected Modal
  const totalDeductions = useMemo(() => {
    if (!selectedInvoice) return 0;
    return selectedInvoice.lineItems.reduce(
      (sum, item) => (item.isDisputed ? sum + (item.disputeAmount || 0) : sum),
      0
    );
  }, [selectedInvoice]);

  const netPayableAuthorized = useMemo(() => {
    if (!selectedInvoice) return 0;
    return Math.max(selectedInvoice.grossAmount - totalDeductions, 0);
  }, [selectedInvoice, totalDeductions]);

  // Approve Invoice
  const handleApproveInvoice = () => {
    if (!selectedInvoice) return;

    const approvedInv: ClientInvoice = {
      ...selectedInvoice,
      status: "Approved",
    };

    setInvoices((prev) =>
      prev.map((inv) => (inv.invoiceNo === approvedInv.invoiceNo ? approvedInv : inv))
    );
    setSelectedInvoice(approvedInv);
    setIsModalOpen(false);

    alert(
      `✓ INVOICE APPROVED!\nInvoice ${approvedInv.invoiceNo} has been approved for ERP settlement.\nNet Payment Authorized: ₹${netPayableAuthorized.toLocaleString("en-IN")}\nDebit Note Reference: ${totalDeductions > 0 ? "DN-2026-METRO-04" : "None (Clean Approval)"}`
    );
  };

  const handleSaveVendorSettings = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSettingsSaved(true);
  };

  return (
    <div className="flex h-screen w-full bg-slate-100 text-slate-800 font-sans antialiased overflow-hidden">
      {/* 1. LEFT SIDEBAR (Client Portal Themed - Clean Crisp Light Slate/White) */}
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
            { name: "Payment History", icon: CreditCard, count: null },
            {
              name: "Active Disputes",
              icon: AlertTriangle,
              count: activeDisputeCount ? `${activeDisputeCount} Flagged` : null,
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

        {/* Switcher to Internal Logistics Tools (For Project Review) */}
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
                    ? "Search disputes, trips..."
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
              <span className="font-bold text-slate-900">₹94,105</span>
              <span className="text-slate-300">|</span>
              <span className="text-amber-600 font-sans">Due This Week:</span>
              <span className="font-bold text-amber-700">₹31,270</span>
            </Badge>
          </div>
        </header>

        {/* 3. MAIN CONTENT: INVOICE INBOX VIEW */}
        <main className="flex-1 overflow-y-auto p-6 space-y-4">
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
                  {filteredInvoices.map((inv) => (
                    <TableRow key={inv.invoiceNo} className="border-b border-slate-200 text-xs hover:bg-slate-50/70 transition-colors">
                      {/* Invoice No */}
                      <TableCell className="py-3 font-mono font-bold text-slate-900">
                        {inv.invoiceNo}
                        <span className="text-[10px] text-slate-500 block font-sans">
                          {inv.vendorName}
                        </span>
                      </TableCell>

                      {/* Date */}
                      <TableCell className="py-3 font-mono text-slate-700">
                        {inv.issueDate}
                      </TableCell>

                      {/* Due Date */}
                      <TableCell className="py-3 font-mono text-slate-700">
                        {inv.dueDate}
                      </TableCell>

                      {/* Total Amount */}
                      <TableCell className="py-3 text-right font-mono font-bold text-slate-900 text-sm">
                        ₹{inv.grossAmount.toLocaleString("en-IN")}
                      </TableCell>

                      {/* Status Badge */}
                      <TableCell className="py-3 text-center">
                        <Badge
                          variant="outline"
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                            inv.status === "Approved"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                              : inv.status === "Partially Disputed"
                              ? "bg-amber-50 text-amber-800 border-amber-300"
                              : inv.status === "Paid"
                              ? "bg-blue-50 text-blue-700 border-blue-300"
                              : "bg-slate-100 text-slate-800 border-slate-300"
                          }`}
                        >
                          {inv.status}
                        </Badge>
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
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          )}

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
                      paidInvoices.map((invoice) => (
                        <TableRow key={invoice.invoiceNo} className="border-b border-slate-200 text-xs">
                          <TableCell className="py-3 font-mono font-bold text-slate-900">{invoice.invoiceNo}</TableCell>
                          <TableCell className="py-3 text-slate-700">{invoice.vendorName}</TableCell>
                          <TableCell className="py-3 font-mono text-slate-700">{invoice.issueDate}</TableCell>
                          <TableCell className="py-3 text-right font-mono font-bold text-slate-900">
                            ₹{invoice.grossAmount.toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className="py-3 text-center">
                            <Badge className="border border-emerald-300 bg-emerald-50 text-emerald-700">Paid</Badge>
                          </TableCell>
                        </TableRow>
                      ))
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

          {activeMenu === "Active Disputes" && (
            <Card className="shadow-none border-slate-200 bg-white">
              <CardHeader className="p-4 border-b border-slate-200 flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900">Active Disputes</CardTitle>
                  <CardDescription className="text-xs text-slate-500 mt-0.5">
                    Review disputed trip lines and their requested deductions.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="font-mono text-xs">
                  {activeDisputeCount} Flagged
                </Badge>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-50/75">
                    <TableRow className="border-b border-slate-200">
                      <TableHead className="py-3 text-xs font-semibold text-slate-600">Trip / LR</TableHead>
                      <TableHead className="py-3 text-xs font-semibold text-slate-600">Invoice</TableHead>
                      <TableHead className="py-3 text-xs font-semibold text-slate-600">Reason</TableHead>
                      <TableHead className="py-3 text-right text-xs font-semibold text-slate-600">Deduction (₹)</TableHead>
                      <TableHead className="py-3 text-right text-xs font-semibold text-slate-600">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDisputedLines.length ? (
                      filteredDisputedLines.map(({ invoice, item }) => (
                        <TableRow key={`${invoice.invoiceNo}-${item.id}`} className="border-b border-slate-200 text-xs">
                          <TableCell className="py-3 font-mono font-bold text-slate-900">
                            {item.id}<span className="block text-[10px] font-normal text-slate-500">{item.lrNumber}</span>
                          </TableCell>
                          <TableCell className="py-3 font-mono text-slate-700">{invoice.invoiceNo}</TableCell>
                          <TableCell className="py-3 text-slate-700">
                            <span className="font-semibold">{item.disputeReason || "Unspecified"}</span>
                            {item.disputeComments && <span className="mt-1 block text-[11px] text-slate-500">{item.disputeComments}</span>}
                          </TableCell>
                          <TableCell className="py-3 text-right font-mono font-bold text-red-600">
                            ₹{(item.disputeAmount || 0).toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className="py-3 text-right">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenInvoiceModal(invoice, item.id)}
                              className="h-7 text-xs border-slate-300"
                            >
                              Review
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
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

          {activeMenu === "Vendor Settings" && (
            <Card className="shadow-none border-slate-200 bg-white">
              <CardHeader className="p-4 border-b border-slate-200">
                <CardTitle className="text-sm font-bold text-slate-900">Vendor Settings</CardTitle>
                <CardDescription className="text-xs text-slate-500 mt-0.5">
                  Review Vecto Logistics vendor details and manage AP notification preferences.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 p-5">
                <div className="grid gap-4 border-b border-slate-200 pb-5 sm:grid-cols-3">
                  <div>
                    <span className="block text-[10px] font-semibold uppercase text-slate-500">Vendor</span>
                    <span className="mt-1 block text-sm font-semibold text-slate-900">Vecto Logistics India Pvt Ltd</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-semibold uppercase text-slate-500">GSTIN</span>
                    <span className="mt-1 block font-mono text-sm text-slate-800">27AABCV1234F1Z5</span>
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
                  Invoice {selectedInvoice?.invoiceNo} Summary
                </DialogTitle>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-bold ${
                    selectedInvoice?.status === "Approved"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                      : selectedInvoice?.status === "Partially Disputed"
                      ? "bg-amber-50 text-amber-800 border-amber-300"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {selectedInvoice?.status}
                </Badge>
              </div>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Vendor: {selectedInvoice?.vendorName} • GSTIN: {selectedInvoice?.vendorGstin}
              </DialogDescription>
            </div>

            <div className="text-right">
              <span className="text-[11px] text-slate-500 block">Total Invoice Value:</span>
              <span className="text-lg font-bold font-mono text-slate-900">
                ₹{selectedInvoice?.grossAmount.toLocaleString("en-IN")}
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
                    <strong>Dispute Applied:</strong> ₹{totalDeductions.toLocaleString("en-IN")} has been flagged for debit note adjustment. Net authorized payment adjusted.
                  </span>
                </div>
                <Badge className="bg-amber-200 text-amber-900 font-mono text-[10px]">
                  Debit Note Pending
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
                    {selectedInvoice?.lineItems.map((trip) => {
                      const isDisputeRowOpen = activeDisputeTripId === trip.id;

                      return (
                        <React.Fragment key={trip.id}>
                          <TableRow
                            className={`border-b border-slate-200 text-xs transition-colors ${
                              trip.isDisputed ? "bg-amber-50/40" : "hover:bg-slate-50/50"
                            }`}
                          >
                            {/* Trip & LR */}
                            <TableCell className="py-2.5 font-mono">
                              <span className="font-bold text-slate-900 block">{trip.id}</span>
                              <span className="text-[10px] text-slate-500 font-sans">{trip.lrNumber}</span>
                            </TableCell>

                            {/* Route & Cargo */}
                            <TableCell className="py-2.5">
                              <div className="font-medium text-slate-800">{trip.route}</div>
                              <div className="text-[10px] text-slate-500">{trip.cargo}</div>
                            </TableCell>

                            {/* Date */}
                            <TableCell className="py-2.5 font-mono text-slate-700">
                              {trip.deliveryDate}
                            </TableCell>

                            {/* Line Total */}
                            <TableCell className="py-2.5 text-right font-mono font-bold text-slate-900">
                              ₹{trip.totalAmount.toLocaleString("en-IN")}
                              {trip.isDisputed && (
                                <span className="block text-[10px] text-red-600 font-normal">
                                  - ₹{trip.disputeAmount?.toLocaleString("en-IN")} Disputed
                                </span>
                              )}
                            </TableCell>

                            {/* 1. Small "View POD" text link */}
                            <TableCell className="py-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => setViewingPodTrip(viewingPodTrip?.id === trip.id ? null : trip)}
                                className="text-blue-600 hover:text-blue-800 underline font-semibold text-xs inline-flex items-center gap-1"
                              >
                                <Eye className="h-3 w-3" /> View POD
                              </button>
                            </TableCell>

                            {/* 2. Small warning/flag icon button */}
                            <TableCell className="py-2.5 text-center">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleToggleDisputeRow(trip.id)}
                                className={`h-7 w-7 p-0 rounded-md border ${
                                  trip.isDisputed
                                    ? "bg-red-50 text-red-600 border-red-300 hover:bg-red-100"
                                    : "border-slate-300 text-slate-500 hover:text-red-600 hover:border-red-300"
                                }`}
                                title={trip.isDisputed ? "Edit Dispute" : "Flag Dispute"}
                              >
                                <Flag className="h-3.5 w-3.5 fill-current" />
                              </Button>
                            </TableCell>
                          </TableRow>

                          {/* INLINE POD VIEWER EXPANSION */}
                          {viewingPodTrip?.id === trip.id && (
                            <TableRow className="bg-slate-50 border-b border-slate-200">
                              <TableCell colSpan={6} className="p-4">
                                <div className="p-4 rounded-lg border border-slate-300 bg-white space-y-2">
                                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                    <div className="flex items-center space-x-2">
                                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                                      <span className="font-bold text-xs text-slate-900">
                                        Verified Consignee Delivery Proof: {trip.lrNumber}
                                      </span>
                                    </div>
                                    <button
                                      onClick={() => setViewingPodTrip(null)}
                                      className="text-slate-400 hover:text-slate-700"
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-2 gap-4 text-xs pt-1">
                                    <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                                      <span className="text-[10px] uppercase font-bold text-slate-500 block">
                                        Dock Seal & Stamp
                                      </span>
                                      <span className="font-mono text-xs text-blue-800 font-bold block mt-1">
                                        {trip.dockStamp}
                                      </span>
                                      <span className="text-[10px] text-slate-500 block mt-0.5">
                                        Verified on {trip.deliveryDate} at Dock Bay
                                      </span>
                                    </div>

                                    <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                                      <span className="text-[10px] uppercase font-bold text-slate-500 block">
                                        Receiver Signatory (Glass Sign)
                                      </span>
                                      <span className="font-serif italic font-bold text-sm text-slate-800 block mt-1">
                                        {trip.signatory}
                                      </span>
                                      <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                                        Auth Token: #SHA-9921-OK
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}

                          {/* INLINE DISPUTE LOGIC: Expand a small UI underneath row */}
                          {isDisputeRowOpen && (
                            <TableRow className="bg-amber-50/60 border-b border-slate-200">
                              <TableCell colSpan={6} className="p-4">
                                <div className="p-4 rounded-lg border border-amber-300 bg-white space-y-3 shadow-xs">
                                  <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                                    <span className="font-bold text-xs text-amber-950 flex items-center gap-1.5">
                                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                                      Flag Dispute on {trip.id} ({trip.route})
                                    </span>
                                    <span className="text-[11px] text-slate-500">
                                      Line Total: ₹{trip.totalAmount.toLocaleString("en-IN")}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-2 gap-3">
                                    {/* Dispute Reason Dropdown */}
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

                                    {/* Deducted Amount (₹) */}
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

                                  {/* Textarea for comments */}
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

                                  {/* Dispute Actions */}
                                  <div className="flex items-center justify-between pt-1">
                                    {trip.isDisputed ? (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleRemoveDispute(trip.id)}
                                        className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                                      >
                                        Remove Dispute
                                      </Button>
                                    ) : (
                                      <div />
                                    )}

                                    <div className="flex items-center space-x-2">
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
                                        onClick={() => handleSaveDispute(trip.id)}
                                        className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold"
                                      >
                                        Save Line Dispute
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Reconciliation Balance Strip */}
            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between font-mono text-xs">
              <div>
                <span className="text-slate-500 font-sans block text-[11px]">Gross Invoice Amount</span>
                <span className="font-bold text-slate-800">
                  ₹{selectedInvoice?.grossAmount.toLocaleString("en-IN")}
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
                onClick={() => alert(`Downloading Tax Invoice ${selectedInvoice?.invoiceNo}.pdf`)}
                className="h-8 text-xs border-slate-300 text-slate-700"
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
              onClick={handleApproveInvoice}
              className="h-9 px-4 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md flex items-center gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" />
              {totalDeductions > 0
                ? `Approve with Debit Note (₹${netPayableAuthorized.toLocaleString("en-IN")})`
                : "Approve Invoice for Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
