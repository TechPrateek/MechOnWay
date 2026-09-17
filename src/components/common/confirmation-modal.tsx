"use client";

import React, { useEffect, useRef } from "react";
import { X, AlertTriangle, Info } from "lucide-react";
import { Button } from "./button";

export interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "primary" | "emergency" | "danger" | "warning";
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "primary",
  isLoading = false,
  icon,
}: ConfirmationModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isLoading) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const getIcon = () => {
    if (icon) return icon;
    switch (variant) {
      case "danger":
        return <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400" />;
      case "emergency":
        return <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />;
      case "warning":
        return <AlertTriangle className="w-6 h-6 text-amber-500" />;
      default:
        return <Info className="w-6 h-6 text-blue-600 dark:text-blue-400" />;
    }
  };

  const getButtonVariant = () => {
    switch (variant) {
      case "danger":
        return "danger";
      case "emergency":
        return "emergency";
      default:
        return "primary";
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
        onClick={() => {
          if (!isLoading) onClose();
        }}
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div
        ref={modalRef}
        className="relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 sm:p-7 z-10 space-y-5 animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
              {getIcon()}
            </div>
            <div>
              <h3
                id="modal-title"
                className="text-lg font-bold text-slate-950 dark:text-white tracking-tight"
              >
                {title}
              </h3>
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                Confirmation Required
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
            <span className="sr-only">Close</span>
          </button>
        </div>

        <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          {description}
        </div>

        <div className="pt-2 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            {cancelText}
          </Button>

          <Button
            type="button"
            variant={getButtonVariant()}
            size="sm"
            onClick={onConfirm}
            isLoading={isLoading}
            className="w-full sm:w-auto font-bold"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
