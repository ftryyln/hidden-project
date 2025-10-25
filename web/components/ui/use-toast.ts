"use client";

import * as React from "react";

export type ToastActionElement = React.ReactElement<any, string | React.JSXElementConstructor<any>>;

export type ToastVariant = "default" | "success" | "destructive";

export interface Toast {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
  duration?: number;
  variant?: ToastVariant;
}

type ToasterToast = Toast;

const listeners: Array<(toast: ToasterToast) => void> = [];

export function useToast() {
  return React.useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = crypto.randomUUID();
      const item = { id, ...toast };
      listeners.forEach((listener) => listener(item));
      return id;
    },
    [],
  );
}

export function subscribeToast(callback: (toast: ToasterToast) => void) {
  listeners.push(callback);
  return () => {
    const index = listeners.indexOf(callback);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  };
}
