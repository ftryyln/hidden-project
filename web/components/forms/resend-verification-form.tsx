"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { toApiError } from "@/lib/api/errors";

const resendSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type ResendSchema = z.infer<typeof resendSchema>;

interface ResendVerificationFormProps {
  defaultEmail?: string | null;
}

export function ResendVerificationForm({
  defaultEmail,
}: ResendVerificationFormProps) {
  const toast = useToast();

  const form = useForm<ResendSchema>({
    resolver: zodResolver(resendSchema),
    defaultValues: {
      email: defaultEmail ?? "",
    },
  });

  useEffect(() => {
    if (defaultEmail) {
      form.setValue("email", defaultEmail);
    }
  }, [defaultEmail, form]);

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        throw await toApiError(response);
      }

      const message =
        (await response
          .json()
          .catch(() => ({ message: undefined })))?.message ??
        "Verification email sent. Please check your inbox.";

      toast({
        title: "Verification email resent",
        description: message,
      });
    } catch (error) {
      const apiError = await toApiError(error);
      toast({
        title: "Unable to resend verification email",
        description: apiError.message,
      });
    }
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          {...form.register("email")}
        />
        {form.formState.errors.email && (
          <p className="text-xs text-destructive">
            {form.formState.errors.email.message}
          </p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Sending�?�" : "Resend verification email"}
      </Button>
    </form>
  );
}
