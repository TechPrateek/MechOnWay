"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Wrench,
  Menu,
  X,
  AlertCircle,
  Car,
  UserCheck,
  History,
  PhoneCall,
} from "lucide-react";
import { Button } from "@/components/common/button";
import { cn } from "@/lib/utils";

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const isCustomerPortal = pathname.startsWith("/customer");
  const isMechanicPortal = pathname.startsWith("/mechanic");

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:bg-slate-950/90 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Brand Logo */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-slate-950 dark:bg-white flex items-center justify-center text-amber-400 dark:text-slate-950 shadow-sm transition-transform group-hover:scale-105">
                <Wrench className="w-5 h-5 -rotate-45" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg tracking-tight text-slate-950 dark:text-white flex items-center gap-1.5">
                  MechOnWay
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-wide uppercase -mt-0.5">
                  Roadside Dispatch
                </span>
              </div>
            </Link>

            {/* Region Live Telemetry */}
            <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="font-medium">SF Metro Area</span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="text-slate-500 dark:text-slate-400">184 Verified Units</span>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-slate-600 dark:text-slate-300">
            <Link
              href="/"
              className={cn(
                "px-3 py-2 rounded-lg hover:text-slate-950 dark:hover:text-white transition-colors",
                pathname === "/" && "text-slate-950 dark:text-white font-semibold bg-slate-100 dark:bg-slate-800"
              )}
            >
              Overview
            </Link>
            <Link
              href="/#services"
              className="px-3 py-2 rounded-lg hover:text-slate-950 dark:hover:text-white transition-colors"
            >
              Services
            </Link>
            <Link
              href="/#how-it-works"
              className="px-3 py-2 rounded-lg hover:text-slate-950 dark:hover:text-white transition-colors"
            >
              How It Works
            </Link>
            <Link
              href="/customer"
              className={cn(
                "px-3 py-2 rounded-lg hover:text-slate-950 dark:hover:text-white transition-colors flex items-center gap-1.5",
                isCustomerPortal && "text-slate-950 dark:text-white font-semibold bg-slate-100 dark:bg-slate-800"
              )}
            >
              <Car className="w-4 h-4 text-slate-500" />
              Customer Portal
            </Link>
            <Link
              href="/mechanic"
              className={cn(
                "px-3 py-2 rounded-lg hover:text-slate-950 dark:hover:text-white transition-colors flex items-center gap-1.5",
                isMechanicPortal && "text-slate-950 dark:text-white font-semibold bg-slate-100 dark:bg-slate-800"
              )}
            >
              <UserCheck className="w-4 h-4 text-slate-500" />
              Mechanic Portal
            </Link>
            <Link
              href="/history"
              className={cn(
                "px-3 py-2 rounded-lg hover:text-slate-950 dark:hover:text-white transition-colors flex items-center gap-1.5",
                pathname === "/history" && "text-slate-950 dark:text-white font-semibold bg-slate-100 dark:bg-slate-800"
              )}
            >
              <History className="w-4 h-4 text-slate-500" />
              History
            </Link>
          </nav>

          {/* Action CTAs */}
          <div className="hidden sm:flex items-center gap-3">
            <Link href="/customer/request">
              <Button
                variant="emergency"
                size="md"
                leftIcon={<AlertCircle className="w-4 h-4" />}
                className="shadow-sm"
              >
                Request Assistance
              </Button>
            </Link>
          </div>

          {/* Mobile menu trigger */}
          <div className="flex md:hidden items-center gap-2">
            <Link href="/customer/request">
              <Button variant="emergency" size="sm">
                Request
              </Button>
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-950 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 bg-white dark:bg-slate-950 dark:border-slate-800 px-4 pt-2 pb-6 space-y-2">
          <div className="py-2 px-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between text-slate-600 dark:text-slate-300 mb-3">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              SF Bay Area Network
            </span>
            <span className="font-semibold text-slate-900 dark:text-white">184 Online</span>
          </div>

          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900"
          >
            Overview
          </Link>
          <Link
            href="/customer/request"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-base font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30"
          >
            🚨 Emergency Breakdown Request
          </Link>
          <Link
            href="/customer"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900"
          >
            Customer Dashboard
          </Link>
          <Link
            href="/mechanic"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900"
          >
            Mechanic Dashboard & Queue
          </Link>
          <Link
            href="/history"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900"
          >
            Service History & Invoices
          </Link>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
            <a
              href="tel:+18005556324"
              className="flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium rounded-lg text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900"
            >
              <PhoneCall className="w-4 h-4 text-slate-500" />
              Toll-Free Helpline (1-800-555-MECH)
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
