import React from "react";
import Link from "next/link";
import { ShieldCheck, DollarSign, Navigation, PhoneCall, AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/common/button";

export function TrustSafetySection() {
  const pillars = [
    {
      title: "100% Background Checked & Insured",
      description:
        "Every technician undergoes strict DMV driving record audits, 10-panel background screening, and carries $2,000,000 in comprehensive commercial liability coverage.",
      icon: ShieldCheck,
      iconColor: "text-emerald-500",
    },
    {
      title: "Upfront Locked Pricing",
      description:
        "You see the exact price before dispatching. No surge pricing during rainstorms, no surprise 'hook-up fees', and no hidden mileage markups.",
      icon: DollarSign,
      iconColor: "text-amber-500",
    },
    {
      title: "Uber-Style Live Telemetry",
      description:
        "Share a live tracking link with family or friends. Watch your technician's exact vehicle approach on the map with calibrated ETA and driver identity badges.",
      icon: Navigation,
      iconColor: "text-blue-500",
    },
    {
      title: "Highway Safety & Masked Numbers",
      description:
        "Communicate safely through masked phone relays. Receive real-time roadside safety instructions while waiting inside or beside your vehicle.",
      icon: PhoneCall,
      iconColor: "text-purple-500",
    },
  ];

  return (
    <section className="py-16 lg:py-24 bg-slate-900 text-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-3xl mx-auto text-center space-y-3 mb-16">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20">
            Trust & Safety Standard
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Roadside help should never feel risky.
          </h2>
          <p className="text-slate-400 text-sm sm:text-base">
            We built MechOnWay after experiencing predatory towing rates and
            unqualified operators firsthand. Our standards are non-negotiable.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.title}
                className="bg-slate-800/60 rounded-2xl p-7 border border-slate-700/80 hover:border-slate-600 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center mb-5 border border-slate-700">
                  <Icon className={`w-6 h-6 ${pillar.iconColor}`} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{pillar.title}</h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  {pillar.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Emergency Callout Banner */}
        <div className="rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 p-8 sm:p-10 text-slate-950 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-950 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Are You Currently Stranded?</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Get an equipped mobile mechanic on the way now.
            </h3>
            <p className="text-sm font-medium text-slate-900 max-w-xl">
              Average dispatch takes under 45 seconds. No account creation or pre-payment needed.
            </p>
          </div>

          <Link href="/customer/request" className="shrink-0 w-full md:w-auto">
            <Button
              variant="primary"
              size="lg"
              className="w-full md:w-auto bg-slate-950 text-white hover:bg-slate-900 font-bold border-none"
              rightIcon={<ArrowRight className="w-5 h-5" />}
            >
              Dispatch Roadside Help
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
