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
import type { Vehicle, Paginated } from "@/lib/api/types";

export default function AdminVehiclesPage() {
  const [items, setItems] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Vehicle | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    regNo: "",
    type: "",
    capacity: "",
    status: "ACTIVE",
  });

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<Paginated<Vehicle>>("/vehicles");
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load vehicles");
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
      regNo: "",
      type: "",
      capacity: "",
      status: "ACTIVE",
    });
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (vehicle: Vehicle) => {
    setEditingItem(vehicle);
    setFormData({
      regNo: String(vehicle.regNo ?? ""),
      type: String(vehicle.type ?? ""),
      capacity: String(vehicle.capacityKg ?? ""),
      status: vehicle.active ? "ACTIVE" : "INACTIVE",
    });
    setIsCreateOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingItem) {
        const id = String(editingItem.id);
        await apiClient.patch(`/vehicles/${id}`, formData);
        setNotice({ type: "success", message: "Vehicle updated successfully." });
      } else {
        await apiClient.post("/vehicles", formData);
        setNotice({ type: "success", message: "Vehicle created successfully." });
      }
      setIsCreateOpen(false);
      await fetchItems();
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof ApiError ? err.message : "Failed to save vehicle",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await apiClient.patch(`/vehicles/${id}`, { status: "INACTIVE" });
      setNotice({ type: "success", message: "Vehicle deactivated." });
      await fetchItems();
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof ApiError ? err.message : "Failed to deactivate vehicle",
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-platinum">
      {/* Page Header */}
      <header className="h-20 border-b border-slate-200 bg-white px-8 flex items-center justify-between gap-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-void leading-tight">Vehicles</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage logistics fleet registration, vehicle categories, and active statuses.
          </p>
        </div>
        <Button
          type="button"
          onClick={handleOpenCreate}
          className="h-11 px-6 text-base bg-royal hover:bg-royal/90 text-white font-semibold flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Create Vehicle
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
                  <TableHead className="py-4 px-6 text-sm font-bold text-void">Reg No</TableHead>
                  <TableHead className="py-4 px-6 text-sm font-bold text-void">Type</TableHead>
                  <TableHead className="py-4 px-6 text-sm font-bold text-void">Capacity</TableHead>
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
                      No vehicles yet. Create one to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((vehicle, idx) => {
                    const id = String(vehicle.id ?? `vehicle-${idx}`);
                    const regNo = String(vehicle.regNo ?? "—");
                    const type = String(vehicle.type ?? "—");
                    const capacity = vehicle.capacityKg ? `${vehicle.capacityKg} kg` : "—";
                    const status = vehicle.active ? "ACTIVE" : "INACTIVE";
                    const isInactive = !vehicle.active;

                    return (
                      <TableRow key={id} className="border-b border-slate-200 text-sm hover:bg-slate-50/80 transition-colors">
                        <TableCell className="py-4 px-6 font-mono font-bold text-void">{regNo}</TableCell>
                        <TableCell className="py-4 px-6 text-void font-medium">{type}</TableCell>
                        <TableCell className="py-4 px-6 font-mono text-slate-700">{capacity}</TableCell>
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
                            onClick={() => handleOpenEdit(vehicle)}
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
              {editingItem ? "Edit Vehicle" : "Create Vehicle"}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 mt-1">
              {editingItem ? "Update fleet vehicle records." : "Register a new vehicle into the fleet."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="p-6 space-y-5 text-sm">
            <div className="space-y-2">
              <Label htmlFor="vehicle-reg" className="text-sm font-semibold text-void">Registration Number</Label>
              <Input
                id="vehicle-reg"
                required
                value={formData.regNo}
                onChange={(e) => setFormData({ ...formData, regNo: e.target.value })}
                className="h-11 text-base font-mono border-slate-300 focus-visible:ring-royal"
                placeholder="e.g. MH 12 RN 4920"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vehicle-type" className="text-sm font-semibold text-void">Vehicle Type / Model</Label>
              <Input
                id="vehicle-type"
                required
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="h-11 text-base border-slate-300 focus-visible:ring-royal"
                placeholder="e.g. 16T Eicher Pro"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vehicle-capacity" className="text-sm font-semibold text-void">Capacity / Tonnage</Label>
              <Input
                id="vehicle-capacity"
                required
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                className="h-11 text-base font-mono border-slate-300 focus-visible:ring-royal"
                placeholder="e.g. 16 MT"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vehicle-status" className="text-sm font-semibold text-void">Status</Label>
              <select
                id="vehicle-status"
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
                {submitting ? "Saving..." : editingItem ? "Update Vehicle" : "Create Vehicle"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
