"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileCheck2,
  AlertOctagon,
  Archive,
  Settings,
  Receipt,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCw,
  CheckCircle2,
  XCircle,
  Truck,
  ExternalLink,
  ShieldCheck,
  Smartphone,
  LayoutDashboard,
  LogOut,
  ArrowRight,
  MapPin,
  AlertTriangle,
  RefreshCw,
  Eye,
  PackageCheck,
  Send,
  Clock,
  Inbox,
  FileWarning,
  HelpCircle,
  History,
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

import { apiClient, ApiError } from "@/lib/api/client";
import type { Pod, PodCheckItem, PodEvent } from "@/lib/api/types";
import { getDisplayName, formatRupees, formatNumber, formatDate, logoutUser } from "@/lib/api/utils";

interface AuditSettings {
  auditSlaHours: number;
  cashVarianceThreshold: number;
  autoFlagCashVariance: boolean;
  requireReceiverSignature: boolean;
  requireConsigneeStamp: boolean;
  notifyDispatch: boolean;
  notifyAccounts: boolean;
}

type AuditToggleSetting = keyof Pick<
  AuditSettings,
  | "autoFlagCashVariance"
  | "requireReceiverSignature"
  | "requireConsigneeStamp"
  | "notifyDispatch"
  | "notifyAccounts"
>;

const DEFAULT_AUDIT_SETTINGS: AuditSettings = {
  auditSlaHours: 2,
  cashVarianceThreshold: 500,
  autoFlagCashVariance: true,
  requireReceiverSignature: true,
  requireConsigneeStamp: true,
  notifyDispatch: true,
  notifyAccounts: true,
};

const AUDIT_TOGGLE_SETTINGS: { key: AuditToggleSetting; label: string; description: string }[] = [
  { key: "autoFlagCashVariance", label: "Auto-flag COD variances", description: "Flag trips when cash variance exceeds the threshold." },
  { key: "requireReceiverSignature", label: "Require receiver signature", description: "Keep approval blocked until a receiver signature is present." },
  { key: "requireConsigneeStamp", label: "Require consignee stamp", description: "Require a verified consignee stamp on the delivery record." },
  { key: "notifyDispatch", label: "Notify dispatch on disputes", description: "Send dispute notices to the dispatch review desk." },
  { key: "notifyAccounts", label: "Notify accounts on resolution", description: "Notify billing when an audit case is resolved." },
];

function getExpenseAmount(detail: Record<string, unknown> | null, type: "toll" | "fuel" | "allowance"): number | null {
  if (!detail) return null;
  const tally = detail.eodTally as Record<string, unknown> | undefined;
  if (tally && tally[type] != null && !isNaN(Number(tally[type]))) return Number(tally[type]);
  const tripExpenses = (detail.tripExpenses || detail.expenses) as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(tripExpenses)) {
    const matches = tripExpenses.filter(
      (item) => String(item.type).toLowerCase() === type.toLowerCase()
    );
    if (matches.length > 0) {
      return matches.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    }
  }
  if (detail[type] != null && !isNaN(Number(detail[type]))) return Number(detail[type]);
  const rep = detail.reportedExpenses as Record<string, unknown> | undefined;
  if (rep && rep[type] != null && !isNaN(Number(rep[type]))) return Number(rep[type]);
  return null;
}

