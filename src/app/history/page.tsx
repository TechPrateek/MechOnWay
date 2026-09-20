"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Wrench,
  Search,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/common/button";
import { StatusIndicator } from "@/components/common/status-indicator";
import { apiClient } from "@/lib/api/client";
import { RoadsideRequest } from "@/types";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { normalizeRequestStatus } from "@/lib/lifecycle/status-machine";

export default function HistoryPage() {
  const [requests, setRequests] = useState<RoadsideRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  React.useEffect(() => {
    let mounted = true;
    apiClient.requests.list()
      .then((data) => {
        if (mounted && Array.isArray(data)) {
          setRequests(data);
        }
      })
      .catch((err) => {
        console.error("Failed to load history from AWS API:", err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = requests.filter((r) => {
    const norm = normalizeRequestStatus(r.status);
    const matchesStatus =
      statusFilter === "all"
        ? true
        : statusFilter === "active"
        ? norm !== "COMPLETED" && norm !== "CANCELLED"
        : norm === statusFilter.toUpperCase();

    const term = searchQuery.toLowerCase();
    const matchesSearch =
      !term ||
      r.id.toLowerCase().includes(term) ||
      r.serviceType.toLowerCase().includes(term) ||
      (r.vehicle.make || "").toLowerCase().includes(term) ||
      (r.vehicle.model || "").toLowerCase().includes(term) ||
      r.location.address.toLowerCase().includes(term) ||
      (r.assignedMechanic?.name || "").toLowerCase().includes(term);

    return matchesStatus && matchesSearch;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 lg:py-12 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 dark:text-white tracking-tight">
            Assistance History & Invoices
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Complete record of your roadside dispatches, diagnostic reports, and digital receipts.
          </p>
        </div>

        <Link href="/customer/request">
          <Button variant="emergency" size="md" leftIcon={<AlertCircle className="w-4 h-4" />}>
            Request Assistance
          </Button>
        </Link>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by vehicle, breakdown issue, mechanic, or location..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border ${
              statusFilter === "all"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950 border-slate-900 dark:border-white"
                : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900"
            }`}
          >
            All ({requests.length})
          </button>
          <button
            onClick={() => setStatusFilter("active")}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border ${
              statusFilter === "active"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950 border-slate-900 dark:border-white"
                : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900"
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setStatusFilter("completed")}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border ${
              statusFilter === "completed"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950 border-slate-900 dark:border-white"
                : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900"
            }`}
          >
            Completed
          </button>
        </div>
      </div>

      {/* Results List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-slate-500 text-sm animate-pulse">
            Loading service history from AWS...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-slate-500 text-sm">
            No roadside requests match your filter.
          </div>
        ) : (
          filtered.map((req) => (
            <div
              key={req.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-amber-500 shrink-0 mt-0.5">
                    <Wrench className="w-5 h-5 -rotate-45" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                        #{req.id}
                      </span>
                      <h3 className="text-base font-bold text-slate-950 dark:text-white">
                        {req.serviceType.replace("_", " ").toUpperCase()}
                      </h3>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs text-slate-500">
                        {req.vehicle.year} {req.vehicle.make} {req.vehicle.model}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {req.location.address}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 justify-between sm:justify-end">
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">Total Billed</span>
                    <span className="font-mono font-bold text-base text-slate-900 dark:text-white">
                      {formatCurrency(req.finalPrice || req.estimatedPrice)}
                    </span>
                  </div>
                  <StatusIndicator status={req.status} size="sm" />
                </div>
              </div>

              {/* Details strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600 dark:text-slate-400">
                <div>
                  <span className="text-slate-400">Date:</span>{" "}
                  <span className="font-medium text-slate-900 dark:text-white">
                    {formatDateTime(req.createdAt)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Technician:</span>{" "}
                  <span className="font-medium text-slate-900 dark:text-white">
                    {req.assignedMechanic?.name || "Pending Assignment"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Vehicle Plate:</span>{" "}
                  <span className="font-mono font-medium text-slate-900 dark:text-white">
                    {req.vehicle.licensePlate} ({req.vehicle.type})
                  </span>
                </div>
              </div>

              {req.diagnosticNotes && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs text-slate-700 dark:text-slate-300">
                  <span className="font-bold text-slate-900 dark:text-white">
                    Diagnostic Summary:
                  </span>{" "}
                  {req.diagnosticNotes}
                </div>
              )}

              <div className="pt-2 flex items-center justify-between">
                <Link
                  href={`/customer/request?service=${req.serviceType}`}
                  className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                >
                  Repeat this service →
                </Link>

                <div className="flex items-center gap-2">
                  <Link href={`/customer/track/${req.id}`}>
                    <Button variant="outline" size="sm">
                      View Dispatch Track
                    </Button>
                  </Link>
                  <Link href={`/mechanic/requests/${req.id}`}>
                    <Button variant="secondary" size="sm">
                      Job Sheet
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
