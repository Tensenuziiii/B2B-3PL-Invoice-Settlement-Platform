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
import type { Client, Paginated } from "@/lib/api/types";

export default function AdminClientsPage() {
  const [items, setItems] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Client | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    gstin: "",
    paymentTermsDays: 30,
    status: "ACTIVE",
  });

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<Paginated<Client>>("/clients");
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load clients");
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
      gstin: "",
      paymentTermsDays: 30,
      status: "ACTIVE",
    });
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (client: Client) => {
    setEditingItem(client);
    setFormData({
      name: String(client.name ?? ""),
      gstin: String(client.gstin ?? ""),
      paymentTermsDays: Number(client.paymentTermsDays ?? 30),
      status: String(client.status ?? "ACTIVE"),
    });
    setIsCreateOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        paymentTermsDays: Number(formData.paymentTermsDays),
      };
      if (editingItem) {
        const id = String(editingItem.id);
        await apiClient.patch(`/clients/${id}`, payload);
        setNotice({ type: "success", message: "Client updated successfully." });
      } else {
        await apiClient.post("/clients", payload);
        setNotice({ type: "success", message: "Client created successfully." });
      }
      setIsCreateOpen(false);
      await fetchItems();
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof ApiError ? err.message : "Failed to save client",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await apiClient.patch(`/clients/${id}`, { status: "INACTIVE" });
      setNotice({ type: "success", message: "Client deactivated." });
      await fetchItems();
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof ApiError ? err.message : "Failed to deactivate client",
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-platinum">
      {/* Page Header */}
      <header className="h-20 border-b border-slate-200 bg-white px-8 flex items-center justify-between gap-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-void leading-tight">Clients</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage enterprise shippers, billing entities, and payment terms.
          </p>
        </div>
        <Button
          type="button"
          onClick={handleOpenCreate}
          className="h-11 px-6 text-base bg-royal hover:bg-royal/90 text-white font-semibold flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Create Client
        </Button>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8 space-y-6">
        {notice && (
          <div
            role="status"
            className={`p-4 border rounded-xl text-sm flex items-center justify-between shadow-xs animate-in fade-in-50 ${
              notice.type === "success"
                ? "bg-turquoise/20 border-turquoise/40 text-void font-semibold"
                : "bg-magenta/20 border-magenta/40 text-magenta font-semibold"
            }`}
          >
            <div className="flex items-center space-x-2.5">
              {notice.type === "success" ? (
                <CheckCircle2 className="h-5 w-5 text-turquoise flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-magenta flex-shrink-0" />
              )}
              <span>{notice.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="font-bold underline text-void hover:text-slate-600"
            >
              Dismiss
            </button>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="p-4 bg-magenta/20 border border-magenta/40 rounded-xl text-magenta text-sm flex items-center justify-between shadow-xs animate-in fade-in-50"
          >
            <div className="flex items-center space-x-2.5">
              <AlertCircle className="h-5 w-5 text-magenta flex-shrink-0" />
              <span className="font-semibold">{error}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchItems}
              className="h-9 px-4 text-sm border-magenta text-magenta hover:bg-magenta/10 font-bold"
            >
              Retry
            </Button>
          </div>
        )}

        <Card className="border border-slate-200 bg-white shadow-md rounded-xl overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50 border-b border-slate-200">
                <TableRow>
                  <TableHead className="py-4 px-6 text-sm font-bold text-void">Name</TableHead>
                  <TableHead className="py-4 px-6 text-sm font-bold text-void">GSTIN</TableHead>
                  <TableHead className="py-4 px-6 text-sm font-bold text-void">Payment Terms</TableHead>
                  <TableHead className="py-4 px-6 text-sm font-bold text-void text-center">Status</TableHead>
                  <TableHead className="py-4 px-6 text-sm font-bold text-void text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i} className="border-b border-slate-200">
                      <TableCell colSpan={5} className="py-4 px-6">
                        <div className="h-5 bg-slate-200/70 rounded animate-pulse w-3/4" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-sm font-medium text-slate-500">
                      No clients yet. Create one to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((client, idx) => {
                    const id = String(client.id ?? `client-${idx}`);
                    const name = String(client.name ?? "—");
                    const gstin = String(client.gstin ?? "—");
                    const paymentTerms = client.paymentTermsDays;
                    const termsStr = paymentTerms !== undefined && paymentTerms !== null ? `Net ${paymentTerms} Days` : "—";
                    const status = String(client.status ?? "ACTIVE").toUpperCase();
                    const isInactive = status === "INACTIVE";

                    return (
                      <TableRow key={id} className="border-b border-slate-200 text-sm hover:bg-slate-50/80 transition-colors">
                        <TableCell className="py-4 px-6 font-bold text-void">{name}</TableCell>
                        <TableCell className="py-4 px-6 font-mono text-slate-700">{gstin}</TableCell>
                        <TableCell className="py-4 px-6 font-medium text-void">{termsStr}</TableCell>
                        <TableCell className="py-4 px-6 text-center">
                          <Badge
                            className={
                              isInactive
                                ? "bg-slate-200 text-slate-700 font-semibold px-3 py-1 text-sm border-0"
                                : "bg-turquoise text-void font-semibold px-3 py-1 text-sm border-0"
                            }
                          >
                            {status}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4 px-6 text-right space-x-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEdit(client)}
                            className="h-9 px-4 text-sm border-royal text-royal hover:bg-royal/10 font-medium"
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isInactive}
                            onClick={() => handleDeactivate(id)}
                            className="h-9 px-4 text-sm border-magenta text-magenta hover:bg-magenta/10 font-medium"
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
        <DialogContent className="max-w-md p-0 overflow-hidden border-slate-200 shadow-2xl rounded-xl">
          <DialogHeader className="p-6 border-b border-slate-200 bg-slate-50">
            <DialogTitle className="text-xl font-bold text-void">
              {editingItem ? "Edit Client" : "Create Client"}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 mt-1">
              {editingItem ? "Update client profile and terms." : "Register a new client account."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="p-6 space-y-5 text-sm">
            <div className="space-y-2">
              <Label htmlFor="client-name" className="text-sm font-semibold text-void">Client Name</Label>
              <Input
                id="client-name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-11 text-base border-slate-300 focus-visible:ring-royal"
                placeholder="e.g. Metro Wholesale India"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-gstin" className="text-sm font-semibold text-void">GSTIN</Label>
              <Input
                id="client-gstin"
                required
                value={formData.gstin}
                onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                className="h-11 text-base font-mono border-slate-300 focus-visible:ring-royal"
                placeholder="15-character GSTIN"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-terms" className="text-sm font-semibold text-void">Payment Terms (Days)</Label>
              <Input
                id="client-terms"
                type="number"
                min="0"
                required
                value={formData.paymentTermsDays}
                onChange={(e) => setFormData({ ...formData, paymentTermsDays: Number(e.target.value) || 0 })}
                className="h-11 text-base font-mono border-slate-300 focus-visible:ring-royal"
                placeholder="30"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-status" className="text-sm font-semibold text-void">Status</Label>
              <select
                id="client-status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full h-11 text-base rounded-md border border-slate-300 bg-white px-3 text-void focus:outline-none focus:ring-2 focus:ring-royal"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>

            <DialogFooter className="pt-4 border-t border-slate-200 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                className="h-11 px-6 text-base border-slate-300 text-void hover:bg-slate-100"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="h-11 px-6 text-base bg-royal hover:bg-royal/90 text-white font-semibold"
              >
                {submitting ? "Saving..." : editingItem ? "Update Client" : "Create Client"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
