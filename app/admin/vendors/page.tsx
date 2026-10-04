"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Plus, AlertCircle, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import type { Vendor, Paginated } from "@/lib/api/types";

export default function AdminVendorsPage() {
  const [items, setItems] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Vendor | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    payoutTerms: "Net 15 Days",
    status: "ACTIVE",
  });

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<Paginated<Vendor>>("/vendors");
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load vendors");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormData({
      name: "",
      payoutTerms: "Net 15 Days",
      status: "ACTIVE",
    });
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (vendor: Vendor) => {
    setEditingItem(vendor);
    setFormData({
      name: String(vendor.name ?? ""),
      payoutTerms: String(vendor.payoutTerms ?? vendor.paymentTerms ?? "Net 15 Days"),
      status: String(vendor.status ?? (vendor.active ? "ACTIVE" : "INACTIVE")),
    });
    setIsCreateOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingItem) {
        const id = String(editingItem.id);
        await apiClient.patch(`/vendors/${id}`, formData);
        setNotice({ type: "success", message: "Vendor updated successfully." });
      } else {
        await apiClient.post("/vendors", formData);
        setNotice({ type: "success", message: "Vendor created successfully." });
      }
      setIsCreateOpen(false);
      await fetchItems();
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof ApiError ? err.message : "Failed to save vendor",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await apiClient.patch(`/vendors/${id}`, { status: "INACTIVE" });
      setNotice({ type: "success", message: "Vendor deactivated." });
      await fetchItems();
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof ApiError ? err.message : "Failed to deactivate vendor",
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
      {/* Page Header */}
      <header className="h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between gap-4 flex-shrink-0">
        <div>
          <h1 className="text-base font-bold text-slate-900 leading-tight">Vendors</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage 3PL logistics carriers, subcontractors, and payout terms.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={handleOpenCreate}
          className="h-8 text-xs bg-slate-900 hover:bg-slate-800 text-white font-semibold flex items-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Create Vendor
        </Button>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6 space-y-4">
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
              onClick={fetchItems}
              className="h-7 text-xs border-red-300 text-red-800 hover:bg-red-100"
            >
              Retry
            </Button>
          </div>
        )}

        <Card className="shadow-none border-slate-200 bg-white">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50/75">
                <TableRow className="border-b border-slate-200">
                  <TableHead className="py-2.5 text-xs font-semibold text-slate-600">Name</TableHead>
                  <TableHead className="py-2.5 text-xs font-semibold text-slate-600">Payout Terms</TableHead>
                  <TableHead className="py-2.5 text-xs font-semibold text-slate-600 text-center">Status</TableHead>
                  <TableHead className="py-2.5 text-xs font-semibold text-slate-600 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i} className="border-b border-slate-200">
                      <TableCell colSpan={4} className="py-3">
                        <div className="h-4 bg-slate-200/70 rounded animate-pulse w-3/4" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-xs text-slate-500">
                      No vendors yet. Create one to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((vendor, idx) => {
                    const id = String(vendor.id ?? `vendor-${idx}`);
                    const name = String(vendor.name ?? "—");
                    const payoutTerms = String(vendor.payoutTerms ?? vendor.paymentTerms ?? "—");
                    const status = String(
                      vendor.status ?? (vendor.active === false ? "INACTIVE" : "ACTIVE")
                    ).toUpperCase();
                    const isInactive = status === "INACTIVE";

                    return (
                      <TableRow key={id} className="border-b border-slate-200 text-xs hover:bg-slate-50/60">
                        <TableCell className="py-2.5 font-medium text-slate-900">{name}</TableCell>
                        <TableCell className="py-2.5 text-slate-700">{payoutTerms}</TableCell>
                        <TableCell className="py-2.5 text-center">
                          <Badge
                            variant="outline"
                            className={
                              isInactive
                                ? "bg-slate-100 text-slate-600 border-slate-300"
                                : "bg-emerald-50 text-emerald-700 border-emerald-300"
                            }
                          >
                            {status}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2.5 text-right space-x-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEdit(vendor)}
                            className="h-7 text-xs border-slate-300"
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isInactive}
                            onClick={() => handleDeactivate(id)}
                            className="h-7 text-xs border-slate-300 text-red-600 hover:bg-red-50 hover:border-red-300"
                          >
                            Deactivate
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

      {/* Create / Edit Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-slate-200 shadow-2xl">
          <DialogHeader className="p-4 px-6 border-b border-slate-200 bg-slate-50">
            <DialogTitle className="text-sm font-bold text-slate-900">
              {editingItem ? "Edit Vendor" : "Create Vendor"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-0.5">
              {editingItem ? "Update vendor details and payout terms." : "Register a 3PL freight carrier."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="vendor-name" className="text-xs font-semibold text-slate-700">Vendor Name</Label>
              <Input
                id="vendor-name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-8 text-xs"
                placeholder="e.g. Swift Logistics 3PL"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="vendor-payout" className="text-xs font-semibold text-slate-700">Payout Terms</Label>
              <Input
                id="vendor-payout"
                required
                value={formData.payoutTerms}
                onChange={(e) => setFormData({ ...formData, payoutTerms: e.target.value })}
                className="h-8 text-xs"
                placeholder="e.g. Net 15 Days"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="vendor-status" className="text-xs font-semibold text-slate-700">Status</Label>
              <select
                id="vendor-status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full h-8 text-xs rounded-md border border-slate-300 bg-white px-2 text-slate-900"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>

            <DialogFooter className="pt-3 border-t border-slate-200">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreateOpen(false)}
                className="h-8 text-xs border-slate-300"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submitting}
                className="h-8 text-xs bg-slate-900 text-white font-semibold"
              >
                {submitting ? "Saving..." : editingItem ? "Update Vendor" : "Create Vendor"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
