"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";

interface ToastProps {
  id: string;
  title?: ReactNode;
  description?: ReactNode;
  duration?: number;
  onClose: (id: string) => void;
}

export function Toast({ id, title, description, duration = 4000, onClose }: ToastProps) {
  useEffect(() => {
    const timeout = setTimeout(() => onClose(id), duration);
    return () => clearTimeout(timeout);
  }, [duration, id, onClose]);

  return (
    <div
      className={cn(
        "relative flex w-full min-w-[280px] max-w-sm flex-col gap-1 rounded-2xl border border-border/60 bg-card/95 p-4 text-sm shadow-lg backdrop-blur transition-all duration-200",
      )}
    >
      <button
        onClick={() => onClose(id)}
        className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      {title && <p className="font-semibold text-foreground">{title}</p>}
      {description && <p className="text-muted-foreground">{description}</p>}
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
