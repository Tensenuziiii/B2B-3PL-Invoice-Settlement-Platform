"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logoutUser } from "@/lib/api/utils";
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
  const router = useRouter();

  return (
    <div className="flex h-screen w-full bg-platinum text-void font-sans antialiased overflow-hidden">
      {/* 1. LEFT SIDEBAR NAVIGATION */}
      <aside className="w-64 flex-shrink-0 flex flex-col border-r border-void/20 bg-void text-platinum">
        {/* Brand / Logo */}
        <div className="h-16 border-b border-white/10 px-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 rounded-lg bg-royal flex items-center justify-center text-white font-bold text-sm shadow-md">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-white block leading-tight">
                VECTO LOGISTICS
              </span>
              <span className="text-xs uppercase font-mono tracking-wider text-turquoise block font-semibold">
                ADMIN MASTER DATA
              </span>
            </div>
          </div>
        </div>

        {/* Admin Role Identity Tag */}
        <div className="px-5 py-4 bg-white/5 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="h-2.5 w-2.5 rounded-full bg-turquoise ring-2 ring-turquoise/30" />
              <span className="text-sm font-bold text-white">
                System Administration
              </span>
            </div>
            <span className="text-xs font-mono text-turquoise bg-turquoise/10 px-2 py-0.5 rounded border border-turquoise/30 font-bold">
              ADM-01
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 truncate">
            Enterprise Security & Master Records
          </p>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-4 py-5 space-y-1.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-semibold transition-colors ${
                  isActive
                    ? "bg-royal text-white shadow-md"
                    : "text-slate-300 hover:text-white hover:bg-white/10"
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? "text-white" : "text-slate-400"}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Quick Link Switcher to Operational Roles */}
        <div className="p-4 border-t border-white/10 bg-white/5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1 mb-2 block">
            Operational Workspaces
          </span>
          <div className="space-y-1.5 text-sm">
            <Link
              href="/dispatch"
              className="flex items-center justify-between p-2 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white font-medium"
            >
              <span className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4 text-turquoise" /> Dispatch
              </span>
              <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
            </Link>
            <Link
              href="/audit"
              className="flex items-center justify-between p-2 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white font-medium"
            >
              <span className="flex items-center gap-2">
                <FileCheck2 className="h-4 w-4 text-turquoise" /> Audit
              </span>
              <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
            </Link>
            <Link
              href="/accounts"
              className="flex items-center justify-between p-2 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white font-medium"
            >
              <span className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-turquoise" /> Billing
              </span>
              <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
            </Link>
            <button
              type="button"
              onClick={() => logoutUser(router)}
              className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-magenta/10 text-magenta font-bold text-left cursor-pointer transition-colors"
            >
              <span className="flex items-center gap-2">
                <Power className="h-4 w-4" /> Log Out
              </span>
            </button>
          </div>
        </div>
      </aside>

      {/* RIGHT MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-platinum text-void">
        {children}
      </div>
    </div>
  );
}
