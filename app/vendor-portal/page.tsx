"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  Eye,
  AlertCircle,
  Truck,
  FileText,
  ShieldCheck,
  ExternalLink,
  Layers,
  Receipt,
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

import { apiClient, ApiError } from "@/lib/api/client";
import type { Settlement, Paginated } from "@/lib/api/types";

export default function VendorPortalPage() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch all vendor settlements
  const fetchSettlements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<Paginated<Settlement>>("/vendor-settlements");
      setSettlements(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load settlements");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettlements();
  }, [fetchSettlements]);

  // Fetch settlement details when selectedId changes
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailError(null);
      return;
    }

    async function fetchDetail(id: string) {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const res = await apiClient.get(`/vendor-settlements/${id}`);
        setDetail(res as Record<string, unknown>);
      } catch (err) {
        setDetailError(
          err instanceof ApiError ? err.message : "Failed to load settlement details"
        );
      } finally {
        setDetailLoading(false);
      }
    }

    fetchDetail(selectedId);
  }, [selectedId]);

  // Compute Total Outstanding: sum of amounts where status in ["PENDING", "APPROVED"]
  const totalOutstanding = useMemo(() => {
    return settlements.reduce((sum, item) => {
      const status = String(item.status ?? "").toUpperCase();
      if (status === "PENDING" || status === "APPROVED") {
        const amt = Number(item.amount ?? item.subtotal ?? item.totalAmount ?? item.total ?? 0);
        return sum + amt;
      }
      return sum;
    }, 0);
  }, [settlements]);

  // Filter settlements based on search query
  const filteredSettlements = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return settlements;
    return settlements.filter((item) => {
      const settlementNo = String(item.settlementNumber ?? item.settlementNo ?? item.id ?? "").toLowerCase();
      const status = String(item.status ?? "").toLowerCase();
      const period = String(item.period ?? "").toLowerCase();
      const vendor = String(item.vendor ?? "").toLowerCase();
      return (
        settlementNo.includes(q) ||
        status.includes(q) ||
        period.includes(q) ||
        vendor.includes(q)
      );
    });
  }, [settlements, searchQuery]);

  const renderStatusBadge = (statusStr: string) => {
    const s = statusStr.toUpperCase();
    let badgeClass = "bg-slate-100 text-slate-800 border-slate-300";
    if (s === "APPROVED" || s === "CLEARED" || s === "PAID") {
      badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-300";
    } else if (s === "PENDING" || s === "IN_REVIEW") {
      badgeClass = "bg-amber-50 text-amber-800 border-amber-300";
    } else if (s === "REJECTED" || s === "FAILED") {
      badgeClass = "bg-red-50 text-red-700 border-red-300";
    }

    return (
      <Badge
        variant="outline"
        className={`text-[11px] font-semibold px-2 py-0.5 rounded ${badgeClass}`}
      >
        {s || "PENDING"}
      </Badge>
    );
  };

  const lineItems = useMemo(() => {
    if (!detail) return [];
    if (Array.isArray(detail.items)) return detail.items as Array<Record<string, unknown>>;
    if (Array.isArray(detail.trips)) return detail.trips as Array<Record<string, unknown>>;
    if (Array.isArray(detail.lineItems)) return detail.lineItems as Array<Record<string, unknown>>;
    return [];
  }, [detail]);

  const detailTotal = useMemo(() => {
    if (!detail) return 0;
    if (detail.total !== undefined && detail.total !== null) return Number(detail.total);
    if (detail.amount !== undefined && detail.amount !== null) return Number(detail.amount);
    if (detail.subtotal !== undefined && detail.subtotal !== null) return Number(detail.subtotal);
    return lineItems.reduce((acc, it) => acc + Number(it.amount ?? it.total ?? 0), 0);
  }, [detail, lineItems]);

  return (
    <div className="flex h-screen w-full bg-slate-100 text-slate-800 font-sans antialiased overflow-hidden">
      {/* 1. LEFT SIDEBAR */}
      <aside className="w-64 flex-shrink-0 flex flex-col border-r border-slate-200 bg-white shadow-xs">
        {/* Vendor Branding Header */}
        <div className="h-16 border-b border-slate-200 px-5 flex items-center justify-between bg-white">
          <div className="flex items-center space-x-2.5">
            <div className="h-8 w-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-xs shadow-xs">
              V
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-tight text-slate-900 block leading-tight">
                VECTO VENDOR PORTAL
              </span>
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-bold block">
                3PL PARTNER DESK
              </span>
            </div>
          </div>
        </div>

        {/* Vendor Identity Badge */}
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-100" />
              <span className="text-xs font-semibold text-slate-800">
                Logistics Partner Clearing
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200 font-bold">
              3PL-REM
            </span>
          </div>
          <p className="text-[11px] text-slate-600 mt-1 truncate">
            Freight Settlements & Remittances
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <button
            type="button"
            className="w-full flex items-center space-x-3 px-3 py-2 rounded-md text-xs font-medium bg-slate-900 text-white shadow-xs transition-colors"
          >
            <Receipt className="h-4 w-4 text-white" />
            <span>Settlement Ledger</span>
            <span className="ml-auto text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold bg-slate-800 text-slate-200">
              {settlements.length}
            </span>
          </button>
        </nav>

        {/* Internal Role Switchers */}
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
        {/* TOP HEADER */}
        <header className="h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between gap-4 flex-shrink-0">
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-tight">
              Vendor Settlement Portal
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Review freight payout remittances, trip itemization, and settlement reconciliation.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {/* Search Input */}
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                type="text"
                placeholder="Search settlements..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs bg-slate-50 border-slate-200"
              />
            </div>

            {/* Metric Pill: Total Outstanding */}
            <Badge
              variant="outline"
              className="bg-slate-50 border-slate-200 text-slate-700 font-mono text-xs px-3 py-1 flex items-center gap-1.5"
            >
              <span className="text-slate-500 font-sans">Total Outstanding:</span>
              <span className="font-bold text-slate-900">
                ₹{totalOutstanding.toLocaleString("en-IN")}
              </span>
            </Badge>
          </div>
        </header>

        {/* MAIN CONTENT */}
        <main className="flex-1 overflow-y-auto p-6 space-y-4">
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={fetchSettlements}
                className="h-7 text-xs border-red-300 text-red-800 hover:bg-red-100 flex items-center gap-1"
              >
                <RotateCcw className="h-3 w-3" />
                Retry
              </Button>
            </div>
          )}

          {/* Settlements Table Card */}
          <Card className="shadow-none border-slate-200 bg-white">
            <CardHeader className="p-4 border-b border-slate-200 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-sm font-bold text-slate-900">
                  Settlements Ledger
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 mt-0.5">
                  Overview of processed remittances, pending disbursements, and historical payout cycles.
                </CardDescription>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                Portal: Read-Only
              </Badge>
            </CardHeader>

            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50/75">
                  <TableRow className="border-b border-slate-200">
                    <TableHead className="text-xs font-semibold text-slate-600 py-3">
                      Settlement No
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 py-3">
                      Period
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 py-3 text-center">
                      Trip Count
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 py-3 text-right">
                      Subtotal
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 py-3 text-center">
                      Status
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 py-3 text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i} className="border-b border-slate-200">
                        <TableCell colSpan={6} className="py-3">
                          <div className="h-4 bg-slate-200/70 rounded animate-pulse w-3/4" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : filteredSettlements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12 text-center text-xs text-slate-500">
                        No settlements yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSettlements.map((item, idx) => {
                      const id = String(item.id ?? `settlement-${idx}`);
                      const settlementNo = String(
                        item.settlementNumber ?? item.settlementNo ?? item.id ?? "—"
                      );
                      const period = String(
                        item.period ??
                          (item.periodStart && item.periodEnd
                            ? `${item.periodStart} – ${item.periodEnd}`
                            : item.date ?? item.createdAt ?? "—")
                      );
                      const tripCount =
                        item.tripCount ??
                        (Array.isArray(item.trips)
                          ? item.trips.length
                          : Array.isArray(item.items)
                          ? item.items.length
                          : "—");
                      const subtotal = Number(
                        item.subtotal ?? item.amount ?? item.total ?? 0
                      );
                      const status = String(item.status ?? "PENDING");

                      return (
                        <TableRow
                          key={id}
                          className="border-b border-slate-200 text-xs hover:bg-slate-50/60"
                        >
                          <TableCell className="py-2.5 font-mono font-bold text-slate-900">
                            {settlementNo}
                          </TableCell>
                          <TableCell className="py-2.5 text-slate-700">
                            {period}
                          </TableCell>
                          <TableCell className="py-2.5 text-center font-mono text-slate-800">
                            {String(tripCount)}
                          </TableCell>
                          <TableCell className="py-2.5 text-right font-mono font-bold text-slate-900">
                            ₹{subtotal.toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className="py-2.5 text-center">
                            {renderStatusBadge(status)}
                          </TableCell>
                          <TableCell className="py-2.5 text-right">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedId(id)}
                              className="h-7 text-xs border-slate-300 hover:bg-slate-100 flex items-center gap-1.5 ml-auto"
                            >
                              <Eye className="h-3 w-3 text-slate-500" />
                              View Details
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
        </main>
      </div>

      {/* DETAIL MODAL (Read-Only) */}
      <Dialog
        open={Boolean(selectedId)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl p-0 overflow-hidden border-slate-200 shadow-2xl">
          <DialogHeader className="p-4 px-6 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-sm font-bold text-slate-900">
                  Settlement Details:{" "}
                  <span className="font-mono">
                    {String(
                      detail?.settlementNumber ??
                        detail?.settlementNo ??
                        detail?.id ??
                        selectedId ??
                        "—"
                    )}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  Period:{" "}
                  <span className="font-medium text-slate-700">
                    {String(
                      detail?.period ??
                        (detail?.periodStart && detail?.periodEnd
                          ? `${detail.periodStart} – ${detail.periodEnd}`
                          : "—")
                    )}
                  </span>
                </DialogDescription>
              </div>
              <div>{renderStatusBadge(String(detail?.status ?? "PENDING"))}</div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
            {detailLoading ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-2">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
                <span className="text-xs text-slate-500">Loading settlement details...</span>
              </div>
            ) : detailError ? (
              <div
                role="alert"
                className="p-3.5 bg-red-50 border border-red-300 rounded-lg text-red-900 text-xs flex items-center justify-between"
              >
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                  <span className="font-medium">{detailError}</span>
                </div>
              </div>
            ) : (
              <>
                {/* Summary banner */}
                <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Settlement ID</span>
                    <span className="font-mono font-bold text-slate-900 truncate block">
                      {String(detail?.settlementNumber ?? detail?.settlementNo ?? detail?.id ?? "—")}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Vendor Counterparty</span>
                    <span className="font-semibold text-slate-800 truncate block">
                      {String(detail?.vendor ?? detail?.vendorName ?? "3PL Partner")}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 block text-[11px]">Total Net Remittance</span>
                    <span className="font-mono font-extrabold text-slate-900 block">
                      ₹{detailTotal.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                {/* Line Items Table */}
                <div>
                  <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-slate-500" />
                    Trip Consignment Line Items
                  </h4>
                  <div className="border border-slate-200 rounded-md overflow-hidden">
                    <Table>
                      <TableHeader className="bg-slate-50/75">
                        <TableRow className="border-b border-slate-200">
                          <TableHead className="text-xs font-semibold text-slate-600 py-2.5">
                            Trip Number
                          </TableHead>
                          <TableHead className="text-xs font-semibold text-slate-600 py-2.5">
                            Rate Type
                          </TableHead>
                          <TableHead className="text-xs font-semibold text-slate-600 py-2.5 text-right">
                            Amount
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lineItems.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={3}
                              className="py-8 text-center text-xs text-slate-500"
                            >
                              No line items found for this settlement.
                            </TableCell>
                          </TableRow>
                        ) : (
                          lineItems.map((item, i) => {
                            const tripNo = String(
                              item.tripNumber ?? item.tripNo ?? item.tripId ?? item.id ?? `TRP-${i + 1}`
                            );
                            const rateType = String(
                              item.rateType ?? item.type ?? item.description ?? "Flat / Km Benchmark Rate"
                            );
                            const amount = Number(item.amount ?? item.total ?? item.subtotal ?? 0);

                            return (
                              <TableRow
                                key={i}
                                className="border-b border-slate-100 text-xs hover:bg-slate-50/60"
                              >
                                <TableCell className="py-2.5 font-mono font-medium text-slate-900">
                                  {tripNo}
                                </TableCell>
                                <TableCell className="py-2.5 text-slate-700">
                                  {rateType}
                                </TableCell>
                                <TableCell className="py-2.5 text-right font-mono font-bold text-slate-900">
                                  ₹{amount.toLocaleString("en-IN")}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Total Summary Footer */}
                <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                  <span className="text-xs text-slate-500 font-medium">
                    Total Settled Amount
                  </span>
                  <span className="text-base font-extrabold font-mono text-slate-900">
                    ₹{detailTotal.toLocaleString("en-IN")}
                  </span>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="p-4 px-6 border-t border-slate-200 bg-slate-50">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedId(null)}
              className="h-8 text-xs border-slate-300"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