export default function InternalAuditWorkspace() {
  const router = useRouter();
  const [activeMenu, setActiveMenu] = useState("Audit Queue");
  const [searchQuery, setSearchQuery] = useState("");

  // Audit Queue & Trip State
  const [queue, setQueue] = useState<Array<Record<string, unknown>>>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [tripDetail, setTripDetail] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [tripDetailLoading, setTripDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Settings State (in-memory)
  const [auditSettings, setAuditSettings] = useState<AuditSettings>(DEFAULT_AUDIT_SETTINGS);
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);

  // Document Viewer Controls State
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);

  // Verification Checklist State
  const [checklist, setChecklist] = useState({
    distanceMatch: true,
    cashMatch: true,
    signaturePresent: true,
    consigneeStamp: true,
    podQualityReadable: true,
  });

  // Notes States
  const [auditNotes, setAuditNotes] = useState("");
  const [notesError, setNotesError] = useState<string | null>(null);
  const [discrepancyNotes, setDiscrepancyNotes] = useState(
    "Discrepancy detected during audit verification. Consignment flagged for operational review."
  );
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);

  // POD Control & Verification State (R1-TASK-5.1 & R1-TASK-5.2)
  const [podDetail, setPodDetail] = useState<Pod | null>(null);
  const [podDocUrl, setPodDocUrl] = useState<string | null>(null);
  const [fivePointChecklist, setFivePointChecklist] = useState<Array<{ checkType: string; label: string; passed: boolean; remarks: string }>>([
    { checkType: "STAMP", label: "Consignee Stamp Verified", passed: true, remarks: "" },
    { checkType: "SIGNATURE", label: "Receiver Signature Verified", passed: true, remarks: "" },
    { checkType: "DATE", label: "Delivery Date & Time Recorded", passed: true, remarks: "" },
    { checkType: "REMARKS", label: "Receiver Remarks / Shortage Noted", passed: true, remarks: "" },
    { checkType: "DAMAGE", label: "Packaging Condition & Seal Verified", passed: true, remarks: "" },
  ]);

  // Hold Modal State
  const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);
  const [holdReason, setHoldReason] = useState("MISSING_STAMP");
  const [holdRemarks, setHoldRemarks] = useState("");

  // Release Hold Modal State
  const [isReleaseHoldModalOpen, setIsReleaseHoldModalOpen] = useState(false);
  const [releaseRemarks, setReleaseRemarks] = useState("");

  // Courier Modal State
  const [isCourierModalOpen, setIsCourierModalOpen] = useState(false);
  const [courierName, setCourierName] = useState("");
  const [courierTrackingNo, setCourierTrackingNo] = useState("");
  const [courierDispatchedAt, setCourierDispatchedAt] = useState("");

  // Mark Lost Modal State
  const [isLostModalOpen, setIsLostModalOpen] = useState(false);
  const [lostDate, setLostDate] = useState("");
  const [reportedBy, setReportedBy] = useState("");
  const [incidentSummary, setIncidentSummary] = useState("");

  // Request Duplicate Modal State
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [requestReason, setRequestReason] = useState("Original POD destroyed in courier transit");
  const [duplicateRemarks, setDuplicateRemarks] = useState("");

  // Events Trail Modal State
  const [isEventsModalOpen, setIsEventsModalOpen] = useState(false);

  // Initial Fetch of Queue
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get<{ data: Array<Record<string, unknown>> }>("/audits/queue");
        if (!cancelled) {
          setQueue(res.data);
          if (res.data.length > 0) {
            setSelectedTripId(String(res.data[0].tripId || res.data[0].id));
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load audit queue");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch Trip Detail & POD record when selectedTripId changes
  useEffect(() => {
    if (!selectedTripId) return;
    let cancelled = false;
    setTripDetailLoading(true);
    setPodDocUrl(null);
    setPodDetail(null);
    (async () => {
      try {
        const [tripRes, podRes] = await Promise.allSettled([
          apiClient.get(`/trips/${selectedTripId}`),
          apiClient.get<Pod>(`/pods/by-trip/${selectedTripId}`),
        ]);
        if (!cancelled) {
          if (tripRes.status === "fulfilled") {
            const raw = tripRes.value;
            const data =
              raw && typeof raw === "object" && "data" in raw && (raw as { data: unknown }).data && typeof (raw as { data: unknown }).data === "object"
                ? ((raw as { data: Record<string, unknown> }).data as Record<string, unknown>)
                : (raw as Record<string, unknown>);
            setTripDetail(data);

            const stops = (data.stops as Array<{ id: string }>) || [];
            if (stops.length > 0) {
              try {
                const docs = await apiClient.get<Array<{ id: string; url?: string }>>(`/pods/stops/${stops[0].id}`);
                if (Array.isArray(docs) && docs.length > 0 && !cancelled) {
                  try {
                    const dlRes = await apiClient.get<{ url: string }>(`/pods/${docs[0].id}/download-url`);
                    if (dlRes?.url && !cancelled) {
                      setPodDocUrl(dlRes.url);
                    }
                  } catch {
                    if (docs[0].url) setPodDocUrl(docs[0].url);
                  }
                }
              } catch {}
            }
          }
          if (podRes.status === "fulfilled" && podRes.value) {
            setPodDetail(podRes.value);
            if (Array.isArray(podRes.value.checkItems) && podRes.value.checkItems.length > 0) {
              setFivePointChecklist((prev) =>
                prev.map((item) => {
                  const existing = podRes.value?.checkItems?.find((c) => c.checkType === item.checkType);
                  return existing
                    ? { ...item, passed: existing.passed, remarks: existing.remarks || "" }
                    : item;
                })
              );
            }
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load trip");
      } finally {
        if (!cancelled) setTripDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedTripId]);

  const refetchQueueAndSelectNext = async (currentId?: string | null) => {
    try {
      const res = await apiClient.get<{ data: Array<Record<string, unknown>> }>("/audits/queue");
      setQueue(res.data);
      if (res.data.length > 0) {
        if (currentId) {
          const remaining = res.data.filter((q) => String(q.tripId || q.id) !== currentId);
          if (remaining.length > 0) {
            setSelectedTripId(String(remaining[0].tripId || remaining[0].id));
          } else {
            setSelectedTripId(String(res.data[0].tripId || res.data[0].id));
          }
        } else {
          setSelectedTripId(String(res.data[0].tripId || res.data[0].id));
        }
      } else {
        setSelectedTripId(null);
        setTripDetail(null);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to refresh audit queue");
    }
  };

  // Actions
  const handleVerifyAndApprove = async () => {
    if (!selectedTripId) return;
    if (podDetail && podDetail.currentStatus === "ON_HOLD") {
      setError(`Cannot verify trip for billing: POD is currently ON_HOLD (${podDetail.holdReason}). Release hold first.`);
      return;
    }
    if (auditNotes.trim().length < 3) {
      setNotesError("Please enter at least 3 characters of audit notes.");
      return;
    }
    setNotesError(null);
    setActionLoading(true);
    setError(null);
    try {
      const version = Number((tripDetail as any)?.version ?? 0);
      await apiClient.post(`/trips/${selectedTripId}/audit`, {
        version,
        outcome: "AUDITED",
        notes: auditNotes.trim(),
        checklist: checklist,
      });
      setActionNotice(`Trip ${selectedTripId} verified and forwarded to Billing.`);
      setAuditNotes("");
      await refetchQueueAndSelectNext(selectedTripId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to verify trip");
    } finally {
      setActionLoading(false);
    }
  };

  // POD Control Actions (R1-TASK-5.1 & R1-TASK-5.2)
  const handleSubmit5PointChecklist = async () => {
    if (!podDetail) return;
    setActionLoading(true);
    setError(null);
    try {
      const updatedPod = await apiClient.post<Pod>(`/pods/control/${podDetail.id}/checklist`, {
        items: fivePointChecklist.map((c) => ({
          checkType: c.checkType,
          passed: c.passed,
          remarks: c.remarks || undefined,
        })),
      });
      setPodDetail(updatedPod);
      setActionNotice(
        updatedPod.currentStatus === "SOFT_COPY_CHECKED"
          ? "5-Point POD checklist approved! Status advanced to SOFT_COPY_CHECKED."
          : `POD placed on hold due to failed checklist items. Status: ${updatedPod.currentStatus}`
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to submit checklist");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePlaceOnHold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!podDetail) return;
    setActionLoading(true);
    setError(null);
    try {
      const updatedPod = await apiClient.post<Pod>(`/pods/control/${podDetail.id}/hold`, {
        holdReason,
        holdRemarks: holdRemarks.trim() || undefined,
      });
      setPodDetail(updatedPod);
      setIsHoldModalOpen(false);
      setActionNotice(`POD placed on hold (${holdReason}). Billing is blocked.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to place POD on hold");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReleaseHold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!podDetail) return;
    setActionLoading(true);
    setError(null);
    try {
      const updatedPod = await apiClient.post<Pod>(`/pods/control/${podDetail.id}/release-hold`, {
        releaseRemarks: releaseRemarks.trim() || "Hold released by auditor",
      });
      setPodDetail(updatedPod);
      setIsReleaseHoldModalOpen(false);
      setActionNotice("POD hold released. Restored to SOFT_COPY_RECEIVED.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to release POD hold");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDispatchCourier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!podDetail) return;
    setActionLoading(true);
    setError(null);
    try {
      const updatedPod = await apiClient.post<Pod>(`/pods/control/${podDetail.id}/dispatch-courier`, {
        courierName: courierName.trim(),
        courierTrackingNo: courierTrackingNo.trim(),
        courierDispatchedAt: courierDispatchedAt || new Date().toISOString(),
      });
      setPodDetail(updatedPod);
      setIsCourierModalOpen(false);
      setActionNotice(`Original POD dispatched via ${courierName} (AWB: ${courierTrackingNo}).`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to dispatch courier");
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkReceived = async () => {
    if (!podDetail) return;
    setActionLoading(true);
    setError(null);
    try {
      const updatedPod = await apiClient.post<Pod>(`/pods/control/${podDetail.id}/mark-received`, {});
      setPodDetail(updatedPod);
      setActionNotice("Original physical POD confirmed received in central office!");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to confirm POD receipt");
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkLost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!podDetail) return;
    setActionLoading(true);
    setError(null);
    try {
      const updatedPod = await apiClient.post<Pod>(`/pods/control/${podDetail.id}/mark-lost`, {
        lostDate: lostDate || new Date().toISOString(),
        reportedBy: reportedBy.trim() || "Auditor",
        incidentSummary: incidentSummary.trim(),
      });
      setPodDetail(updatedPod);
      setIsLostModalOpen(false);
      setActionNotice("Original POD marked as LOST. Incident reported.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to mark POD as lost");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestDuplicate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!podDetail) return;
    setActionLoading(true);
    setError(null);
    try {
      const updatedPod = await apiClient.post<Pod>(`/pods/control/${podDetail.id}/request-duplicate`, {
        requestReason: requestReason.trim(),
        remarks: duplicateRemarks.trim() || undefined,
      });
      setPodDetail(updatedPod);
      setIsDuplicateModalOpen(false);
      setActionNotice("Duplicate POD request submitted to customer.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to request duplicate POD");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitToClient = async () => {
    if (!podDetail) return;
    setActionLoading(true);
    setError(null);
    try {
      const updatedPod = await apiClient.post<Pod>(`/pods/control/${podDetail.id}/submit-to-client`, {});
      setPodDetail(updatedPod);
      setActionNotice("Original POD officially submitted to client.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to submit POD to client");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!podDetail) return;
    setActionLoading(true);
    setError(null);
    try {
      const updatedPod = await apiClient.post<Pod>(`/pods/control/${podDetail.id}/acknowledge`, {});
      setPodDetail(updatedPod);
      setActionNotice("Client delivery acknowledged for physical POD.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to record client acknowledgment");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDiscrepancy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTripId) return;
    if (discrepancyNotes.trim().length < 3) {
      setError("Please enter at least 3 characters of audit notes.");
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const version = Number((tripDetail as any)?.version ?? 0);
      await apiClient.post(`/trips/${selectedTripId}/audit`, {
        version,
        outcome: "CORRECTION_REQUESTED",
        notes: discrepancyNotes.trim(),
        checklist,
      });
      setIsDisputeModalOpen(false);
      setActionNotice(`Discrepancy logged for trip ${selectedTripId}. Flagged for review.`);
      await refetchQueueAndSelectNext(selectedTripId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to raise discrepancy");
    } finally {
      setActionLoading(false);
    }
  };

  // Document Controls
  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 2.5));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.75));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const handleResetDoc = () => {
    setZoomLevel(1);
    setRotation(0);
  };

  const toggleCheck = (key: keyof typeof checklist) => {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveSettings = () => {
    setSettingsNotice("Settings updated for this session.");
  };

  const handleResetSettings = () => {
    setAuditSettings(DEFAULT_AUDIT_SETTINGS);
    setSettingsNotice("Default settings restored.");
  };

  // Filter queue trips by search query
  const visibleQueueTrips = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return queue;
    return queue.filter((trip) => {
      const tripId = String(trip.tripId || trip.id || "");
      const tripNumber = String(trip.tripNumber || "");
      const client = String(trip.client || trip.clientName || "");
      const status = String(trip.status || "");
      return `${tripId} ${tripNumber} ${client} ${status}`.toLowerCase().includes(q);
    });
  }, [queue, searchQuery]);

  const flaggedTrips = useMemo(() => {
    return queue.filter((t) => {
      const s = String(t.status || "").toLowerCase();
      return s.includes("flag") || s.includes("dispute") || s.includes("correction");
    });
  }, [queue]);

  const selectedDispute = useMemo(() => {
    return (
      flaggedTrips.find((t) => String(t.tripId || t.id) === selectedTripId) ||
      flaggedTrips[0] ||
      null
    );
  }, [flaggedTrips, selectedTripId]);

  // Derived Values from tripDetail (Rule 10)
  const tripNumberDisplay = tripDetail?.tripNumber
    ? String(tripDetail.tripNumber)
    : tripDetail?.id
    ? String(tripDetail.id)
    : selectedTripId || "—";
  const vehicleRegDisplay = getDisplayName(
    tripDetail?.vehicle,
    tripDetail?.regNo ? String(tripDetail.regNo) : "—"
  );
  const driverNameDisplay = getDisplayName(
    tripDetail?.driver,
    tripDetail?.driverName ? String(tripDetail.driverName) : "—"
  );
  const driverPhoneDisplay = tripDetail?.driverPhone
    ? String(tripDetail.driverPhone)
    : tripDetail?.phone
    ? String(tripDetail.phone)
    : "—";
  const clientNameDisplay = getDisplayName(
    tripDetail?.client,
    tripDetail?.clientName ? String(tripDetail.clientName) : "—"
  );
  const originDisplay = tripDetail?.origin ? String(tripDetail.origin) : "—";
  const destinationDisplay = tripDetail?.destination ? String(tripDetail.destination) : "—";
  const departureDisplay = tripDetail?.startedAt
    ? formatDate(tripDetail.startedAt as any)
    : tripDetail?.departureTime
    ? formatDate(tripDetail.departureTime as any)
    : "—";
  const arrivalDisplay = tripDetail?.deliveredAt
    ? formatDate(tripDetail.deliveredAt as any)
    : tripDetail?.arrivalTime
    ? formatDate(tripDetail.arrivalTime as any)
    : tripDetail?.eta
    ? formatDate(tripDetail.eta as any)
    : "—";
  const invoiceNoDisplay = tripDetail?.invoiceNo
    ? String(tripDetail.invoiceNo)
    : tripDetail?.tripNumber
    ? `INV-${String(tripDetail.tripNumber)}`
    : "—";
  const signatoryNameDisplay = getDisplayName(
    tripDetail?.signatoryName,
    getDisplayName(tripDetail?.receiverName, "—")
  );

  // Odometer and Distances
  const startOdometer =
    tripDetail?.odometerStart != null
      ? tripDetail.odometerStart
      : tripDetail?.startOdometer != null
      ? tripDetail.startOdometer
      : null;
  const currentOdometer =
    tripDetail?.odometerEnd != null
      ? tripDetail.odometerEnd
      : tripDetail?.currentOdometer != null
      ? tripDetail.currentOdometer
      : tripDetail?.endOdometer != null
      ? tripDetail.endOdometer
      : null;
  const odometerDistance =
    startOdometer != null && currentOdometer != null
      ? Number(currentOdometer) - Number(startOdometer)
      : null;
  const gpsDistance =
    tripDetail?.systemGpsDistance != null
      ? Number(tripDetail.systemGpsDistance)
      : tripDetail?.distanceKm != null
      ? Number(tripDetail.distanceKm)
      : null;

  // Expenses & Cash
  const tollReported = getExpenseAmount(tripDetail, "toll");
  const fuelReported = getExpenseAmount(tripDetail, "fuel");
  const allowanceReported = getExpenseAmount(tripDetail, "allowance");

  const tripStops = Array.isArray(tripDetail?.tripStops)
    ? (tripDetail.tripStops as Array<Record<string, unknown>>)
    : [];
  const stopsExpectedCod = tripStops.reduce(
    (sum, stop) => sum + (Number(stop.expectedCollection) || 0),
    0
  );
  const stopsActualCod = tripStops.reduce(
    (sum, stop) => sum + (Number(stop.actualCollection) || Number(stop.collectedCash) || 0),
    0
  );

  const expectedCod =
    stopsExpectedCod > 0
      ? stopsExpectedCod
      : tripDetail?.expectedCollection != null
      ? Number(tripDetail.expectedCollection)
      : tripDetail?.expectedCod != null
      ? Number(tripDetail.expectedCod)
      : null;
  const collectedCod =
    stopsActualCod > 0
      ? stopsActualCod
      : tripDetail?.actualCash != null
      ? Number(tripDetail.actualCash)
      : (tripDetail?.eodTally as any)?.actualCash != null
      ? Number((tripDetail?.eodTally as any).actualCash)
      : tripDetail?.collectedCash != null
      ? Number(tripDetail.collectedCash)
      : tripDetail?.reportedCod != null
      ? Number(tripDetail.reportedCod)
      : null;

  const cashDeficit =
    expectedCod != null && collectedCod != null ? collectedCod - expectedCod : null;

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-800 font-sans antialiased overflow-hidden">
      {/* 1. LEFT SIDEBAR */}
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
                AUDIT & SETTLEMENT
              </span>
            </div>
          </div>
        </div>

        {/* Role Identity Tag */}
        <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 rounded-full bg-indigo-500 ring-2 ring-indigo-100" />
              <span className="text-xs font-medium text-slate-700">
                Internal Audit Workspace
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-600">AUD-L2</span>
          </div>
          <p className="text-[11px] text-slate-600 mt-1 truncate">
            POD Settlement & Variance Desk
          </p>
        </div>

        {/* Navigation Menu */}
        <nav className="px-3 py-4 space-y-1">
          {[
            { name: "Audit Queue", icon: FileCheck2, badge: queue.length > 0 ? String(queue.length) : null },
            { name: "Dispute Resolutions", icon: AlertOctagon, badge: flaggedTrips.length > 0 ? String(flaggedTrips.length) : null },
            { name: "Archived Trips", icon: Archive, badge: null },
            { name: "Settings", icon: Settings, badge: null },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeMenu === item.name;
            return (
              <button
                key={item.name}
                onClick={() => {
                  setActiveMenu(item.name);
                  if (item.name === "Dispute Resolutions" && flaggedTrips[0]) {
                    setSelectedTripId(String(flaggedTrips[0].tripId || flaggedTrips[0].id));
                  }
                }}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${isActive ? "text-white" : "text-slate-500"}`}
                />
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

        {/* Queue Selector Quick Strip */}
        <div className="px-3 py-2 border-t border-slate-200">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 px-1 mb-1.5 block">
            Active Review Queue
          </span>
          <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
            {loading ? (
              <div className="space-y-1.5 p-1">
                <div className="h-10 rounded-md bg-slate-100 animate-pulse" />
                <div className="h-10 rounded-md bg-slate-100 animate-pulse" />
                <div className="h-10 rounded-md bg-slate-100 animate-pulse" />
              </div>
            ) : queue.length === 0 ? (
              <p className="px-2 py-4 text-center text-[11px] text-slate-500">
                No trips pending audit.
              </p>
            ) : (
              visibleQueueTrips.map((tripItem) => {
                const tripIdStr = String(tripItem.tripId || tripItem.id || "");
                const isSelected = selectedTripId === tripIdStr;
                const statusStr = String(tripItem.status || "PENDING");
                return (
                  <button
                    key={tripIdStr}
                    onClick={() => setSelectedTripId(tripIdStr)}
                    className={`w-full text-left p-2 rounded-md border text-xs transition-all ${
                      isSelected
                        ? "bg-slate-100 border-slate-400 font-semibold text-slate-900"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-bold text-slate-800">
                        {String(tripItem.tripNumber || tripIdStr)}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1 py-0 uppercase ${
                          statusStr.toLowerCase().includes("flag") ||
                          statusStr.toLowerCase().includes("dispute")
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {statusStr}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                      {getDisplayName(tripItem.client, String(tripItem.clientName || "Consignee Client"))}
                    </div>
                  </button>
                );
              })
            )}
            {!loading && queue.length > 0 && visibleQueueTrips.length === 0 && (
              <p className="px-2 py-4 text-center text-[11px] text-slate-500">
                No trips match your search.
              </p>
            )}
          </div>
        </div>

        {/* Role Navigation Links */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/50 mt-auto">
          <div className="space-y-1.5">
            <Link
              href="/dispatch"
              className="flex items-center justify-between text-xs text-slate-600 hover:text-slate-900 p-1.5 rounded hover:bg-slate-100 transition-colors"
            >
              <span className="flex items-center gap-1.5 font-medium">
                <LayoutDashboard className="h-3.5 w-3.5 text-slate-500" />
                Dispatch Dashboard
              </span>
              <ExternalLink className="h-3 w-3 text-slate-400" />
            </Link>
            <Link
              href="/accounts"
              className="flex items-center justify-between text-xs text-slate-600 hover:text-slate-900 p-1.5 rounded hover:bg-slate-100 transition-colors"
            >
              <span className="flex items-center gap-1.5 font-medium">
                <Receipt className="h-3.5 w-3.5 text-emerald-600" />
                Accounts & Billing
              </span>
              <ExternalLink className="h-3 w-3 text-slate-400" />
            </Link>
            <Link
              href="/driver"
              className="flex items-center justify-between text-xs text-slate-600 hover:text-slate-900 p-1.5 rounded hover:bg-slate-100 transition-colors"
            >
              <span className="flex items-center gap-1.5 font-medium">
                <Smartphone className="h-3.5 w-3.5 text-blue-600" />
                Driver Mobile App
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
              placeholder="Search Trip ID, Invoice, Driver, Client..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs bg-slate-50/50 border-slate-200 focus-visible:bg-white"
            />
          </div>

          {/* Metric Pill & Review Quick Status */}
          <div className="flex items-center space-x-3">
            <Badge
              variant="outline"
              className="bg-slate-50 border-slate-200 text-slate-700 font-mono text-xs px-2.5 py-1 flex items-center gap-1.5"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span className="font-semibold text-slate-900">{queue.length} Pending Audits</span>
              <span className="text-slate-300">|</span>
              <span className="text-red-600 font-semibold">{flaggedTrips.length} Flagged</span>
            </Badge>

            <span className="text-xs text-slate-500 font-mono">
              Audit SLA: Under 2h
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

        {/* Error State Banner */}
        {error && (
          <div className="mx-6 mt-3 p-3 bg-red-50 border-2 border-red-300 rounded-lg text-red-900 text-xs font-semibold flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-700 hover:text-red-900 text-xs font-bold underline ml-3"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Action Success Notification */}
        {actionNotice && (
          <div className="mx-6 mt-3 p-3 bg-emerald-50 border-2 border-emerald-300 rounded-lg text-emerald-900 text-xs font-semibold flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
              <span>{actionNotice}</span>
            </div>
            <button
              onClick={() => setActionNotice(null)}
              className="text-emerald-700 hover:text-emerald-900 text-xs font-bold underline ml-3"
            >
              Dismiss
            </button>
          </div>
        )}

        {activeMenu === "Settings" ? (
          <div className="flex-1 overflow-y-auto bg-slate-50 p-5 sm:p-7">
            <div className="mx-auto max-w-5xl space-y-5">
              <div>
                <div className="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-[0.16em] text-slate-500">
                  <Settings className="h-3.5 w-3.5" /> AUDIT CONFIGURATION
                </div>
                <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
                <p className="mt-1 text-xs text-slate-600">
                  Configure review thresholds and evidence requirements for audit governance.
                </p>
              </div>

              <Card className="border-slate-200 bg-white shadow-none">
                <CardHeader className="border-b border-slate-200 p-4">
                  <CardTitle className="text-sm font-bold text-slate-900">Review policy</CardTitle>
                  <CardDescription className="mt-1 text-[11px]">
                    Set the audit response window and COD variance limit.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
                  <label className="grid gap-2 text-xs font-semibold text-slate-700" htmlFor="audit-sla">
                    Audit SLA (hours)
                    <input
                      id="audit-sla"
                      type="number"
                      min={1}
                      max={24}
                      value={auditSettings.auditSlaHours}
                      onChange={(event) =>
                        setAuditSettings((current) => ({
                          ...current,
                          auditSlaHours: Math.min(24, Math.max(1, Number(event.target.value) || 1)),
                        }))
                      }
                      className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-xs font-normal text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </label>
                  <label className="grid gap-2 text-xs font-semibold text-slate-700" htmlFor="cash-threshold">
                    COD variance threshold (₹)
                    <input
                      id="cash-threshold"
                      type="number"
                      min={0}
                      step={100}
                      value={auditSettings.cashVarianceThreshold}
                      onChange={(event) =>
                        setAuditSettings((current) => ({
                          ...current,
                          cashVarianceThreshold: Math.max(0, Number(event.target.value) || 0),
                        }))
                      }
                      className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-xs font-normal text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </label>
                </CardContent>
              </Card>

              <Card className="border-slate-200 bg-white shadow-none">
                <CardHeader className="border-b border-slate-200 p-4">
                  <CardTitle className="text-sm font-bold text-slate-900">Evidence &amp; notifications</CardTitle>
                  <CardDescription className="mt-1 text-[11px]">Choose which checks and stakeholder updates are enabled.</CardDescription>
                </CardHeader>
                <CardContent className="divide-y divide-slate-200 px-4">
                  {AUDIT_TOGGLE_SETTINGS.map((setting) => (
                    <label key={setting.key} className="flex cursor-pointer items-center justify-between gap-4 py-3">
                      <span>
                        <span className="block text-xs font-semibold text-slate-800">{setting.label}</span>
                        <span className="mt-1 block text-[10px] text-slate-500">{setting.description}</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={auditSettings[setting.key]}
                        onChange={(event) =>
                          setAuditSettings((current) => ({ ...current, [setting.key]: event.target.checked }))
                        }
                        className="h-4 w-4 shrink-0 accent-blue-600"
                      />
                    </label>
                  ))}
                </CardContent>
              </Card>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="m-0 text-[10px] text-slate-500" role="status" aria-live="polite">
                  {settingsNotice ?? "Changes are saved only for this active browser session."}
                </p>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" onClick={handleResetSettings} className="border-slate-300 text-slate-700">
                    <RefreshCw className="mr-2 h-3.5 w-3.5" /> Reset defaults
                  </Button>
                  <Button type="button" onClick={handleSaveSettings} className="bg-slate-900 text-white hover:bg-slate-800">
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Save settings
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : activeMenu === "Dispute Resolutions" ? (
          <div className="flex-1 overflow-y-auto bg-slate-50 p-5 sm:p-7">
            <div className="mx-auto max-w-6xl space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-[0.16em] text-red-600">
                    <AlertOctagon className="h-3.5 w-3.5" /> VARIANCE MANAGEMENT
                  </div>
                  <h1 className="text-2xl font-bold text-slate-900">Dispute Resolutions</h1>
                  <p className="mt-1 text-xs text-slate-600">Review flagged trips, compare reported values, and inspect evidence.</p>
                </div>
                <Badge variant="outline" className="flex items-center gap-1.5 border-red-200 bg-red-50 text-red-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  {flaggedTrips.length} open {flaggedTrips.length === 1 ? "dispute" : "disputes"}
                </Badge>
              </div>

              <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
                <Card className="border-slate-200 bg-white shadow-none">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-slate-200 p-4">
                    <div>
                      <CardTitle className="text-sm font-bold text-slate-900">Open disputes</CardTitle>
                      <CardDescription className="mt-1 text-[11px]">Flagged trips requiring settlement review</CardDescription>
                    </div>
                    <AlertOctagon className="h-4 w-4 text-red-500" />
                  </CardHeader>
                  <CardContent className="space-y-2 p-3">
                    {flaggedTrips.map((trip) => {
                      const tripIdStr = String(trip.tripId || trip.id || "");
                      const isSelected = selectedDispute && String(selectedDispute.tripId || selectedDispute.id) === tripIdStr;
                      return (
                        <button
                          key={tripIdStr}
                          type="button"
                          onClick={() => setSelectedTripId(tripIdStr)}
                          aria-pressed={isSelected}
                          className={`w-full rounded-lg border p-3 text-left transition-colors ${
                            isSelected ? "border-blue-300 bg-blue-50/60" : "border-slate-200 bg-white hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-mono text-xs font-bold text-slate-900">
                              {String(trip.tripNumber || tripIdStr)}
                            </span>
                            <Badge variant="outline" className="border-red-200 bg-red-50 text-[9px] text-red-700">Flagged</Badge>
                          </div>
                          <div className="mt-2 text-xs font-semibold text-slate-800">
                            {getDisplayName(trip.client, String(trip.clientName || "Consignee Client"))}
                          </div>
                          <div className="mt-1 text-[10px] text-slate-500">
                            Status: {String(trip.status || "Flagged")}
                          </div>
                        </button>
                      );
                    })}
                    {flaggedTrips.length === 0 && (
                      <div className="px-4 py-10 text-center text-xs text-slate-500">No disputes in queue.</div>
                    )}
                  </CardContent>
                </Card>

                {selectedDispute ? (
                  <Card className="border-slate-200 bg-white shadow-none">
                    <CardHeader className="border-b border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Selected case</CardDescription>
                          <CardTitle className="mt-1 text-base font-bold text-slate-900">
                            {String(selectedDispute.tripNumber || selectedDispute.tripId || selectedDispute.id)}
                          </CardTitle>
                        </div>
                        <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">Requires resolution</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 p-4">
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div><span className="block text-[10px] text-slate-500">Client</span><span className="mt-1 block font-semibold text-slate-800">{getDisplayName(selectedDispute.client)}</span></div>
                        <div><span className="block text-[10px] text-slate-500">Status</span><span className="mt-1 block font-mono font-semibold text-slate-800">{String(selectedDispute.status || "—")}</span></div>
                      </div>
                      <div className="flex items-start gap-2 text-[11px] text-slate-600">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" />
                        <span>
                          {String(selectedDispute.origin || "Origin")} <ArrowRight className="mx-1 inline h-3 w-3" /> {String(selectedDispute.destination || "Destination")}
                        </span>
                      </div>
                      <Button type="button" onClick={() => setActiveMenu("Audit Queue")} className="w-full bg-slate-900 text-white hover:bg-slate-800">
                        <Eye className="mr-2 h-4 w-4" /> Review evidence
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-slate-200 bg-white shadow-none">
                    <CardContent className="p-10 text-center text-xs text-slate-500">No open disputes are available.</CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        ) : activeMenu === "Archived Trips" ? (
          <div className="flex-1 overflow-y-auto bg-slate-50 p-5 sm:p-7">
            <div className="mx-auto max-w-6xl space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-[0.16em] text-slate-500">
                    <Archive className="h-3.5 w-3.5" /> AUDIT HISTORY
                  </div>
                  <h1 className="text-2xl font-bold text-slate-900">Archived Trips &amp; Resolutions</h1>
                  <p className="mt-1 text-xs text-slate-600">Completed audit cases and their settlement outcomes.</p>
                </div>
              </div>

              <Card className="overflow-hidden border-slate-200 bg-white shadow-none">
                <CardHeader className="border-b border-slate-200 p-4">
                  <CardTitle className="text-sm font-bold text-slate-900">Resolution history</CardTitle>
                  <CardDescription className="mt-1 text-[11px]">Trips cleared through audit</CardDescription>
                </CardHeader>
                <CardContent className="p-12 text-center text-xs text-slate-500">
                  No archived audit records found.
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          /* 3. MAIN CONTENT: SPLIT-PANE DOCUMENT REVIEW LAYOUT (50/50) */
          <div className="flex-1 grid grid-cols-12 overflow-hidden">
            {/* ========================================================================= */}
            {/* LEFT PANE: VISUAL PROOF (THE DOCUMENT VIEWER) - 6 Cols (50%) */}
            {/* ========================================================================= */}
            <section className="col-span-6 border-r border-slate-200 bg-slate-100 flex flex-col h-full overflow-hidden">
              {/* Document Viewer Toolbar */}
              <div className="h-11 px-4 border-b border-slate-200 bg-white flex items-center justify-between flex-shrink-0">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5 text-slate-600" />
                    Proof of Delivery: <span className="font-mono text-blue-700">{tripNumberDisplay}</span>
                  </span>
                  <span className="text-[11px] text-slate-600 font-mono">
                    ({Math.round(zoomLevel * 100)}% • {rotation}°)
                  </span>
                </div>

                {/* Document Controls */}
                <div className="flex items-center space-x-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleZoomIn}
                    className="h-7 w-7 p-0 border-slate-200 text-slate-700 hover:bg-slate-100"
                    title="Zoom In"
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleZoomOut}
                    className="h-7 w-7 p-0 border-slate-200 text-slate-700 hover:bg-slate-100"
                    title="Zoom Out"
                    disabled={zoomLevel <= 0.75}
                  >
                    <ZoomOut className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRotate}
                    className="h-7 w-7 p-0 border-slate-200 text-slate-700 hover:bg-slate-100"
                    title="Rotate 90°"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetDoc}
                    className="h-7 px-2 text-[10px] font-mono border-slate-200 text-slate-700 hover:bg-slate-100"
                    title="Reset View"
                  >
                    Reset
                  </Button>
                </div>
              </div>

              {/* Document Canvas Area */}
              <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-200/70">
                {loading || tripDetailLoading ? (
                  /* Loading State (Rule 4: skeleton in the left pane) */
                  <div className="w-[430px] bg-white rounded-md shadow-md border border-slate-300 p-6 space-y-4 animate-pulse">
                    <div className="h-6 bg-slate-200 rounded w-3/4 mb-3" />
                    <div className="h-16 bg-slate-100 rounded border border-slate-200" />
                    <div className="grid grid-cols-3 gap-2">
                      <div className="h-12 bg-slate-100 rounded" />
                      <div className="h-12 bg-slate-100 rounded" />
                      <div className="h-12 bg-slate-100 rounded" />
                    </div>
                    <div className="h-24 bg-slate-100 rounded" />
                    <div className="h-14 bg-slate-100 rounded border border-dashed border-slate-300" />
                    <div className="h-8 bg-slate-200 rounded w-1/2" />
                  </div>
                ) : queue.length === 0 ? (
                  /* Empty State (Rule 5: No trips pending audit) */
                  <div className="text-center p-8 bg-white rounded-lg border border-slate-300 shadow-sm max-w-sm">
                    <FileCheck2 className="h-10 w-10 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-800">No trips pending audit.</p>
                    <p className="text-xs text-slate-500 mt-1">There are no operational deliveries awaiting verification.</p>
                  </div>
                ) : podDocUrl ? (
                  <div
                    style={{
                      transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                      transition: "transform 0.15s ease-out",
                      transformOrigin: "center center",
                    }}
                    className="max-w-[480px] bg-white rounded-md shadow-md border border-slate-300 p-2 overflow-hidden flex flex-col items-center justify-center"
                  >
                    <img src={podDocUrl} alt="Soft Copy POD Document" className="max-w-full max-h-[580px] object-contain rounded" />
                    <div className="mt-2 text-center text-[10px] font-mono text-slate-500">
                      Uploaded Soft Copy POD • {tripNumberDisplay}
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                      transition: "transform 0.15s ease-out",
                      transformOrigin: "center center",
                    }}
                    className="w-[430px] bg-white rounded-md shadow-md border border-slate-300 p-6 text-slate-800 text-[11px] select-none"
                  >
                    {/* Consignment Note / Lorry Receipt Header */}
                    <div className="border-b-2 border-slate-900 pb-3 mb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-black text-sm text-slate-900 tracking-wider">
                            VECTO 3PL CARRIERS LTD.
                          </h4>
                          <p className="text-[9px] text-slate-500 uppercase font-mono">
                            Consignment Note / Lorry Receipt (Consignee Copy)
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-xs block text-slate-900">
                            {tripNumberDisplay}
                          </span>
                          <span className="text-[9px] text-slate-500 font-mono">
                            Date: {departureDisplay !== "—" ? departureDisplay : "Active"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* LR Grid Data */}
                    <div className="grid grid-cols-2 gap-2 border border-slate-300 p-2.5 rounded bg-slate-50/50 mb-3">
                      <div>
                        <span className="text-[9px] text-slate-600 block uppercase font-bold">
                          Consignor (Sender)
                        </span>
                        <span className="font-bold text-slate-800 block truncate">
                          {originDisplay}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-600 block uppercase font-bold">
                          Consignee (Receiver)
                        </span>
                        <span className="font-bold text-slate-800 block truncate">
                          {clientNameDisplay}
                        </span>
                        <span className="text-[10px] text-slate-600 block truncate">
                          {destinationDisplay}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 border border-slate-300 p-2 rounded bg-slate-50/50 text-[10px] font-mono mb-3">
                      <div>
                        <span className="text-[9px] text-slate-600 block uppercase font-bold">
                          Truck No
                        </span>
                        <span className="font-bold text-slate-900">{vehicleRegDisplay}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-600 block uppercase font-bold">
                          Invoice No
                        </span>
                        <span className="font-bold text-slate-900">{invoiceNoDisplay}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-600 block uppercase font-bold">
                          COD Value
                        </span>
                        <span className="font-bold text-slate-900">
                          {expectedCod != null ? formatRupees(expectedCod) : "—"}
                        </span>
                      </div>
                    </div>

                    {/* Material Table Preview */}
                    <table className="w-full text-[10px] border border-slate-300 mb-3 text-left">
                      <thead className="bg-slate-100 border-b border-slate-300 font-semibold">
                        <tr>
                          <th className="p-1">Item / Pkg</th>
                          <th className="p-1 text-right">Destination</th>
                          <th className="p-1 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-200">
                          <td className="p-1">Commercial Consignment</td>
                          <td className="p-1 text-right font-mono truncate max-w-[120px]">
                            {destinationDisplay}
                          </td>
                          <td className="p-1 text-right font-mono">
                            {tripDetail?.status ? String(tripDetail.status) : "DELIVERED"}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Warehouse Received Stamp Proof */}
                    <div className="border-2 border-dashed border-blue-600 bg-blue-50/40 p-2 rounded flex items-center justify-between mb-3">
                      <div>
                        <span className="text-[9px] font-black uppercase text-blue-900 block tracking-wider">
                          ★ RECEIVED IN GOOD ORDER &amp; CONDITION ★
                        </span>
                        <span className="text-[10px] text-blue-800 font-medium block">
                          {clientNameDisplay} - Gate Inward
                        </span>
                        <span className="text-[9px] font-mono text-blue-700">
                          Verified at dock arrival
                        </span>
                      </div>
                      <div className="h-10 w-10 border-2 border-blue-700 rounded-full flex items-center justify-center text-blue-700 font-black text-[9px] rotate-[-12deg]">
                        STAMP
                      </div>
                    </div>

                    {/* Receiver Signature & Date */}
                    <div className="border-t border-slate-300 pt-2 flex items-center justify-between">
                      <div>
                        <span className="text-[9px] text-slate-600 block uppercase font-bold">
                          Receiver Signatory
                        </span>
                        <span className="font-bold text-slate-900 block">
                          {signatoryNameDisplay}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-slate-600 block uppercase font-bold">
                          Driver Acknowledgement
                        </span>
                        <span className="font-bold text-slate-800 font-mono text-[10px]">
                          {driverNameDisplay}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Sub-panel: Sign-on-Glass Digital Signature Block */}
              <div className="h-28 border-t border-slate-200 bg-white p-3 flex items-center justify-between flex-shrink-0">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-900 block flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    Sign-on-Glass Digital Signature Proof
                  </span>
                  <p className="text-[11px] text-slate-600 font-mono">
                    Signatory: {signatoryNameDisplay}
                  </p>
                  <div className="text-[10px] text-slate-600 font-mono">
                    Captured on Driver Mobile Device • Verified at dock
                  </div>
                </div>

                {/* Digital Signature Verification Box */}
                <div className="w-56 h-18 border-2 border-slate-300 rounded-md bg-slate-50 flex flex-col items-center justify-center p-2 relative">
                  <div className="font-serif italic font-bold text-base text-slate-800 tracking-wide rotate-[-3deg]">
                    {signatoryNameDisplay !== "—" ? signatoryNameDisplay : "Verified Sign"}
                  </div>
                  <div className="text-[9px] text-slate-600 font-mono mt-0.5">
                    Dock Verified
                  </div>
                </div>
              </div>
            </section>

            {/* ========================================================================= */}
            {/* RIGHT PANE: SYSTEM DATA & VERIFICATION - 6 Cols (50%) */}
            {/* ========================================================================= */}
            <section className="col-span-6 bg-white flex flex-col h-full overflow-hidden">
              {/* Scrollable Content Body */}
              <ScrollArea className="flex-1 p-5 space-y-5">
                {/* 1. Trip Details Card */}
                <Card className="shadow-none border-slate-200 bg-white mb-5">
                  <CardHeader className="p-3.5 border-b border-slate-200 flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center space-x-2">
                      <CardTitle className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                        Trip &amp; Dispatch Telematics
                      </CardTitle>
                      <Badge variant="outline" className="font-mono text-[10px] font-bold">
                        {tripNumberDisplay}
                      </Badge>
                    </div>
                    <Badge
                      variant="outline"
                      className="font-mono text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border-amber-300"
                    >
                      {tripDetail?.status ? String(tripDetail.status) : "PENDING AUDIT"}
                    </Badge>
                  </CardHeader>

                  <CardContent className="p-3.5 space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[11px] text-slate-600 block">Driver &amp; Vehicle:</span>
                        <span className="font-bold text-slate-900 block">{driverNameDisplay}</span>
                        <span className="text-[11px] font-mono text-slate-600">
                          {vehicleRegDisplay}
                          {driverPhoneDisplay && driverPhoneDisplay !== "—" ? ` (${driverPhoneDisplay})` : ""}
                        </span>
                      </div>

                      <div>
                        <span className="text-[11px] text-slate-600 block">Consignee Client:</span>
                        <span className="font-bold text-slate-900 block truncate">
                          {clientNameDisplay}
                        </span>
                        <span className="text-[11px] font-mono text-slate-600">
                          {invoiceNoDisplay}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-100">
                      <div>
                        <span className="text-[11px] text-slate-600 block">Departure:</span>
                        <span className="font-mono text-slate-800 text-[11px] font-medium">
                          {departureDisplay}
                        </span>
                        <span className="text-[10px] text-slate-600 block truncate">
                          {originDisplay}
                        </span>
                      </div>

                      <div>
                        <span className="text-[11px] text-slate-600 block">Arrival / Unloaded:</span>
                        <span className="font-mono text-slate-800 text-[11px] font-medium">
                          {arrivalDisplay}
                        </span>
                        <span className="text-[10px] text-slate-600 block truncate">
                          {destinationDisplay}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-100">
                      <div className="p-2 bg-slate-50 rounded border border-slate-200">
                        <span className="text-[10px] text-slate-600 uppercase font-bold block">
                          Start Odometer
                        </span>
                        <span className="text-sm font-black font-mono text-slate-900">
                          {startOdometer != null ? `${formatNumber(startOdometer as any)} km` : "—"}
                        </span>
                      </div>

                      <div className="p-2 bg-slate-50 rounded border border-slate-200">
                        <span className="text-[10px] text-slate-600 uppercase font-bold block">
                          End / Current Odometer
                        </span>
                        <span className="text-sm font-black font-mono text-slate-900">
                          {currentOdometer != null ? `${formatNumber(currentOdometer as any)} km` : "—"}
                        </span>
                        {odometerDistance != null && (
                          <span className="text-[10px] text-emerald-600 font-mono font-medium ml-1">
                            (Distance: {formatNumber(odometerDistance)} km)
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 2. Financial / Expense Tally Section */}
                <Card className="shadow-none border-slate-200 bg-white mb-5">
                  <CardHeader className="p-3.5 border-b border-slate-200 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                      Financial Tally: Reported vs System Expected
                    </CardTitle>
                    <span className="text-[11px] font-mono text-slate-600">Currency: INR (₹)</span>
                  </CardHeader>

                  <CardContent className="p-0">
                    <Table>
                      <TableHeader className="bg-slate-50/75 text-[11px]">
                        <TableRow className="border-b border-slate-200">
                          <TableHead className="py-2 text-slate-600 font-semibold">Line Item</TableHead>
                          <TableHead className="py-2 text-right text-slate-600 font-semibold">
                            Driver Reported
                          </TableHead>
                          <TableHead className="py-2 text-right text-slate-600 font-semibold">
                            System Policy / Expected
                          </TableHead>
                          <TableHead className="py-2 text-right text-slate-600 font-semibold">
                            Variance
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="text-xs font-mono">
                        {Array.isArray(tripDetail?.tripExpenses) && (tripDetail.tripExpenses as any[]).length > 0 ? (
                          (tripDetail.tripExpenses as any[]).map((exp, idx) => {
                            const typeName = String(exp.type || "Expense")
                              .replace(/_/g, " ")
                              .toLowerCase()
                              .replace(/\b\w/g, (c) => c.toUpperCase());
                            const amt = Number(exp.amount) || 0;
                            return (
                              <TableRow key={exp.id || idx} className="border-b border-slate-100">
                                <TableCell className="py-2 font-sans text-slate-800">{typeName}</TableCell>
                                <TableCell className="py-2 text-right">{formatRupees(amt)}</TableCell>
                                <TableCell className="py-2 text-right text-slate-600">{formatRupees(amt)}</TableCell>
                                <TableCell className="py-2 text-right text-emerald-600 font-medium">₹0</TableCell>
                              </TableRow>
                            );
                          })
                        ) : (
                          <>
                            <TableRow className="border-b border-slate-100">
                              <TableCell className="py-2 font-sans text-slate-800">Toll Expenses</TableCell>
                              <TableCell className="py-2 text-right">
                                {tollReported != null ? formatRupees(tollReported) : "—"}
                              </TableCell>
                              <TableCell className="py-2 text-right text-slate-600">
                                {tollReported != null ? formatRupees(tollReported) : "—"}
                              </TableCell>
                              <TableCell className="py-2 text-right text-emerald-600 font-medium">
                                ₹0
                              </TableCell>
                            </TableRow>

                            <TableRow className="border-b border-slate-100">
                              <TableCell className="py-2 font-sans text-slate-800">Fuel &amp; AdBlue</TableCell>
                              <TableCell className="py-2 text-right">
                                {fuelReported != null ? formatRupees(fuelReported) : "—"}
                              </TableCell>
                              <TableCell className="py-2 text-right text-slate-600">
                                {fuelReported != null ? formatRupees(fuelReported) : "—"}
                              </TableCell>
                              <TableCell className="py-2 text-right text-emerald-600 font-medium">
                                ₹0
                              </TableCell>
                            </TableRow>

                            <TableRow className="border-b border-slate-100">
                              <TableCell className="py-2 font-sans text-slate-800">Driver Allowance</TableCell>
                              <TableCell className="py-2 text-right">
                                {allowanceReported != null ? formatRupees(allowanceReported) : "—"}
                              </TableCell>
                              <TableCell className="py-2 text-right text-slate-600">
                                {allowanceReported != null ? formatRupees(allowanceReported) : "—"}
                              </TableCell>
                              <TableCell className="py-2 text-right text-slate-600">
                                ₹0
                              </TableCell>
                            </TableRow>
                          </>
                        )}

                        {/* COD / Cash Received Line */}
                        <TableRow className="border-b border-slate-200 bg-slate-50/50 font-bold">
                          <TableCell className="py-2.5 font-sans text-slate-900">
                            Total COD Cash Remitted
                          </TableCell>
                          <TableCell className="py-2.5 text-right text-slate-900">
                            {collectedCod != null ? formatRupees(collectedCod) : "—"}
                          </TableCell>
                          <TableCell className="py-2.5 text-right text-slate-700">
                            {expectedCod != null ? formatRupees(expectedCod) : "—"}
                          </TableCell>
                          <TableCell
                            className={`py-2.5 text-right font-black ${
                              cashDeficit === null
                                ? "text-slate-600"
                                : cashDeficit === 0
                                ? "text-emerald-600"
                                : "text-red-600"
                            }`}
                          >
                            {cashDeficit === null
                              ? "—"
                              : cashDeficit === 0
                              ? "Balanced"
                              : `Deficit: -${formatRupees(Math.abs(cashDeficit))}`}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* R1 POD Control Engine Section */}
                <Card className="shadow-none border-slate-200 bg-white mb-5">
                  <CardHeader className="p-3.5 border-b border-slate-200 flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center space-x-2">
                      <PackageCheck className="h-4 w-4 text-royal" />
                      <CardTitle className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                        POD Control & Verification
                      </CardTitle>
                    </div>
                    <Badge
                      variant="outline"
                      className={`font-mono text-[10px] font-bold uppercase ${
                        podDetail?.currentStatus === "SOFT_COPY_CHECKED"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                          : podDetail?.currentStatus === "ON_HOLD"
                          ? "bg-red-50 text-red-700 border-red-300"
                          : podDetail?.currentStatus === "LOST"
                          ? "bg-red-100 text-red-800 border-red-400"
                          : podDetail?.currentStatus === "ORIGINAL_RECEIVED" || podDetail?.currentStatus === "ACKNOWLEDGED"
                          ? "bg-teal-50 text-teal-700 border-teal-300"
                          : "bg-blue-50 text-blue-700 border-blue-300"
                      }`}
                    >
                      {podDetail?.currentStatus ?? "PENDING_DELIVERY"}
                    </Badge>
                  </CardHeader>

                  <CardContent className="p-3.5 space-y-3">
                    {/* On-Hold Alert Banner */}
                    {podDetail?.currentStatus === "ON_HOLD" && (
                      <div className="rounded-lg border border-red-300 bg-red-50 p-3 flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-1.5 text-xs font-bold text-red-900">
                            <AlertTriangle className="h-4 w-4 text-red-600" /> ON HOLD: {podDetail.holdReason}
                          </div>
                          <p className="mt-1 text-[11px] text-red-700">{podDetail.holdRemarks ?? "Discrepancy detected during verification"}</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => setIsReleaseHoldModalOpen(true)}
                          className="bg-red-700 text-white hover:bg-red-800 text-xs font-semibold h-7"
                        >
                          Release Hold
                        </Button>
                      </div>
                    )}

                    {/* 5-Point Mandatory Verification Checklist */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                          Mandatory 5-Point POD Checklist
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">Governs Billing Clearance</span>
                      </div>

                      {fivePointChecklist.map((item, idx) => (
                        <div key={item.checkType} className="rounded-lg border border-slate-200 bg-slate-50/50 p-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-800">{item.label}</span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setFivePointChecklist((prev) =>
                                  prev.map((c, i) => (i === idx ? { ...c, passed: !c.passed } : c))
                                );
                              }}
                              className={`h-6 text-[10px] px-2 font-bold ${
                                item.passed
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                  : "bg-red-50 text-red-700 border-red-300"
                              }`}
                            >
                              {item.passed ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                              {item.passed ? "PASSED" : "FAILED"}
                            </Button>
                          </div>
                          <input
                            type="text"
                            placeholder="Add remarks / variance details (optional)"
                            value={item.remarks}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFivePointChecklist((prev) =>
                                prev.map((c, i) => (i === idx ? { ...c, remarks: val } : c))
                              );
                            }}
                            className="mt-1.5 w-full rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 placeholder:text-slate-400"
                          />
                        </div>
                      ))}

                      <div className="flex items-center gap-2 pt-2">
                        <Button
                          type="button"
                          disabled={!podDetail || actionLoading}
                          onClick={handleSubmit5PointChecklist}
                          className="flex-1 bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold h-8"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-400" />
                          Submit Checklist Verification
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={!podDetail || actionLoading}
                          onClick={() => setIsHoldModalOpen(true)}
                          className="border-red-300 text-red-700 hover:bg-red-50 text-xs font-bold h-8"
                        >
                          <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                          Place on Hold
                        </Button>
                      </div>
                    </div>

                    {/* Physical Original Tracking Sub-section */}
                    <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2 mt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                          Original Paper POD Courier & Logistics
                        </span>
                        {podDetail?.events && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsEventsModalOpen(true)}
                            className="h-6 text-[10px] text-slate-600 hover:text-slate-900"
                          >
                            <History className="h-3 w-3 mr-1" /> Audit Trail ({podDetail.events.length})
                          </Button>
                        )}
                      </div>

                      {podDetail?.courierName && (
                        <div className="rounded bg-slate-50 p-2 text-xs font-mono text-slate-700 space-y-0.5 border border-slate-200">
                          <div>Courier Service: <strong>{podDetail.courierName}</strong></div>
                          <div>AWB Tracking No: <strong>{podDetail.courierTrackingNo ?? "—"}</strong></div>
                          {podDetail.courierDispatchedAt && <div>Dispatched: {formatDate(podDetail.courierDispatchedAt as any)}</div>}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 pt-1">
                        {podDetail?.currentStatus === "SOFT_COPY_CHECKED" && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => setIsCourierModalOpen(true)}
                            className="bg-blue-600 text-white hover:bg-blue-700 text-xs h-7"
                          >
                            <Send className="h-3 w-3 mr-1" /> Dispatch Courier
                          </Button>
                        )}
                        {podDetail?.currentStatus === "ORIGINAL_DISPATCHED" && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleMarkReceived}
                            disabled={actionLoading}
                            className="bg-emerald-600 text-white hover:bg-emerald-700 text-xs h-7"
                          >
                            <Inbox className="h-3 w-3 mr-1" /> Confirm Office Receipt
                          </Button>
                        )}
                        {podDetail?.currentStatus === "ORIGINAL_RECEIVED" && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleSubmitToClient}
                            disabled={actionLoading}
                            className="bg-purple-600 text-white hover:bg-purple-700 text-xs h-7"
                          >
                            <Send className="h-3 w-3 mr-1" /> Submit to Client
                          </Button>
                        )}
                        {podDetail?.currentStatus === "SUBMITTED_TO_CLIENT" && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleAcknowledge}
                            disabled={actionLoading}
                            className="bg-emerald-700 text-white hover:bg-emerald-800 text-xs h-7"
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Record Client Acknowledged
                          </Button>
                        )}
                        {podDetail && podDetail.currentStatus !== "LOST" && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsLostModalOpen(true)}
                            className="border-red-300 text-red-600 hover:bg-red-50 text-xs h-7"
                          >
                            <FileWarning className="h-3 w-3 mr-1" /> Mark Lost
                          </Button>
                        )}
                        {podDetail?.currentStatus === "LOST" && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => setIsDuplicateModalOpen(true)}
                            className="bg-amber-600 text-white hover:bg-amber-700 text-xs h-7"
                          >
                            <HelpCircle className="h-3 w-3 mr-1" /> Request Duplicate POD
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 3. Validation Checklist */}
                <Card className="shadow-none border-slate-200 bg-white mb-5">
                  <CardHeader className="p-3.5 border-b border-slate-200">
                    <CardTitle className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                      Audit Verification Checklist
                    </CardTitle>
                    <CardDescription className="text-[11px] text-slate-500">
                      All mandatory checks must be acknowledged prior to sending invoice to billing.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="p-3.5 space-y-2">
                    {[
                      {
                        key: "distanceMatch",
                        label: "Distance Match: GPS Corridor aligns within ±3% of Odometer",
                      },
                      {
                        key: "cashMatch",
                        label: "Cash Match: Remitted Cash conforms to invoice COD line value",
                      },
                      {
                        key: "signaturePresent",
                        label: "Signature Present: Valid receiver digital / glass sign captured",
                      },
                      {
                        key: "consigneeStamp",
                        label: "Consignee Stamp Verified: Official dock stamp visible on physical LR",
                      },
                      {
                        key: "podQualityReadable",
                        label: "Document Legibility: All product quantities and seal serials readable",
                      },
                    ].map((item) => {
                      const isChecked = checklist[item.key as keyof typeof checklist];
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => toggleCheck(item.key as keyof typeof checklist)}
                          className={`w-full flex items-center justify-between p-3 rounded-lg border text-sm text-left transition-all ${
                            isChecked
                              ? "bg-turquoise/20 border-turquoise/40 text-void font-semibold"
                              : "bg-magenta/10 border-magenta/30 text-magenta font-semibold"
                          }`}
                        >
                          <span className="pr-2">{item.label}</span>
                          {isChecked ? (
                            <CheckCircle2 className="h-5 w-5 text-turquoise flex-shrink-0" />
                          ) : (
                            <XCircle className="h-5 w-5 text-magenta flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </CardContent>
                </Card>

                {/* Audit Clearance Notes Input */}
                <div className="space-y-1.5 mb-2">
                  <Label htmlFor="audit-notes" className="text-xs font-bold text-slate-700">
                    Audit Clearance Notes
                  </Label>
                  <Input
                    id="audit-notes"
                    type="text"
                    placeholder="Enter approval notes (e.g. Verified against physical dock manifest)"
                    value={auditNotes}
                    onChange={(e) => {
                      setAuditNotes(e.target.value);
                      if (notesError && e.target.value.trim().length >= 3) {
                        setNotesError(null);
                      }
                    }}
                    className="h-11 text-sm border-slate-300 bg-white"
                  />
                  {notesError && (
                    <p className="text-xs text-magenta font-semibold mt-1">{notesError}</p>
                  )}
                </div>
              </ScrollArea>

              {/* STICKY ACTION FOOTER (Bottom of Right Pane) */}
              <div className="p-4 border-t border-slate-200 bg-white flex items-center space-x-3 flex-shrink-0">
                {/* Red Outline Button: Raise Discrepancy */}
                <Button
                  type="button"
                  variant="outline"
                  disabled={!selectedTripId || actionLoading}
                  onClick={() => setIsDisputeModalOpen(true)}
                  className="flex-1 py-6 h-auto text-base font-bold text-magenta border-2 border-magenta hover:bg-magenta/10 active:scale-[0.99] transition-all disabled:opacity-50"
                >
                  <AlertOctagon className="h-5 w-5 mr-1.5" />
                  Raise Discrepancy
                </Button>

                {/* Solid Button: Verify & Send to Billing */}
                <Button
                  type="button"
                  disabled={!selectedTripId || actionLoading}
                  onClick={handleVerifyAndApprove}
                  className="flex-1 py-6 h-auto text-base font-bold bg-royal hover:bg-royal/90 text-white shadow-md active:scale-[0.99] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-5 w-5 text-turquoise" />
                  {actionLoading ? "Processing..." : "Verify & Send to Billing"}
                </Button>
              </div>
            </section>
          </div>
        )}
      </div>

      {/* DISCREPANCY REJECTION REASON MODAL */}
      <Dialog open={isDisputeModalOpen} onOpenChange={setIsDisputeModalOpen}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden border-slate-200 shadow-xl">
          <DialogHeader className="p-5 border-b border-slate-200 bg-red-50/60">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <DialogTitle className="text-base font-semibold text-red-950">
                Raise Audit Discrepancy
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-red-800 mt-1">
              Mark trip {tripNumberDisplay} as disputed and request correction.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmDiscrepancy}>
            <div className="p-5 space-y-3">
              <div>
                <Label htmlFor="reason" className="text-xs font-bold text-slate-800">
                  Discrepancy Justification *
                </Label>
                <Textarea
                  id="reason"
                  rows={4}
                  value={discrepancyNotes}
                  onChange={(e) => setDiscrepancyNotes(e.target.value)}
                  className="mt-1 text-xs border-slate-300"
                  required
                />
              </div>

              <div className="p-2.5 rounded bg-slate-100 border border-slate-200 text-[11px] text-slate-600">
                Notice will automatically freeze this invoice from ERP batch export until driver or dispatch resolves the reconciliation gap.
              </div>
            </div>

            <DialogFooter className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDisputeModalOpen(false)}
                className="h-8 text-xs border-slate-200"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={actionLoading}
                className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-50"
              >
                {actionLoading ? "Submitting..." : "Confirm Rejection & Flag"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 1. PLACE POD ON HOLD MODAL */}
      <Dialog open={isHoldModalOpen} onOpenChange={setIsHoldModalOpen}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden border-slate-200 shadow-xl">
          <DialogHeader className="p-5 border-b border-slate-200 bg-red-50/60">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <DialogTitle className="text-base font-semibold text-red-950">Place POD on Hold</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-red-800 mt-1">
              Placing this POD on hold will block billing until issues are rectified.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePlaceOnHold}>
            <div className="p-5 space-y-3">
              <div>
                <Label htmlFor="holdReason" className="text-xs font-bold text-slate-800">Hold Reason *</Label>
                <select
                  id="holdReason"
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-xs text-slate-900"
                >
                  <option value="MISSING_STAMP">MISSING_STAMP - Consignee stamp absent</option>
                  <option value="MISSING_SIGNATURE">MISSING_SIGNATURE - Receiver signature missing</option>
                  <option value="ILLEGIBLE_COPY">ILLEGIBLE_COPY - Blurry / unreadable soft copy</option>
                  <option value="DAMAGED_DOCUMENT">DAMAGED_DOCUMENT - Physical paper torn / mutilated</option>
                  <option value="SHORTAGE_DISPUTE">SHORTAGE_DISPUTE - Discrepancy in delivered package count</option>
                  <option value="OTHER">OTHER - Custom operational issue</option>
                </select>
              </div>

              <div>
                <Label htmlFor="holdRemarks" className="text-xs font-bold text-slate-800">Hold Remarks</Label>
                <Textarea
                  id="holdRemarks"
                  rows={3}
                  value={holdRemarks}
                  onChange={(e) => setHoldRemarks(e.target.value)}
                  placeholder="Provide detailed description of the deficiency..."
                  className="mt-1 text-xs border-slate-300"
                />
              </div>
            </div>

            <DialogFooter className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsHoldModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={actionLoading} className="bg-red-600 hover:bg-red-700 text-white font-semibold">
                {actionLoading ? "Submitting..." : "Confirm Place on Hold"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 2. RELEASE POD HOLD MODAL */}
      <Dialog open={isReleaseHoldModalOpen} onOpenChange={setIsReleaseHoldModalOpen}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden border-slate-200 shadow-xl">
          <DialogHeader className="p-5 border-b border-slate-200 bg-emerald-50/60">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <DialogTitle className="text-base font-semibold text-emerald-950">Release POD Hold</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-emerald-800 mt-1">
              Restores POD to SOFT_COPY_RECEIVED and enables re-verification.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleReleaseHold}>
            <div className="p-5 space-y-3">
              <div>
                <Label htmlFor="releaseRemarks" className="text-xs font-bold text-slate-800">Resolution Remarks *</Label>
                <Textarea
                  id="releaseRemarks"
                  rows={3}
                  value={releaseRemarks}
                  onChange={(e) => setReleaseRemarks(e.target.value)}
                  placeholder="Explain how the deficiency was resolved..."
                  className="mt-1 text-xs border-slate-300"
                  required
                />
              </div>
            </div>

            <DialogFooter className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsReleaseHoldModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={actionLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                {actionLoading ? "Submitting..." : "Confirm Release Hold"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 3. DISPATCH COURIER MODAL */}
      <Dialog open={isCourierModalOpen} onOpenChange={setIsCourierModalOpen}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden border-slate-200 shadow-xl">
          <DialogHeader className="p-5 border-b border-slate-200 bg-blue-50/60">
            <div className="flex items-center space-x-2">
              <Send className="h-5 w-5 text-blue-600" />
              <DialogTitle className="text-base font-semibold text-blue-950">Dispatch Physical POD via Courier</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-blue-800 mt-1">
              Enter transit details for the physical paper POD.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleDispatchCourier}>
            <div className="p-5 space-y-3">
              <div>
                <Label htmlFor="courierName" className="text-xs font-bold text-slate-800">Courier Service Name *</Label>
                <Input
                  id="courierName"
                  value={courierName}
                  onChange={(e) => setCourierName(e.target.value)}
                  placeholder="e.g. BlueDart, DTDC, Trackon"
                  className="mt-1 text-xs border-slate-300"
                  required
                />
              </div>

              <div>
                <Label htmlFor="courierTrackingNo" className="text-xs font-bold text-slate-800">AWB / Tracking Number *</Label>
                <Input
                  id="courierTrackingNo"
                  value={courierTrackingNo}
                  onChange={(e) => setCourierTrackingNo(e.target.value)}
                  placeholder="e.g. BD-89342719"
                  className="mt-1 text-xs border-slate-300"
                  required
                />
              </div>

              <div>
                <Label htmlFor="courierDispatchedAt" className="text-xs font-bold text-slate-800">Dispatch Date (optional)</Label>
                <Input
                  id="courierDispatchedAt"
                  type="date"
                  value={courierDispatchedAt}
                  onChange={(e) => setCourierDispatchedAt(e.target.value)}
                  className="mt-1 text-xs border-slate-300"
                />
              </div>
            </div>

            <DialogFooter className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsCourierModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={actionLoading} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                {actionLoading ? "Submitting..." : "Confirm Courier Dispatch"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 4. MARK LOST MODAL */}
      <Dialog open={isLostModalOpen} onOpenChange={setIsLostModalOpen}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden border-slate-200 shadow-xl">
          <DialogHeader className="p-5 border-b border-slate-200 bg-red-50/60">
            <div className="flex items-center space-x-2">
              <FileWarning className="h-5 w-5 text-red-600" />
              <DialogTitle className="text-base font-semibold text-red-950">Report Physical POD Lost</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-red-800 mt-1">
              Mark original POD document as lost in transit.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleMarkLost}>
            <div className="p-5 space-y-3">
              <div>
                <Label htmlFor="lostDate" className="text-xs font-bold text-slate-800">Loss Date</Label>
                <Input
                  id="lostDate"
                  type="date"
                  value={lostDate}
                  onChange={(e) => setLostDate(e.target.value)}
                  className="mt-1 text-xs border-slate-300"
                />
              </div>

              <div>
                <Label htmlFor="reportedBy" className="text-xs font-bold text-slate-800">Reported By</Label>
                <Input
                  id="reportedBy"
                  value={reportedBy}
                  onChange={(e) => setReportedBy(e.target.value)}
                  placeholder="e.g. Courier Desk / Logistics Coordinator"
                  className="mt-1 text-xs border-slate-300"
                />
              </div>

              <div>
                <Label htmlFor="incidentSummary" className="text-xs font-bold text-slate-800">Incident Summary *</Label>
                <Textarea
                  id="incidentSummary"
                  rows={3}
                  value={incidentSummary}
                  onChange={(e) => setIncidentSummary(e.target.value)}
                  placeholder="Explain how loss occurred (e.g. Courier vehicle accident / misplaced in transit hub)..."
                  className="mt-1 text-xs border-slate-300"
                  required
                />
              </div>
            </div>

            <DialogFooter className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsLostModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={actionLoading} className="bg-red-600 hover:bg-red-700 text-white font-semibold">
                {actionLoading ? "Submitting..." : "Confirm Report Lost"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 5. REQUEST DUPLICATE MODAL */}
      <Dialog open={isDuplicateModalOpen} onOpenChange={setIsDuplicateModalOpen}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden border-slate-200 shadow-xl">
          <DialogHeader className="p-5 border-b border-slate-200 bg-amber-50/60">
            <div className="flex items-center space-x-2">
              <HelpCircle className="h-5 w-5 text-amber-600" />
              <DialogTitle className="text-base font-semibold text-amber-950">Request Duplicate POD</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-amber-800 mt-1">
              Initiate customer request for certified duplicate proof of delivery.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRequestDuplicate}>
            <div className="p-5 space-y-3">
              <div>
                <Label htmlFor="requestReason" className="text-xs font-bold text-slate-800">Request Reason *</Label>
                <Input
                  id="requestReason"
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  placeholder="e.g. Lost in courier transit"
                  className="mt-1 text-xs border-slate-300"
                  required
                />
              </div>

              <div>
                <Label htmlFor="duplicateRemarks" className="text-xs font-bold text-slate-800">Customer Communication Remarks</Label>
                <Textarea
                  id="duplicateRemarks"
                  rows={3}
                  value={duplicateRemarks}
                  onChange={(e) => setDuplicateRemarks(e.target.value)}
                  placeholder="Notes sent to customer receiving desk..."
                  className="mt-1 text-xs border-slate-300"
                />
              </div>
            </div>

            <DialogFooter className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsDuplicateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={actionLoading} className="bg-amber-600 hover:bg-amber-700 text-white font-semibold">
                {actionLoading ? "Submitting..." : "Submit Duplicate Request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 6. POD AUDIT TRAIL MODAL */}
      <Dialog open={isEventsModalOpen} onOpenChange={setIsEventsModalOpen}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden border-slate-200 shadow-xl">
          <DialogHeader className="p-5 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center space-x-2">
              <History className="h-5 w-5 text-slate-700" />
              <DialogTitle className="text-base font-semibold text-slate-900">POD Lifecycle Audit Trail</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500 mt-1">
              Append-only tamper-evident event log for POD {podDetail?.id}
            </DialogDescription>
          </DialogHeader>

          <div className="p-5 max-h-96 overflow-y-auto space-y-3">
            {podDetail?.events && podDetail.events.length > 0 ? (
              podDetail.events.map((ev, i) => (
                <div key={ev.id || i} className="p-2.5 rounded border border-slate-200 bg-slate-50/70 text-xs space-y-1">
                  <div className="flex items-center justify-between font-mono">
                    <span className="font-bold text-slate-900">{ev.eventType}</span>
                    <span className="text-slate-500 text-[10px]">{formatDate(ev.createdAt as any)}</span>
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Transition: <span className="font-mono text-slate-800">{ev.fromStatus ?? "INITIAL"} → {ev.toStatus}</span>
                  </div>
                  {ev.notes && <div className="text-[11px] text-slate-700 italic">&ldquo;{ev.notes}&rdquo;</div>}
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 text-center py-6">No event records found.</p>
            )}
          </div>

          <DialogFooter className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsEventsModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
