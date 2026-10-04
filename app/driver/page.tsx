"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Truck,
  MapPin,
  Navigation,
  Phone,
  Camera,
  CheckCircle2,
  Clock,
  Package,
  Layers,
  FileText,
  IndianRupee,
  QrCode,
  Banknote,
  LogOut,
  ChevronRight,
  RotateCcw,
  Sparkles,
  ArrowLeft,
  ShieldCheck,
  Compass,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function DriverMobileWebApp() {
  // Driver Shift & Status State
  const [onShift, setOnShift] = useState(true);
  const [tripStage, setTripStage] = useState<"driving" | "arrived" | "completed">("driving");

  // POD & Collection Modal State
  const [isPodModalOpen, setIsPodModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "UPI">("CASH");
  const [cashCollectedAmount, setCashCollectedAmount] = useState("24500");
  const [receiverName, setReceiverName] = useState("K. Ramesh (Warehouse In-Charge)");
  const [hasCapturedPhoto, setHasCapturedPhoto] = useState(false);
  const [isSigned, setIsSigned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deliverySuccessMessage, setDeliverySuccessMessage] = useState(false);

  // Signature Canvas Ref & Simple Touch/Mouse Drawing
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

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

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
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

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
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

  const handleSimulateCapturePhoto = () => {
    setHasCapturedPhoto(true);
  };

  const handleConfirmDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasCapturedPhoto) {
      alert("Please capture or upload the physical Lorry Receipt (LR) photo first.");
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsPodModalOpen(false);
      setTripStage("completed");
      setDeliverySuccessMessage(true);
    }, 700);
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
          </div>
        </div>

        {/* 1. TOP HEADER: Driver Name, Vehicle No, & End Shift Toggle */}
        <header className="bg-slate-900 text-white p-4 border-b-2 border-slate-800 shadow-md">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-black tracking-tight text-white uppercase">
                  Rajesh Kumar
                </h1>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-1.5 py-0.5 rounded">
                  ACTIVE
                </span>
              </div>
              <div className="flex items-center space-x-2 mt-1">
                <span className="bg-slate-800 text-amber-400 font-mono text-sm font-bold px-2 py-0.5 rounded border border-slate-700">
                  MH 12 RN 4920
                </span>
                <span className="text-xs text-slate-300 font-mono">16T Eicher Pro</span>
              </div>
            </div>

            {/* Shift Toggle Button */}
            <button
              onClick={() => setOnShift(!onShift)}
              className={`px-3 py-2 rounded-lg font-bold text-xs flex items-center space-x-1.5 transition-all shadow-sm ${
                onShift
                  ? "bg-red-600 hover:bg-red-700 text-white border border-red-500"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500"
              }`}
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>{onShift ? "End Shift" : "Start Shift"}</span>
            </button>
          </div>

          {/* Quick Hub Notice */}
          <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-300">
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-blue-400" /> Bhiwandi Hub #4
            </span>
            <span className="font-mono text-slate-400">Route: BHI-SAN-01</span>
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
                  Vehicle telematics are paused. Tap Start Shift above to resume delivery GPS.
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
                  LR signed & ₹24,500 recorded. Next destination unlocked below.
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

          {/* 2. ACTIVE TRIP VIEW (MAIN SCREEN) */}
          <Card className="border-2 border-slate-900 rounded-xl overflow-hidden shadow-lg bg-white">
            <CardHeader className="bg-slate-900 text-white p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Badge className="bg-blue-600 hover:bg-blue-600 text-white font-mono text-[11px] px-2 py-0.5 rounded uppercase font-bold tracking-wider">
                    CURRENT STOP #1
                  </Badge>
                  <span className="text-xs text-slate-300 font-mono">INV-9921</span>
                </div>
                <Badge
                  variant="outline"
                  className="border-emerald-400 text-emerald-300 bg-emerald-950/40 text-[10px] font-bold"
                >
                  HIGH PRIORITY
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {/* Destination & Client Header */}
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-black text-slate-900 leading-snug">
                      Metro Cash & Carry
                    </h2>
                    <p className="text-sm font-bold text-blue-700">
                      Whitefield Regional Distribution Center
                    </p>
                  </div>
                  <a
                    href="tel:+919876543210"
                    className="h-10 w-10 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-800 hover:bg-slate-200 transition-colors shadow-sm"
                    title="Call Receiver"
                  >
                    <Phone className="h-5 w-5 text-slate-800" />
                  </a>
                </div>

                <p className="text-xs font-medium text-slate-600 mt-1 flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                  Plot 14-A, EPIP Zone, Hoodi, Whitefield, Bengaluru - 560066
                </p>
              </div>

              {/* Cargo Details Box */}
              <div className="grid grid-cols-3 gap-2 p-3 bg-slate-100 border border-slate-300 rounded-lg text-center">
                <div className="border-r border-slate-300 pr-1">
                  <span className="text-[11px] font-bold text-slate-600 block uppercase">
                    Cargo
                  </span>
                  <span className="text-sm font-black text-slate-900 flex items-center justify-center gap-1">
                    <Layers className="h-3.5 w-3.5 text-slate-700" /> 12 Pallets
                  </span>
                </div>
                <div className="border-r border-slate-300 px-1">
                  <span className="text-[11px] font-bold text-slate-600 block uppercase">
                    Weight
                  </span>
                  <span className="text-sm font-black text-slate-900">3.8 Tonnes</span>
                </div>
                <div className="pl-1">
                  <span className="text-[11px] font-bold text-slate-600 block uppercase">
                    COD to Collect
                  </span>
                  <span className="text-sm font-black text-emerald-700">₹24,500</span>
                </div>
              </div>

              {/* Mock Map / Routing Area (High Contrast, Outdoor Friendly) */}
              <div className="relative rounded-lg overflow-hidden border-2 border-slate-800 bg-slate-900 text-white p-3.5">
                {/* Simulated GPS Routing HUD */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="h-7 w-7 rounded-full bg-blue-600 flex items-center justify-center text-white">
                      <Navigation className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">
                        NH-48 Corridor via Outer Ring Rd
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Speed: 48 km/h • GPS Lock Strong
                      </span>
                    </div>
                  </div>
                  <Badge className="bg-slate-800 border border-slate-700 text-amber-400 font-mono text-xs">
                    45 km away
                  </Badge>
                </div>

                {/* Simulated Map Visual Box */}
                <div className="h-28 w-full bg-slate-950 rounded border border-slate-800 relative flex flex-col items-center justify-center text-slate-500 overflow-hidden">
                  {/* Grid Lines for GPS Look */}
                  <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]" />

                  {/* Route Line Simulation */}
                  <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 flex items-center justify-between z-10 px-4">
                    <div className="flex flex-col items-center">
                      <div className="h-4 w-4 rounded-full bg-blue-500 ring-4 ring-blue-500/30 flex items-center justify-center text-white text-[9px] font-bold">
                        A
                      </div>
                      <span className="text-[9px] text-slate-400 mt-1 font-mono">Hub</span>
                    </div>

                    <div className="flex-1 mx-3 border-t-2 border-dashed border-blue-400 relative">
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-900 px-1 text-[10px] font-mono text-amber-300">
                        ETA 52 mins
                      </div>
                    </div>

                    <div className="flex flex-col items-center">
                      <div className="h-4 w-4 rounded-full bg-red-500 ring-4 ring-red-500/30 flex items-center justify-center text-white text-[9px] font-bold">
                        B
                      </div>
                      <span className="text-[9px] text-slate-400 mt-1 font-mono">Metro CC</span>
                    </div>
                  </div>
                </div>

                {/* Next Turn Instruction */}
                <div className="mt-2.5 flex items-center justify-between text-xs font-mono pt-2 border-t border-slate-800">
                  <span className="text-slate-300 flex items-center gap-1.5">
                    <Compass className="h-3.5 w-3.5 text-blue-400" /> Next: In 800m, take exit for Hoodi Jn
                  </span>
                </div>
              </div>

              {/* ACTION TRIGGER BUTTON: High-Contrast Massive Touch Target */}
              <div className="pt-1">
                {tripStage === "driving" ? (
                  <Button
                    type="button"
                    onClick={() => setTripStage("arrived")}
                    className="w-full py-7 text-lg font-black uppercase tracking-wide bg-blue-700 hover:bg-blue-800 text-white rounded-xl shadow-lg border-2 border-blue-900 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                  >
                    <MapPin className="h-6 w-6 animate-bounce" />
                    Reached Destination
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => setIsPodModalOpen(true)}
                    className="w-full py-7 text-lg font-black uppercase tracking-wide bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg border-2 border-emerald-800 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="h-6 w-6" />
                    Complete Delivery & POD
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 3. UP NEXT QUEUE (Upcoming Deliveries) */}
          <section className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-slate-500" /> Up Next In Route (2 Stops)
              </h3>
              <span className="text-[11px] font-mono text-slate-600 font-bold">Total: 178 km</span>
            </div>

            {/* Upcoming Delivery Card 1 */}
            <div className="p-3.5 bg-white border-2 border-slate-300 rounded-lg shadow-xs flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="bg-slate-100 text-slate-800 font-mono text-[10px] font-bold">
                    STOP #2
                  </Badge>
                  <span className="text-xs font-bold text-slate-900">Reliance Retail Central DC</span>
                </div>
                <p className="text-xs text-slate-600">
                  Hebbal Industrial Estate, Bengaluru • <span className="font-semibold text-slate-800">8 Pallets</span>
                </p>
                <div className="text-[11px] text-slate-600 font-mono">
                  COD Expected: ₹18,200 • 68 km away
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-400 flex-shrink-0" />
            </div>

            {/* Upcoming Delivery Card 2 */}
            <div className="p-3.5 bg-white border-2 border-slate-300 rounded-lg shadow-xs flex items-center justify-between opacity-85">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="bg-slate-100 text-slate-800 font-mono text-[10px] font-bold">
                    STOP #3
                  </Badge>
                  <span className="text-xs font-bold text-slate-900">Flipkart Wholesale Hub</span>
                </div>
                <p className="text-xs text-slate-600">
                  Nelamangala Logistics Corridor • <span className="font-semibold text-slate-800">15 Pallets</span>
                </p>
                <div className="text-[11px] text-slate-600 font-mono">
                  Pre-paid (No COD) • 110 km away
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-400 flex-shrink-0" />
            </div>
          </section>
        </main>

        {/* STICKY BOTTOM QUICK ACTIONS BAR */}
        <div className="fixed bottom-0 left-0 right-0 sm:absolute max-w-md mx-auto bg-slate-900 text-white border-t-2 border-slate-800 px-4 py-2.5 flex items-center justify-around z-20 shadow-2xl">
          <button className="flex flex-col items-center text-blue-400">
            <Truck className="h-5 w-5" />
            <span className="text-[10px] font-bold mt-0.5">Active Trip</span>
          </button>
          <button
            onClick={() => setIsPodModalOpen(true)}
            className="flex flex-col items-center text-slate-400 hover:text-white"
          >
            <Camera className="h-5 w-5" />
            <span className="text-[10px] font-bold mt-0.5">POD Camera</span>
          </button>
          <button
            onClick={() => alert("Emergency Fuel / Toll Float: ₹12,000 active")}
            className="flex flex-col items-center text-slate-400 hover:text-white"
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
                    Stop #1: Metro Cash & Carry (INV-9921)
                  </DialogDescription>
                </div>
                <Badge className="bg-blue-600 text-white font-mono text-xs">
                  Step 2 of 2
                </Badge>
              </div>
            </DialogHeader>

            {/* Scrollable Form Body */}
            <form onSubmit={handleConfirmDelivery} className="flex-1 overflow-y-auto p-4 space-y-5">
              
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

                {!hasCapturedPhoto ? (
                  <button
                    type="button"
                    onClick={handleSimulateCapturePhoto}
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
                        <span className="text-xs font-black text-slate-900 block">
                          LR_MH12_INV9921_POD.jpg
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          Captured at 14:28 IST • Geo-tagged
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setHasCapturedPhoto(false)}
                      className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 p-1"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Retake
                    </button>
                  </div>
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
                        vecto.mh12@icici • Instant Verify
                      </span>
                    </div>
                  </div>
                )}

                {/* Exact Amount Collected Number Input */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>Exact Cash / Remittance Amount</span>
                    <span className="text-slate-500 font-mono">Expected: ₹24,500</span>
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

              {/* UI ELEMENT 4: Massive Green "Confirm Delivery & Submit" Button */}
              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-7 text-lg font-black uppercase tracking-wide bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xl border-2 border-emerald-800 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="h-6 w-6" />
                  {isSubmitting ? "Submitting Settlement..." : "Confirm Delivery & Submit"}
                </Button>
                <p className="text-[11px] text-center text-slate-600 font-medium mt-2">
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
