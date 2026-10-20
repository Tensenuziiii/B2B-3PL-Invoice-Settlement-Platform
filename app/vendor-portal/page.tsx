"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  LogOut,
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
import { getDisplayName, formatRupees, formatDate, logoutUser } from "@/lib/api/utils";

export default function VendorPortalPage() {
  const router = useRouter();
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
        const amt = Number(item.total ?? item.subtotal ?? 0);
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
      const settlementNo = String(item.settlementNumber ?? item.id ?? "").toLowerCase();
      const status = String(item.status ?? "").toLowerCase();
      const period = String(
        item.periodStart && item.periodEnd ? `${item.periodStart} – ${item.periodEnd}` : ""
      ).toLowerCase();
      const vendor = String(item.vendor?.name ?? "").toLowerCase();
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
    let badgeClass = "bg-slate-200 text-void font-bold border-0";
    if (s === "APPROVED" || s === "CLEARED" || s === "PAID") {
      badgeClass = "bg-turquoise text-void font-bold border-0";
    } else if (s === "PENDING" || s === "IN_REVIEW") {
      badgeClass = "bg-royal/10 text-royal font-bold border border-royal/30";
    } else if (s === "REJECTED" || s === "FAILED") {
      badgeClass = "bg-magenta/20 text-magenta font-bold border border-magenta/40";
    }

    return (
      <Badge
        variant="outline"
        className={`text-xs font-semibold px-3 py-1 rounded-md ${badgeClass}`}
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
    <div className="flex h-screen w-full bg-platinum text-void font-sans antialiased overflow-hidden">
      {/* 1. LEFT SIDEBAR */}
      <aside className="w-64 flex-shrink-0 flex flex-col border-r border-void/20 bg-void text-platinum shadow-md">
        {/* Vendor Branding Header */}
        <div className="h-16 border-b border-white/10 px-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 rounded-lg bg-royal text-white flex items-center justify-center font-black text-sm shadow-md">
              V
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-tight text-white block leading-tight">
                VECTO VENDOR PORTAL
              </span>
              <span className="text-[10px] uppercase font-mono tracking-wider text-turquoise font-bold block">
                3PL PARTNER DESK
              </span>
            </div>
          </div>
        </div>

        {/* Vendor Identity Badge */}
        <div className="px-5 py-3.5 bg-white/5 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="h-2.5 w-2.5 rounded-full bg-turquoise ring-2 ring-turquoise/30" />
              <span className="text-xs font-bold text-white">
                Logistics Partner Clearing
              </span>
            </div>
            <span className="text-[10px] font-mono text-turquoise bg-turquoise/10 px-2 py-0.5 rounded border border-turquoise/30 font-bold">
              3PL-REM
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 truncate">
            Freight Settlements & Remittances
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-5 space-y-1.5 overflow-y-auto">
          <button
            type="button"
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-semibold bg-royal text-white shadow-md transition-colors"
          >
            <Receipt className="h-5 w-5 text-white" />
            <span>Settlement Ledger</span>
            <span className="ml-auto text-xs font-mono px-2 py-0.5 rounded font-semibold bg-white/20 text-white">
              {settlements.length}
            </span>
          </button>
        </nav>

        {/* Internal Role Switchers */}
        <div className="p-4 border-t border-white/10 bg-white/5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1 mb-2 block">
            Internal Platform Roles
          </span>
          <div className="space-y-1.5 text-sm">
            <Link
              href="/dispatch"
              className="flex items-center justify-between text-slate-300 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <span className="flex items-center gap-2 font-medium">
                <Truck className="h-4 w-4 text-turquoise" />
                Dispatch Ops
              </span>
              <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
            </Link>
            <Link
              href="/audit"
              className="flex items-center justify-between text-slate-300 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <span className="flex items-center gap-2 font-medium">
                <ShieldCheck className="h-4 w-4 text-turquoise" />
                Internal Audit
              </span>
              <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
            </Link>
            <Link
              href="/accounts"
              className="flex items-center justify-between text-slate-300 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <span className="flex items-center gap-2 font-medium">
                <FileText className="h-4 w-4 text-turquoise" />
                Accounts & Billing
              </span>
              <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
            </Link>
          </div>
        </div>

        {/* Log Out Button */}
        <div className="p-4 border-t border-white/10 bg-white/5">
          <button
            type="button"
            onClick={() => logoutUser(router)}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-bold text-magenta hover:bg-magenta/10 border border-magenta/30 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      {/* RIGHT MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-platinum text-void">
        {/* TOP HEADER */}
        <header className="h-20 border-b border-slate-200 bg-white px-8 flex items-center justify-between gap-4 flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-void leading-tight">
              Vendor Settlement Portal
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Review freight payout remittances, trip itemization, and settlement reconciliation.
            </p>
          </div>

          <div className="flex items-center space-x-4">
            {/* Search Input */}
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search settlements..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 pl-10 text-sm bg-white border-slate-300 focus-visible:ring-royal"
              />
            </div>

            {/* Metric Pill: Total Outstanding */}
            <Badge
              variant="outline"
              className="bg-platinum border-slate-300 text-void font-mono text-sm px-4 py-2 flex items-center gap-2"
            >
              <span className="text-slate-500 font-sans">Total Outstanding:</span>
              <span className="font-bold text-void">
                {formatRupees(totalOutstanding)}
              </span>
            </Badge>

            <Button
              type="button"
              variant="outline"
              onClick={() => logoutUser(router)}
              className="h-11 px-6 text-sm border-magenta text-magenta hover:bg-magenta/10 font-bold"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Log Out
            </Button>
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
                      const settlementNo = String(item.settlementNumber ?? item.id ?? "—");
                      const period = String(
                        item.periodStart && item.periodEnd
                          ? `${item.periodStart.slice(0, 10)} – ${item.periodEnd.slice(0, 10)}`
                          : item.createdAt?.slice(0, 10) ?? "—"
                      );
                      const tripCount = Array.isArray(item.items) ? item.items.length : "—";
                      const subtotal = Number(item.subtotal ?? item.total ?? 0);
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
                            {formatRupees(subtotal)}
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
                      {getDisplayName(detail?.vendor ?? detail?.vendorName, "3PL Partner")}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 block text-[11px]">Total Net Remittance</span>
                    <span className="font-mono font-extrabold text-slate-900 block">
                      {formatRupees(detailTotal)}
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
                                  {formatRupees(amount)}
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
                    {formatRupees(detailTotal)}
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
