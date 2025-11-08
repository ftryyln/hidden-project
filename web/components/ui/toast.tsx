"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import type { ToastVariant } from "./use-toast";

interface ToastProps {
  id: string;
  title?: ReactNode;
  description?: ReactNode;
  duration?: number;
  variant?: ToastVariant;
  onClose: (id: string) => void;
}

const variantStyles: Record<ToastVariant, string> = {
  default: "border-border/60 bg-card/95 text-foreground",
  success: "border-emerald-500/50 bg-emerald-500/10 text-emerald-50",
  destructive: "border-destructive/60 bg-destructive/10 text-destructive-foreground",
};

const titleStyles: Record<ToastVariant, string> = {
  default: "text-foreground",
  success: "text-emerald-50",
  destructive: "text-destructive-foreground",
};

const descriptionStyles: Record<ToastVariant, string> = {
  default: "text-muted-foreground",
  success: "text-emerald-100/80",
  destructive: "text-destructive-foreground/90",
};

export function Toast({
  id,
  title,
  description,
  duration = 4000,
  variant = "default",
  onClose,
}: ToastProps) {
  useEffect(() => {
    const timeout = setTimeout(() => onClose(id), duration);
    return () => clearTimeout(timeout);
  }, [duration, id, onClose]);

  return (
    <div
      className={cn(
        "pointer-events-auto relative flex w-full max-w-sm flex-col gap-1 rounded-2xl border p-4 text-sm shadow-lg backdrop-blur transition-all duration-200",
        variantStyles[variant],
      )}
    >
      <button
        onClick={() => onClose(id)}
        className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      {title && <p className={cn("font-semibold", titleStyles[variant])}>{title}</p>}
      {description && (
        <p className={cn("text-sm leading-snug", descriptionStyles[variant])}>{description}</p>
      )}
    </div>
  );
}

export function useToastQueue() {
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  const removeToast = (id: string) => {
    setToasts((items) => items.filter((toast) => toast.id !== id));
  };

  const addToast = (toast: Omit<ToastProps, "onClose">) => {
    setToasts((items) => [...items, { ...toast, onClose: removeToast }]);
  };

  return { toasts, addToast, removeToast };
}
