"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Truck,
  MapPin,
  Phone,
  Camera,
  CheckCircle2,
  Clock,
  Package,
  Layers,
  FileText,
  QrCode,
  Banknote,
  LogOut,
  ChevronRight,
  RotateCcw,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

import { apiClient, ApiError } from "@/lib/api/client";
import type { Trip } from "@/lib/api/types";
import { getDisplayName, formatRupees, formatDate, logoutUser } from "@/lib/api/utils";

export default function DriverMobileWebApp() {
  const router = useRouter();
  // Trip State
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Driver Shift & Status State
  const [onShift, setOnShift] = useState(true);
  const [tripStage, setTripStage] = useState<"driving" | "arrived" | "completed">("driving");

  // POD & Collection Modal State
  const [isPodModalOpen, setIsPodModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "UPI">("CASH");
  const [cashCollectedAmount, setCashCollectedAmount] = useState("");
  const [referenceId, setReferenceId] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [hasCapturedPhoto, setHasCapturedPhoto] = useState(false);
  const [s3Key, setS3Key] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);

  const [isSigned, setIsSigned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [deliverySuccessMessage, setDeliverySuccessMessage] = useState(false);

  // File input ref for camera capture
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Signature Canvas Ref & Touch/Mouse Drawing
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const getExpectedCollection = (t: Trip | null): number => {
    if (!t) return 0;
    if (t.tripStops && t.tripStops.length > 0) {
      return t.tripStops.reduce((sum, s) => sum + (s.expectedCollection ?? 0), 0);
    }
    return Number((t as any).expectedCollection) || 0;
  };

  const fetchCurrentTrip = async () => {
    try {
      const res = await apiClient.get<{ data: Trip | null }>("/trips/current");
      setTrip(res.data);
      const exp = getExpectedCollection(res.data);
      if (exp > 0) {
        setCashCollectedAmount(String(exp));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load current trip");
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get<{ data: Trip | null }>("/trips/current");
        if (!cancelled) {
          setTrip(res.data);
          const exp = getExpectedCollection(res.data);
          if (exp > 0) {
            setCashCollectedAmount(String(exp));
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load current trip");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Setup canvas
  useEffect(() => {
    if (isPodModalOpen && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
      }
    }
  }, [isPodModalOpen]);

  const startDrawing = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setIsDrawing(true);
    setIsSigned(true);

    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsSigned(false);
  };

  const getSignatureBlob = (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!canvasRef.current || !isSigned) {
        resolve(null);
        return;
      }
      canvasRef.current.toBlob((blob) => {
        resolve(blob);
      }, "image/png");
    });
  };

  const tripStops = Array.isArray(trip?.tripStops)
    ? (trip.tripStops as Array<Record<string, unknown>>)
    : [];
  const currentStop =
    tripStops.find((s) => s.status !== "COMPLETED") || tripStops[0] || null;
  const currentTripStopId = currentStop
    ? String(currentStop.id || "stop-1")
    : String((trip as any)?.currentStopId || (trip as any)?.stopId || "stop-1");

  const upcomingStops = tripStops.filter((s) => s !== currentStop && s.status !== "COMPLETED");

  const [transitioningStatus, setTransitioningStatus] = useState(false);

  const advanceTripStatus = async (toStatus: string) => {
    if (!trip) return;
    setTransitioningStatus(true);
    try {
      await apiClient.post(`/trips/${trip.id}/status-transitions`, {
        toStatus,
      });
      await fetchCurrentTrip();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update trip status");
    } finally {
      setTransitioningStatus(false);
    }
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPhotoUploading(true);
    setPhotoUploadError(null);
    try {
      const presign = await apiClient.post<{ url: string; s3Key: string }>(
        "/pods/presign-upload",
        {
          tripStopId: currentTripStopId,
          documentType: "PHOTO",
          contentType: file.type || "image/jpeg",
          sizeBytes: file.size,
        }
      );
      await fetch(presign.url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "image/jpeg" },
      });
      setS3Key(presign.s3Key);
      setHasCapturedPhoto(true);
    } catch (err) {
      setPhotoUploadError(
        err instanceof ApiError ? err.message : "Failed to upload POD photo"
      );
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleRetakePhoto = () => {
    setHasCapturedPhoto(false);
    setS3Key(null);
    setSelectedFile(null);
    setPhotoUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleConfirmDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trip) return;
    if (!hasCapturedPhoto || !s3Key || !selectedFile) {
      setModalError("Please capture or upload the physical Lorry Receipt (LR) photo first.");
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      const tripId = String(trip.id);
      const tripStopId = currentTripStopId;

      // 1. Sign-on-glass upload if signature exists
      let signatureS3Key: string | null = null;
      if (isSigned && canvasRef.current) {
        const sigBlob = await getSignatureBlob();
        if (sigBlob) {
          const sigPresign = await apiClient.post<{ url: string; s3Key: string }>(
            "/pods/presign-upload",
            {
              tripStopId,
              documentType: "SIGNATURE",
              contentType: "image/png",
              sizeBytes: sigBlob.size,
            }
          );
          await fetch(sigPresign.url, {
            method: "PUT",
            body: sigBlob,
            headers: { "Content-Type": "image/png" },
          });
          signatureS3Key = sigPresign.s3Key;
          await apiClient.post("/pods", {
            tripStopId,
            documentType: "SIGNATURE",
            s3Key: signatureS3Key,
            contentType: "image/png",
            sizeBytes: sigBlob.size,
            signatoryName: receiverName.trim() || null,
          });
        }
      }

      // 2. Collection entry (inside POD modal)
      if (cashCollectedAmount) {
        await apiClient.post(`/trips/${tripId}/collections`, {
          tripStopId,
          actualAmount: Number(cashCollectedAmount),
          mode: paymentMethod,
          referenceId: referenceId.trim() || null,
        });
      }

      // 3. Confirm POD photo
      await apiClient.post("/pods", {
        tripStopId,
        documentType: "PHOTO",
        s3Key,
        contentType: selectedFile.type || "image/jpeg",
        sizeBytes: selectedFile.size,
        signatoryName: receiverName.trim() || null,
      });

      // 4. Complete trip stop
      await apiClient.post(`/trips/${tripId}/stops/${tripStopId}/complete`);

      // 5. If this was the last remaining stop, transition trip status to DELIVERED
      if (upcomingStops.length === 0) {
        try {
          await apiClient.post(`/trips/${tripId}/status-transitions`, {
            toStatus: "DELIVERED",
          });
        } catch {
          // Non-blocking if trip is already DELIVERED
        }
      }

      // 6. Refetch current trip
      await fetchCurrentTrip();

      // Close modal and show success
      setIsPodModalOpen(false);
      setTripStage("completed");
      setDeliverySuccessMessage(true);
      handleRetakePhoto();
      clearSignature();
      setReferenceId("");
    } catch (err) {
      setModalError(
        err instanceof ApiError
          ? err.message
          : "Failed to submit POD and complete delivery"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex justify-center items-start sm:py-6">
      {/* Centered Mobile Container with High-Contrast Outdoor Optimization */}
      <div className="w-full max-w-md bg-white min-h-screen sm:min-h-[900px] border-x border-slate-300 shadow-2xl relative flex flex-col pb-24 overflow-x-hidden">
        
        {/* TOP STATUS BAR (Rugged Mobile Device Style) */}
        <div className="bg-slate-900 text-slate-100 px-4 py-2 flex items-center justify-between text-xs font-mono select-none">
          <div className="flex items-center space-x-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold text-white tracking-wide">VECTO DRIVER</span>
          </div>
          <div className="flex items-center space-x-3 text-[11px] text-slate-300">
            <span>4G LTE</span>
            <span>94% BAT</span>
            <Link
              href="/dispatch"
              className="text-amber-400 hover:text-amber-300 font-sans text-xs underline font-medium flex items-center gap-0.5"
            >
              Dispatch UI <ExternalLink className="h-3 w-3" />
            </Link>
            <button
              type="button"
              onClick={() => logoutUser(router)}
              className="text-red-400 hover:text-red-300 font-sans text-xs underline font-medium flex items-center gap-0.5 cursor-pointer"
            >
              Log Out
            </button>
          </div>
        </div>

        {/* 1. TOP HEADER: Driver Name, Vehicle No, & End Shift Toggle */}
        <header className="bg-slate-900 text-white p-4 border-b-2 border-slate-800 shadow-md">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-black tracking-tight text-white uppercase">
                  {getDisplayName(trip?.driver, "Driver On Duty")}
                </h1>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                    onShift
                      ? "bg-turquoise/25 text-turquoise border border-turquoise/40"
                      : "bg-slate-700 text-slate-400 border border-slate-600"
                  }`}
                >
                  {onShift ? "ACTIVE" : "OFF DUTY"}
                </span>
              </div>
              <div className="flex items-center space-x-2 mt-1">
                <span className="bg-slate-800 text-turquoise font-mono text-sm font-bold px-2 py-0.5 rounded border border-slate-700">
                  {getDisplayName(trip?.vehicle, "No Vehicle Assigned")}
                </span>
                {Boolean(trip?.tripNumber) && (
                  <span className="text-xs text-slate-300 font-mono">
                    {String(trip?.tripNumber)}
                  </span>
                )}
              </div>
            </div>

            {/* Shift Toggle Button */}
            <button
              onClick={() => setOnShift(!onShift)}
              className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center space-x-1.5 transition-all shadow-sm ${
                onShift
                  ? "bg-magenta hover:bg-magenta/90 text-white border border-magenta"
                  : "bg-turquoise hover:bg-turquoise/90 text-void border border-turquoise font-extrabold"
              }`}
            >
              <LogOut className="h-4 w-4" />
              <span>{onShift ? "End Shift" : "Start Shift"}</span>
            </button>
          </div>

          {/* Quick Hub Notice */}
          <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-300">
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-blue-400" />{" "}
              {trip?.origin ? String(trip.origin) : "Base Hub"}
            </span>
            <span className="font-mono text-slate-400">
              {trip?.destination
                ? `Dest: ${String(trip.destination)}`
                : trip?.status
                ? `Status: ${String(trip.status)}`
                : "No active route"}
            </span>
          </div>
        </header>

        {/* MAIN BODY CONTENT */}
        <main className="p-4 space-y-4 flex-1">
          {/* Shift Off Warning (if toggled) */}
          {!onShift && (
            <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-lg text-amber-900 text-sm font-semibold flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-amber-600 flex-shrink-0" />
              <div>
                <p>Shift has been ended.</p>
                <p className="text-xs font-normal text-amber-800 mt-0.5">
                  Vehicle telematics are paused. Tap Start Shift above to resume duty.
                </p>
              </div>
            </div>
          )}

          {/* Delivery Completion Success Notice */}
          {deliverySuccessMessage && (
            <div className="p-4 bg-emerald-50 border-2 border-emerald-400 rounded-lg text-emerald-950 flex items-start gap-3 shadow-sm animate-in fade-in-50">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm">POD & Cash Settled!</h4>
                <p className="text-xs text-emerald-800 mt-0.5">
                  Delivery confirmed & POD recorded. Next destination unlocked below.
                </p>
                <button
                  onClick={() => {
                    setTripStage("driving");
                    setDeliverySuccessMessage(false);
                  }}
                  className="mt-2 text-xs font-bold text-emerald-700 underline"
                >
                  Dismiss notice
                </button>
              </div>
            </div>
          )}

          {/* Error State Banner */}
          {error && (
            <div className="p-3.5 bg-red-50 border-2 border-red-300 rounded-lg text-red-900 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Loading State */}
          {loading ? (
            <Card className="border-2 border-slate-300 rounded-xl overflow-hidden shadow-sm bg-white p-8 flex flex-col items-center justify-center text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
              <p className="mt-3 text-sm font-bold text-slate-700">Loading current trip...</p>
            </Card>
          ) : !trip ? (
            /* Empty State */
            <Card className="border-2 border-slate-300 rounded-xl overflow-hidden shadow-sm bg-white p-8 flex flex-col items-center justify-center text-center">
              <Package className="h-10 w-10 text-slate-400 mb-2" />
              <p className="text-sm font-bold text-slate-800">
                No active trip assigned. Check back later.
              </p>
              <p className="text-xs text-slate-500 mt-1">
                When dispatch assigns a trip to your vehicle, it will appear here.
              </p>
            </Card>
          ) : (
            /* 2. ACTIVE TRIP VIEW (MAIN SCREEN) */
            <Card className="border-2 border-slate-900 rounded-xl overflow-hidden shadow-lg bg-white">
              <CardHeader className="bg-slate-900 text-white p-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Badge className="bg-blue-600 hover:bg-blue-600 text-white font-mono text-[11px] px-2 py-0.5 rounded uppercase font-bold tracking-wider">
                      CURRENT STOP
                    </Badge>
                    <span className="text-xs text-slate-300 font-mono">
                      {trip.tripNumber ? String(trip.tripNumber) : String(trip.id)}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-emerald-400 text-emerald-300 bg-emerald-950/40 text-[10px] font-bold uppercase"
                  >
                    {String(trip.status || "ACTIVE")}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-4 space-y-4">
                {/* Destination & Client Header */}
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-xl font-black text-slate-900 leading-snug">
                        {getDisplayName(trip.client, "Client Delivery")}
                      </h2>
                      <p className="text-sm font-bold text-blue-700">
                        {String(trip.destination || "Destination Facility")}
                      </p>
                    </div>
                    <a
                      href="tel:+918000000000"
                      className="h-10 w-10 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-800 hover:bg-slate-200 transition-colors shadow-sm"
                      title="Call Receiver"
                    >
                      <Phone className="h-5 w-5 text-slate-800" />
                    </a>
                  </div>

                  <p className="text-xs font-medium text-slate-600 mt-1 flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                    {String(trip.destination || "Address specified in consignment manifest")}
                  </p>
                </div>

                {/* Cargo Details Box */}
                <div className="grid grid-cols-3 gap-2 p-3 bg-slate-100 border border-slate-300 rounded-lg text-center">
                  <div className="border-r border-slate-300 pr-1">
                    <span className="text-[11px] font-bold text-slate-600 block uppercase">
                      Origin
                    </span>
                    <span className="text-xs font-black text-slate-900 flex items-center justify-center gap-1 truncate">
                      <Layers className="h-3.5 w-3.5 text-slate-700 flex-shrink-0" />{" "}
                      {String(trip.origin || "Hub")}
                    </span>
                  </div>
                  <div className="border-r border-slate-300 px-1">
                    <span className="text-[11px] font-bold text-slate-600 block uppercase">
                      ETA
                    </span>
                    <span className="text-sm font-black text-slate-900">
                      {String(trip.eta || "On Route")}
                    </span>
                  </div>
                  <div className="pl-1">
                    <span className="text-[11px] font-bold text-slate-600 block uppercase">
                      COD to Collect
                    </span>
                    <span className="text-sm font-black text-emerald-700">
                      {formatRupees(getExpectedCollection(trip))}
                    </span>
                  </div>
                </div>

                {/* ACTION TRIGGER BUTTON: Canonical R1 One-Tap Lifecycle Actions */}
                <div className="pt-2 space-y-2">
                  {trip.status === "PLACED" && (
                    <Button
                      type="button"
                      disabled={transitioningStatus}
                      onClick={() => advanceTripStatus("LOADING")}
                      className="w-full py-6 h-auto text-xl font-black uppercase tracking-wide bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-lg border-2 border-amber-600 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                    >
                      <Package className="h-6 w-6" />
                      {transitioningStatus ? "Updating..." : "Start Loading"}
                    </Button>
                  )}

                  {trip.status === "LOADING" && (
                    <Button
                      type="button"
                      disabled={transitioningStatus}
                      onClick={() => advanceTripStatus("LOADED")}
                      className="w-full py-6 h-auto text-xl font-black uppercase tracking-wide bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg border-2 border-indigo-600 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="h-6 w-6" />
                      {transitioningStatus ? "Updating..." : "Mark Loaded"}
                    </Button>
                  )}

                  {trip.status === "LOADED" && (
                    <Button
                      type="button"
                      disabled={transitioningStatus}
                      onClick={() => advanceTripStatus("IN_TRANSIT")}
                      className="w-full py-6 h-auto text-xl font-black uppercase tracking-wide bg-royal hover:bg-royal/90 text-white rounded-xl shadow-lg border-2 border-royal active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                    >
                      <Truck className="h-6 w-6" />
                      {transitioningStatus ? "Updating..." : "Depart & Start Transit"}
                    </Button>
                  )}

                  {trip.status === "IN_TRANSIT" && (
                    <Button
                      type="button"
                      disabled={transitioningStatus}
                      onClick={() => advanceTripStatus("UNLOADING")}
                      className="w-full py-6 h-auto text-xl font-black uppercase tracking-wide bg-royal hover:bg-royal/90 text-white rounded-xl shadow-lg border-2 border-royal active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                    >
                      <MapPin className="h-6 w-6 animate-bounce" />
                      {transitioningStatus ? "Updating..." : "Reached Stop / Unloading"}
                    </Button>
                  )}

                  {(trip.status === "UNLOADING" ||
                    trip.status === "IN_PROGRESS" ||
                    trip.status === "DELIVERY_IN_PROGRESS" ||
                    !["PLACED", "LOADING", "LOADED", "IN_TRANSIT", "DELIVERED", "CLOSED"].includes(String(trip.status))) && (
                    <Button
                      type="button"
                      onClick={() => setIsPodModalOpen(true)}
                      className="w-full py-6 h-auto text-xl font-black uppercase tracking-wide bg-turquoise hover:bg-turquoise/90 text-void rounded-xl shadow-lg border-2 border-turquoise active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="h-6 w-6 text-void" />
                      Complete Delivery & POD
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 3. UP NEXT QUEUE (Upcoming Deliveries) */}
          <section className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-slate-500" /> Up Next In Route{" "}
                {upcomingStops.length > 0 ? `(${upcomingStops.length} Stops)` : ""}
              </h3>
            </div>

            {upcomingStops.length > 0 ? (
              upcomingStops.map((stop, index) => (
                <div
                  key={String(stop.id || index)}
                  className="p-3.5 bg-white border-2 border-slate-300 rounded-lg shadow-xs flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <Badge
                        variant="outline"
                        className="bg-slate-100 text-slate-800 font-mono text-[10px] font-bold"
                      >
                        STOP #{stop.sequence ? String(stop.sequence) : index + 2}
                      </Badge>
                      <span className="text-xs font-bold text-slate-900">
                        {getDisplayName(stop.client, (typeof stop.locationName === "string" && stop.locationName) || "Next Delivery Point")}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      {String(stop.destination || stop.address || "")}
                      {stop.pallets ? ` • ${String(stop.pallets)} Pallets` : ""}
                    </p>
                    <div className="text-[11px] text-slate-600 font-mono">
                      {stop.expectedCollection
                        ? `COD Expected: ${formatRupees(Number(stop.expectedCollection))}`
                        : "Pre-paid (No COD)"}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-400 flex-shrink-0" />
                </div>
              ))
            ) : (
              <div className="p-3.5 bg-white border-2 border-slate-200 rounded-lg text-center text-xs text-slate-500 font-medium">
                No additional upcoming stops in route.
              </div>
            )}
          </section>
        </main>

        {/* STICKY BOTTOM QUICK ACTIONS BAR */}
        <div className="fixed bottom-0 left-0 right-0 sm:absolute max-w-md mx-auto bg-slate-900 text-white border-t-2 border-slate-800 px-4 py-2.5 flex items-center justify-around z-20 shadow-2xl">
          <button className="flex flex-col items-center text-blue-400">
            <Truck className="h-5 w-5" />
            <span className="text-[10px] font-bold mt-0.5">Active Trip</span>
          </button>
          <button
            onClick={() => {
              if (trip) setIsPodModalOpen(true);
            }}
            className="flex flex-col items-center text-slate-400 hover:text-white"
          >
            <Camera className="h-5 w-5" />
            <span className="text-[10px] font-bold mt-0.5">POD Camera</span>
          </button>
          <button
            disabled
            onClick={() => {}}
            className="flex flex-col items-center text-slate-500 opacity-50 cursor-not-allowed"
          >
            <Banknote className="h-5 w-5" />
            <span className="text-[10px] font-bold mt-0.5">Expense Float</span>
          </button>
          <a
            href="tel:+918000000000"
            className="flex flex-col items-center text-red-400 hover:text-red-300"
          >
            <Phone className="h-5 w-5" />
            <span className="text-[10px] font-bold mt-0.5">SOS Dispatch</span>
          </a>
        </div>

        {/* ========================================================================= */}
        {/* WIDGET: DIGITAL POD & PAYMENT COLLECTION MODAL (Full Screen / Mobile Sheet) */}
        {/* ========================================================================= */}
        <Dialog open={isPodModalOpen} onOpenChange={setIsPodModalOpen}>
          <DialogContent className="max-w-md w-full h-[95vh] sm:h-auto sm:max-h-[90vh] p-0 flex flex-col bg-white border-2 border-slate-900 rounded-t-2xl sm:rounded-xl overflow-hidden">
            {/* Header */}
            <DialogHeader className="p-4 bg-slate-900 text-white flex-shrink-0">
              <div className="flex items-center justify-between pr-6">
                <div>
                  <DialogTitle className="text-lg font-black text-white uppercase tracking-tight">
                    Proof of Delivery (POD)
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-300 mt-0.5">
                    {trip
                      ? `${getDisplayName(trip.client, "Client")} (${String(trip.tripNumber || trip.id)})`
                      : "Delivery Settlement"}
                  </DialogDescription>
                </div>
                <Badge className="bg-blue-600 text-white font-mono text-xs">
                  Step 2 of 2
                </Badge>
              </div>
            </DialogHeader>

            {/* Scrollable Form Body */}
            <form onSubmit={handleConfirmDelivery} className="flex-1 overflow-y-auto p-4 space-y-5">
              {modalError && (
                <div className="p-3 bg-red-50 border border-red-300 rounded-lg text-red-800 text-xs font-medium">
                  {modalError}
                </div>
              )}

              {/* UI ELEMENT 1: Upload Lorry Receipt (POD) Camera Dropzone */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-black text-slate-900 uppercase">
                    1. Upload Lorry Receipt (POD) *
                  </Label>
                  {hasCapturedPhoto && (
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Photo Captured
                    </span>
                  )}
                </div>

                {/* Hidden File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePhotoSelect}
                />

                {photoUploading ? (
                  <div className="w-full border-2 border-blue-400 bg-blue-50/50 rounded-xl p-6 flex flex-col items-center justify-center space-y-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
                    <span className="text-xs font-bold text-blue-900">
                      Uploading POD photo to secure storage...
                    </span>
                  </div>
                ) : !hasCapturedPhoto ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-3 border-dashed border-slate-400 hover:border-blue-600 bg-slate-50 hover:bg-blue-50/50 rounded-xl p-5 flex flex-col items-center justify-center space-y-2 transition-all active:scale-[0.99]"
                  >
                    <div className="h-14 w-14 rounded-full bg-blue-700 text-white flex items-center justify-center shadow-md">
                      <Camera className="h-7 w-7" />
                    </div>
                    <span className="text-sm font-black text-slate-900">
                      Tap To Open Camera
                    </span>
                    <span className="text-xs text-slate-500 text-center font-medium max-w-xs">
                      Capture stamp & signature on physical LR copy clearly in daylight.
                    </span>
                  </button>
                ) : (
                  <div className="rounded-xl border-2 border-emerald-500 bg-emerald-50/50 p-3 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="h-12 w-12 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-mono text-xs font-bold shadow-xs">
                        <FileText className="h-6 w-6" />
                      </div>
                      <div>
                        <span className="text-xs font-black text-slate-900 block truncate max-w-[180px]">
                          {selectedFile?.name || "LR_POD_document.jpg"}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          Uploaded to secure storage
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRetakePhoto}
                      className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 p-1"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Retake
                    </button>
                  </div>
                )}

                {photoUploadError && (
                  <p className="text-xs text-red-600 font-semibold">{photoUploadError}</p>
                )}
              </div>

              {/* UI ELEMENT 2: Sign on Glass Placeholder Box */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-black text-slate-900 uppercase">
                    2. Receiver Sign On Glass
                  </Label>
                  <button
                    type="button"
                    onClick={clearSignature}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 underline"
                  >
                    Clear Sign
                  </button>
                </div>

                <div className="border-2 border-slate-300 rounded-xl bg-slate-100 p-1 relative overflow-hidden">
                  <canvas
                    ref={canvasRef}
                    width={380}
                    height={120}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-28 bg-white rounded-lg cursor-crosshair touch-none"
                  />
                  {!isSigned && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                      Receiver signs here with finger
                    </div>
                  )}
                </div>

                <div className="pt-1">
                  <Label className="text-xs font-bold text-slate-700">Receiver Name & Mobile</Label>
                  <Input
                    type="text"
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    className="h-9 text-xs font-bold text-slate-900 mt-1 border-slate-300"
                    placeholder="Enter receiver name"
                  />
                </div>
              </div>

              {/* UI ELEMENT 3: Payment Collection (Cash vs UPI & Exact Amount) */}
              <div className="space-y-2 pt-1 border-t-2 border-slate-200">
                <Label className="text-sm font-black text-slate-900 uppercase block">
                  3. Collect Freight COD Payment
                </Label>

                {/* Radio Buttons for Cash vs UPI */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("CASH")}
                    className={`p-3 rounded-xl border-2 flex items-center justify-center space-x-2 text-sm font-black transition-all ${
                      paymentMethod === "CASH"
                        ? "border-blue-700 bg-blue-50 text-blue-900 shadow-sm"
                        : "border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Banknote className="h-5 w-5" />
                    <span>CASH</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod("UPI")}
                    className={`p-3 rounded-xl border-2 flex items-center justify-center space-x-2 text-sm font-black transition-all ${
                      paymentMethod === "UPI"
                        ? "border-blue-700 bg-blue-50 text-blue-900 shadow-sm"
                        : "border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <QrCode className="h-5 w-5" />
                    <span>UPI QR</span>
                  </button>
                </div>

                {/* UPI QR Code Mock if Selected */}
                {paymentMethod === "UPI" && (
                  <div className="p-3 bg-slate-100 border border-slate-300 rounded-xl flex items-center space-x-3 animate-in fade-in-50">
                    <div className="h-14 w-14 bg-white border border-slate-300 rounded-lg flex items-center justify-center p-1 flex-shrink-0">
                      <QrCode className="h-10 w-10 text-slate-900" />
                    </div>
                    <div>
                      <span className="text-xs font-black text-slate-900 block">
                        Scan Static Truck UPI
                      </span>
                      <span className="text-[11px] text-slate-600 font-mono">
                        Instant settlement verification
                      </span>
                    </div>
                  </div>
                )}

                {/* Reference ID (Optional UTR or Receipt ID) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>
                      {paymentMethod === "UPI"
                        ? "UPI UTR / Reference ID"
                        : "Receipt / Reference (Optional)"}
                    </span>
                    <span className="text-[10px] text-slate-400">Optional</span>
                  </div>
                  <Input
                    type="text"
                    value={referenceId}
                    onChange={(e) => setReferenceId(e.target.value)}
                    placeholder={paymentMethod === "UPI" ? "e.g. 320194829102" : "e.g. REC-8821"}
                    className="h-10 text-xs font-semibold text-slate-900 bg-slate-50 border-2 border-slate-300 focus-visible:border-slate-900"
                  />
                </div>

                {/* Exact Amount Collected Number Input */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>Exact Cash / Remittance Amount</span>
                    <span className="text-slate-500 font-mono">
                      Expected:{" "}
                      {formatRupees(getExpectedCollection(trip))}
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-700">
                      ₹
                    </span>
                    <Input
                      type="number"
                      value={cashCollectedAmount}
                      onChange={(e) => setCashCollectedAmount(e.target.value)}
                      className="pl-8 h-12 text-lg font-black text-slate-900 bg-slate-50 border-2 border-slate-400 focus-visible:border-slate-900"
                      placeholder="0"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* UI ELEMENT 4: Massive Turquoise "Confirm Delivery & Submit" Button */}
              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={isSubmitting || photoUploading || !hasCapturedPhoto}
                  className="w-full py-6 h-auto text-xl font-black uppercase tracking-wide bg-turquoise hover:bg-turquoise/90 text-void rounded-xl shadow-xl border-2 border-turquoise active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-6 w-6 text-void" />
                  {isSubmitting ? "Submitting Settlement..." : "Confirm Delivery & Submit"}
                </Button>
                <p className="text-xs text-center text-slate-600 font-medium mt-2">
                  Data will be instantly synced to Dispatch Desk & Accounts Audit.
                </p>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
