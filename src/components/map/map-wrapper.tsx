"use client";

import React from "react";
import dynamic from "next/dynamic";
import { RoadsideMapProps } from "./roadside-map";

const DynamicRoadsideMap = dynamic(
  () => import("./roadside-map").then((mod) => mod.RoadsideMap),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 p-8 text-center text-xs text-slate-500 flex flex-col items-center justify-center min-h-[280px] space-y-2">
        <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <span>Initializing OpenStreetMap canvas...</span>
      </div>
    ),
  }
);

export function RoadsideMapWrapper(props: RoadsideMapProps) {
  return <DynamicRoadsideMap {...props} />;
}
