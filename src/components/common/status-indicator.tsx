import React from "react";
import { cn } from "@/lib/utils";
import { RequestStatus } from "@/types";
import { CheckCircle2, Clock, MapPin, Truck, AlertTriangle, XCircle, Wrench } from "lucide-react";

interface StatusIndicatorProps {
  status: RequestStatus;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export function StatusIndicator({
  status,
  size = "md",
  showLabel = true,
}: StatusIndicatorProps) {
  const configs: Record<
    RequestStatus,
    {
      label: string;
      color: string;
      bgColor: string;
      icon: React.ElementType;
    }
  > = {
    SEARCHING: {
      label: "Searching for Mechanic",
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-500",
      icon: Clock,
    },
    MATCHED: {
      label: "Mechanic Matched",
      color: "text-indigo-600 dark:text-indigo-400",
      bgColor: "bg-indigo-500",
      icon: MapPin,
    },
    REQUESTED: {
      label: "Dispatch Requested",
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-500",
      icon: Clock,
    },
    ACCEPTED: {
      label: "Order Accepted",
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-500",
      icon: CheckCircle2,
    },
    ON_THE_WAY: {
      label: "Mechanic En Route",
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-500",
      icon: Truck,
    },
    ARRIVED: {
      label: "Arrived On Site",
      color: "text-teal-600 dark:text-teal-400",
      bgColor: "bg-teal-500",
      icon: CheckCircle2,
    },
    IN_SERVICE: {
      label: "Service In Progress",
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-500",
      icon: Wrench,
    },
    COMPLETED: {
      label: "Completed",
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-500",
      icon: CheckCircle2,
    },
    CANCELLED: {
      label: "Cancelled",
      color: "text-rose-600 dark:text-rose-400",
      bgColor: "bg-rose-500",
      icon: XCircle,
    },
    NO_MECHANIC_AVAILABLE: {
      label: "No Mechanic Available",
      color: "text-slate-600 dark:text-slate-400",
      bgColor: "bg-slate-500",
      icon: AlertTriangle,
    },
    // Legacy aliases
    pending: {
      label: "Searching for Mechanic",
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-500",
      icon: Clock,
    },
    matching: {
      label: "Matching Mechanic",
      color: "text-indigo-600 dark:text-indigo-400",
      bgColor: "bg-indigo-500",
      icon: MapPin,
    },
    dispatched: {
      label: "Mechanic En Route",
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-500",
      icon: Truck,
    },
    arrived: {
      label: "Arrived On Site",
      color: "text-teal-600 dark:text-teal-400",
      bgColor: "bg-teal-500",
      icon: CheckCircle2,
    },
    in_progress: {
      label: "Service In Progress",
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-500",
      icon: Wrench,
    },
    completed: {
      label: "Completed",
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-500",
      icon: CheckCircle2,
    },
    cancelled: {
      label: "Cancelled",
      color: "text-rose-600 dark:text-rose-400",
      bgColor: "bg-rose-500",
      icon: XCircle,
    },
  };

  const config = configs[status] || {
    label: status,
    color: "text-slate-600",
    bgColor: "bg-slate-400",
    icon: AlertTriangle,
  };

  const Icon = config.icon;
  const isPulsing =
    status === "SEARCHING" ||
    status === "matching" ||
    status === "pending" ||
    status === "ON_THE_WAY" ||
    status === "dispatched" ||
    status === "ARRIVED" ||
    status === "IN_SERVICE" ||
    status === "in_progress";

  return (
    <div className="inline-flex items-center gap-2">
      <span className="relative flex h-2.5 w-2.5">
        {isPulsing && (
          <span
            className={cn(
              "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
              config.bgColor
            )}
          />
        )}
        <span
          className={cn(
            "relative inline-flex rounded-full h-2.5 w-2.5",
            config.bgColor
          )}
        />
      </span>
      {showLabel && (
        <span
          className={cn(
            "font-medium inline-flex items-center gap-1",
            size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-sm",
            config.color
          )}
        >
          <Icon className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
          <span>{config.label}</span>
        </span>
      )}
    </div>
  );
}
