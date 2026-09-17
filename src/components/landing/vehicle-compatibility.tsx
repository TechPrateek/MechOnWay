import React from "react";
import { Car, Zap, Truck, Bike, Check } from "lucide-react";

export function VehicleCompatibility() {
  const categories = [
    {
      type: "Electric Vehicles (EVs)",
      icon: Zap,
      badge: "High-Voltage Certified",
      makes: "Tesla, Rivian, Lucid, Hyundai Ioniq, Ford Mach-E, Porsche Taycan",
      highlights: [
        "J1772 & NACS emergency roadside DC boosters",
        "12V low-voltage auxiliary reboot packs",
        "Low-clearance wheel dollies for locked electric drivetrains",
      ],
    },
    {
      type: "SUVs & Crossovers",
      icon: Car,
      badge: "AWD & 4x4 Ready",
      makes: "Toyota RAV4 / Highlander, Honda CR-V, Jeep Grand Cherokee, Subaru Outback",
      highlights: [
        "Flatbed rollback towing for AWD differentials",
        "High-lift hydraulic off-camber jacks",
        "On-site runflat bead seating",
      ],
    },
    {
      type: "Pickup Trucks & Commercial",
      icon: Truck,
      badge: "Heavy-Duty Capacity",
      makes: "Ford F-150 / F-250, Chevy Silverado, Ram 1500, Mercedes Sprinter, Transit",
      highlights: [
        "12,000-lb synthetic winch recovery systems",
        "Commercial diesel priming & DEF fluid delivery",
        "Heavy-duty lug torque up to 450 ft-lbs",
      ],
    },
    {
      type: "Motorcycles & Scooters",
      icon: Bike,
      badge: "Wheel-Chock Secured",
      makes: "Harley-Davidson, Honda, Yamaha, BMW Motorrad, Ducati, Zero",
      highlights: [
        "Specialized motorcycle wheel chocks and soft ratchet straps",
        "12V miniature AGM jump batteries",
        "Tubeless motorcycle tire plug kits",
      ],
    },
  ];

  return (
    <section className="py-16 lg:py-24 bg-white dark:bg-slate-950 border-b border-slate-200/60 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-16">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
            Universal Fleet Compatibility
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950 dark:text-white tracking-tight">
            Engineered for what you drive.
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base">
            Never worry whether the tow truck has the right equipment or understands
            your high-voltage EV. Our algorithm only dispatches certified compatible rigs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <div
                key={cat.type}
                className="bg-slate-50/70 dark:bg-slate-900/60 rounded-2xl p-7 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-white text-amber-400 dark:text-slate-950 flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                      {cat.badge}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-950 dark:text-white mb-2">
                    {cat.type}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 font-mono">
                    Common models: {cat.makes}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800/80 space-y-2.5">
                  {cat.highlights.map((h) => (
                    <div key={h} className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{h}</span>
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
