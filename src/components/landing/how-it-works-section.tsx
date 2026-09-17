import React from "react";
import { MapPin, Cpu, Navigation, Check } from "lucide-react";

export function HowItWorksSection() {
  const steps = [
    {
      number: "01",
      title: "Select Breakdown & Pin Location",
      description:
        "Choose your emergency issue (tire, battery, mechanical breakdown, towing) and confirm your exact GPS coordinates or street landmark.",
      icon: MapPin,
      badge: "30 Seconds",
      details: ["Automatic GPS pinpointing", "Vehicle specs auto-matched", "Photo upload optional"],
    },
    {
      number: "02",
      title: "Algorithmic Capability Matching",
      description:
        "Our engine filters nearby mechanics by distance, live availability, tool inventory, and specific vehicle certifications (e.g. EV battery packs, heavy-duty towing).",
      icon: Cpu,
      badge: "Real-time AI Match",
      details: ["Tool & rig validation", "Certified background-checked techs", "Upfront locked price"],
    },
    {
      number: "03",
      title: "Live GPS Telemetry & Repair",
      description:
        "Watch your mechanic drive to you in real-time. Review diagnostic reports on your phone, approve any extra parts, and get safely back on the road.",
      icon: Navigation,
      badge: "18-Min Arrival",
      details: ["Turn-by-turn map radar", "Direct in-app mechanic contact", "Digital invoice & warranty"],
    },
  ];

  return (
    <section id="how-it-works" className="py-16 lg:py-24 bg-white dark:bg-slate-950 border-b border-slate-200/60 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
            Intelligent Dispatch Pipeline
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950 dark:text-white tracking-tight">
            How MechOnWay gets you moving
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base">
            No waiting on hold with call centers. No arbitrary highway towing markups.
            Pure algorithmic dispatch directly to equipped mobile mechanics.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className="relative bg-slate-50/70 dark:bg-slate-900/50 rounded-2xl p-7 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="font-mono text-3xl font-black text-slate-300 dark:text-slate-700">
                      {step.number}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                      {step.badge}
                    </span>
                  </div>

                  <div className="w-12 h-12 rounded-xl bg-slate-950 dark:bg-white text-amber-400 dark:text-slate-950 flex items-center justify-center mb-5 shadow-sm">
                    <Icon className="w-6 h-6" />
                  </div>

                  <h3 className="text-lg font-bold text-slate-950 dark:text-white tracking-tight mb-2">
                    {step.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
                    {step.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800/80 space-y-2">
                  {step.details.map((detail) => (
                    <div key={detail} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>{detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
