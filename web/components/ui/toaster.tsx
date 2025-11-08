"use client";

import { useEffect, useState } from "react";
import { subscribeToast, Toast as ToastProps } from "./use-toast";
import { Toast } from "./toast";

export function Toaster() {
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToast((toast) => {
      setToasts((items) => {
        const exists = items.find((item) => item.id === toast.id);
        if (exists) return items;
        return [...items, toast];
      });
    });
    return unsubscribe;
  }, []);

  const handleClose = (id: string) => {
    setToasts((items) => items.filter((item) => item.id !== id));
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-3 px-4 sm:bottom-6 sm:items-end">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={handleClose} />
      ))}
    </div>
  );
}
