import React from "react";
import { HeroSection } from "@/components/landing/hero-section";
import { ServicesGrid } from "@/components/landing/services-grid";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { VehicleCompatibility } from "@/components/landing/vehicle-compatibility";
import { TrustSafetySection } from "@/components/landing/trust-safety-section";

export default function HomePage() {
  return (
    <div className="flex flex-col w-full">
      <HeroSection />
      <ServicesGrid />
      <HowItWorksSection />
      <VehicleCompatibility />
      <TrustSafetySection />
    </div>
  );
}
