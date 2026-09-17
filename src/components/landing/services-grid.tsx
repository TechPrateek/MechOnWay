import React from "react";
import Link from "next/link";
import {
  Disc,
  Zap,
  Wrench,
  Truck,
  Fuel,
  Key,
  Anchor,
  Clock,
  ArrowRight,
} from "lucide-react";
import { SERVICE_METAS } from "@/lib/data/mock-data";
import { formatCurrency } from "@/lib/utils";

const ICONS: Record<string, React.ElementType> = {
  Disc,
  Zap,
  Wrench,
  Truck,
  Fuel,
  Key,
  Anchor,
};

export function ServicesGrid() {
  const services = Object.values(SERVICE_METAS);

  return (
    <section id="services" className="py-16 lg:py-24 bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-200/60 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="space-y-3 max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
              Roadside Capabilities
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950 dark:text-white tracking-tight">
              Whatever stops you, we can fix.
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base">
              Every dispatched unit is a self-contained mobile workshop outfitted
              with commercial tools, diagnostic computers, and OEM replacement fluids.
            </p>
          </div>

          <Link
            href="/customer/request"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white hover:text-amber-600 dark:hover:text-amber-400 transition-colors shrink-0"
          >
            <span>See all dispatch options</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => {
            const Icon = ICONS[service.iconName] || Wrench;
            return (
              <div
                key={service.type}
                className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm transition-all duration-200 flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white flex items-center justify-center group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-emerald-500" />
                      <span>~{service.typicalEtaMinutes} min arrival</span>
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-slate-950 dark:text-white mb-1">
                    {service.name}
                  </h3>
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-2.5">
                    {service.tagline}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                    {service.description}
                  </p>

                  <div className="flex flex-wrap gap-1.5 mb-6">
                    {service.requiredEquipment.map((eq) => (
                      <span
                        key={eq}
                        className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700"
                      >
                        {eq}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">
                      Starting From
                    </span>
                    <p className="text-lg font-bold font-mono text-slate-950 dark:text-white">
                      {formatCurrency(service.estimatedBasePrice)}
                    </p>
                  </div>
                  <Link
                    href={`/customer/request?service=${service.type}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-950 text-xs font-semibold hover:opacity-90 transition-opacity"
                  >
                    <span>Request</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
