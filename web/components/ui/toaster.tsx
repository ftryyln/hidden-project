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
    <div className="fixed bottom-6 right-6 z-[100] flex w-full max-w-sm flex-col gap-3">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={handleClose} />
      ))}
    </div>
  );
}
