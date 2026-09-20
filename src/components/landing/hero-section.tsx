import React from "react";
import Link from "next/link";
import { QuickDispatchWidget } from "./quick-dispatch-widget";
import { Star, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/common/button";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-8 pb-16 lg:pt-16 lg:pb-24 bg-gradient-to-b from-slate-50 via-white to-white dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 border-b border-slate-200/60 dark:border-slate-800">
      {/* Subtle grid pattern background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000008_1px,transparent_1px),linear-gradient(to_bottom,#00000008_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Value Proposition & Brand Pitch */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-semibold tracking-wide">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>LIVE DISPATCH NETWORK ACTIVE</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-950 dark:text-white tracking-tight leading-[1.08]">
              Help when your <br className="hidden sm:inline" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 dark:from-amber-400 dark:to-amber-500">
                vehicle stops.
              </span>
            </h1>

            <p className="text-lg text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed">
              Stranded on a highway, parking garage, or neighborhood street?
              MechOnWay matches you with the nearest qualified, equipped mobile
              mechanic based on your exact vehicle and breakdown type.
            </p>

            {/* Core differentiators bullet list */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-sm text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Zero annual membership fees</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Guaranteed fixed upfront rates</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>EV, SUV, Truck & Hybrid certified</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Uber-style live mechanic GPS tracking</span>
              </div>
            </div>

            {/* Real telemetry stats bar */}
            <div className="pt-6 border-t border-slate-200/80 dark:border-slate-800 grid grid-cols-3 gap-4 max-w-lg">
              <div>
                <p className="text-2xl sm:text-3xl font-bold font-mono text-slate-950 dark:text-white">
                  18 min
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  Avg Arrival Time
                </p>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-bold font-mono text-slate-950 dark:text-white">
                  100%
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  Vetted Mechanics
                </p>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-bold font-mono text-amber-500 flex items-center gap-1">
                  4.95 <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  Verified Ratings
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-2">
              <Link href="/customer">
                <Button variant="secondary" size="md">
                  View Customer Portal
                </Button>
              </Link>
              <Link href="/mechanic">
                <Button variant="ghost" size="md">
                  Join as Certified Mechanic →
                </Button>
              </Link>
            </div>
          </div>

          {/* Right Column: Dispatch Input Widget */}
          <div className="lg:col-span-5">
            <QuickDispatchWidget />
          </div>
        </div>
      </div>
    </section>
  );
}
