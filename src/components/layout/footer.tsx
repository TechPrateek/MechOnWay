import React from "react";
import Link from "next/link";
import { Wrench, ShieldCheck, Clock, MapPin, Phone } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-400 border-t border-slate-800 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand Col */}
          <div className="md:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-slate-950">
                <Wrench className="w-5 h-5 -rotate-45" />
              </div>
              <span className="font-bold text-xl text-white tracking-tight">
                MechOnWay
              </span>
            </Link>
            <p className="text-slate-300 font-medium text-base">
              Help when your vehicle stops.
            </p>
            <p className="text-slate-400 max-w-md text-xs leading-relaxed">
              Algorithmic roadside assistance matching motorists with nearby verified,
              equipped, and certified mobile mechanics. Guaranteed upfront rates,
              live telemetry tracking, and zero highway surcharges.
            </p>

            <div className="flex flex-wrap gap-4 pt-2 text-xs text-slate-300">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>100% Insured & Vetted</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Average 18-min Response</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-blue-400" />
                <span>Real-Time GPS Dispatch</span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              Assistance & Portals
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link
                  href="/customer/request"
                  className="hover:text-amber-400 transition-colors flex items-center gap-1"
                >
                  <span className="text-amber-400">●</span> Request Emergency Help
                </Link>
              </li>
              <li>
                <Link
                  href="/customer"
                  className="hover:text-white transition-colors"
                >
                  Customer Dashboard
                </Link>
              </li>
              <li>
                <Link
                  href="/mechanic"
                  className="hover:text-white transition-colors"
                >
                  Mechanic Workbench
                </Link>
              </li>
              <li>
                <Link
                  href="/history"
                  className="hover:text-white transition-colors"
                >
                  Request History & Receipts
                </Link>
              </li>
              <li>
                <Link
                  href="/#services"
                  className="hover:text-white transition-colors"
                >
                  Available Services
                </Link>
              </li>
              <li>
                <Link
                  href="/#how-it-works"
                  className="hover:text-white transition-colors"
                >
                  How Matching Works
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact & Support */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              24/7 Roadside Hotline
            </h4>
            <p className="text-xs text-slate-400">
              Stranded in a low-connectivity area? Call dispatch directly:
            </p>
            <a
              href="tel:+18005556324"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white font-mono text-sm hover:border-amber-500/50 transition-colors"
            >
              <Phone className="w-4 h-4 text-amber-400" />
              1-800-555-MECH
            </a>
            <p className="text-[11px] text-slate-500">
              Operating continuously across the SF Bay Area metropolitan corridor.
            </p>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} MechOnWay Inc. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/customer/request" className="hover:text-slate-400">
              Instant Dispatch
            </Link>
            <Link href="/customer" className="hover:text-slate-400">
              Saved Vehicles
            </Link>
            <Link href="/mechanic" className="hover:text-slate-400">
              Mechanic Onboarding
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
