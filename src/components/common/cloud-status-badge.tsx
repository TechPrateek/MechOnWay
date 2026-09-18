"use client";

import React, { useSyncExternalStore } from "react";
import { Database, Wifi } from "lucide-react";
import { isApiConfigured, getApiBaseUrl } from "@/lib/api/client";

const emptySubscribe = () => () => {};

export function CloudStatusBadge() {
  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const isCloud = isMounted ? isApiConfigured() : false;
  const apiUrl = isMounted ? getApiBaseUrl() : "";

  if (!isMounted) {
    return (
      <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-500">
        <Database className="w-3 h-3" />
        <span>Storage: Local</span>
      </div>
    );
  }

  if (isCloud) {
    return (
      <div
        className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
        title={`Connected to AWS API Gateway: ${apiUrl}`}
      >
        <Wifi className="w-3 h-3 text-emerald-600 animate-pulse" />
        <span>AWS API Gateway</span>
      </div>
    );
  }

  return (
    <div
      className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
      title="Running in local standalone mode. Set NEXT_PUBLIC_API_BASE_URL to connect to deployed AWS API Gateway."
    >
      <Database className="w-3 h-3 text-slate-500" />
      <span>Local Repository</span>
    </div>
  );
}
