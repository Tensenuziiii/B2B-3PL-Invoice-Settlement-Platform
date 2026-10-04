"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  Truck,
  Building2,
  Tag,
  Route as RouteIcon,
  Store,
  LayoutDashboard,
  Receipt,
  FileCheck2,
  Power,
  ExternalLink,
} from "lucide-react";

const NAV_ITEMS = [
  { name: "Users", href: "/admin/users", icon: Users },
  { name: "Vehicles", href: "/admin/vehicles", icon: Truck },
  { name: "Clients", href: "/admin/clients", icon: Building2 },
  { name: "Vendors", href: "/admin/vendors", icon: Store },
  { name: "Routes", href: "/admin/routes", icon: RouteIcon },
  { name: "Rate Cards", href: "/admin/rate-cards", icon: Tag },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-800 font-sans antialiased overflow-hidden">
      {/* 1. LEFT SIDEBAR NAVIGATION */}
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
                ADMIN MASTER DATA
              </span>
            </div>
          </div>
        </div>

        {/* Admin Role Identity Tag */}
        <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 rounded-full bg-purple-600 ring-2 ring-purple-100" />
              <span className="text-xs font-semibold text-slate-800">
                System Administration
              </span>
            </div>
            <span className="text-[10px] font-mono text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 font-bold">
              ADM-01
            </span>
          </div>
          <p className="text-[11px] text-slate-600 mt-1 truncate">
            Enterprise Security & Master Records
          </p>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-slate-500"}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Quick Link Switcher to Operational Roles */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/50">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1 mb-1.5 block">
            Operational Workspaces
          </span>
          <div className="space-y-1 text-xs">
            <Link
              href="/dispatch"
              className="flex items-center justify-between p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900"
            >
              <span className="flex items-center gap-1.5">
                <LayoutDashboard className="h-3.5 w-3.5 text-slate-500" /> Dispatch
              </span>
              <ExternalLink className="h-3 w-3 text-slate-400" />
            </Link>
            <Link
              href="/audit"
              className="flex items-center justify-between p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900"
            >
              <span className="flex items-center gap-1.5">
                <FileCheck2 className="h-3.5 w-3.5 text-indigo-600" /> Audit
              </span>
              <ExternalLink className="h-3 w-3 text-slate-400" />
            </Link>
            <Link
              href="/accounts"
              className="flex items-center justify-between p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900"
            >
              <span className="flex items-center gap-1.5">
                <Receipt className="h-3.5 w-3.5 text-emerald-600" /> Billing
              </span>
              <ExternalLink className="h-3 w-3 text-slate-400" />
            </Link>
            <Link
              href="/login"
              className="flex items-center justify-between p-1.5 rounded hover:bg-red-50 text-red-600 font-medium"
            >
              <span className="flex items-center gap-1.5">
                <Power className="h-3.5 w-3.5" /> Log Out
              </span>
            </Link>
          </div>
        </div>
      </aside>

      {/* RIGHT MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
