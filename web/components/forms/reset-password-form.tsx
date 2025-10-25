import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toApiError } from "@/lib/api/errors";
import { useAuth } from "@/hooks/use-auth";

const resetSchema = z
  .object({
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(6, "Password confirmation is required"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ResetSchema = z.infer<typeof resetSchema>;

interface ResetPasswordFormProps {
  credentials: {
    code?: string;
    access_token?: string;
    refresh_token?: string | null;
  };
}

export function ResetPasswordForm({ credentials }: ResetPasswordFormProps) {
  const hasCode = Boolean(credentials.code);
  const hasAccessToken = Boolean(credentials.access_token);
  if (!hasCode && !hasAccessToken) {
    throw new Error("ResetPasswordForm rendered without credentials");
  }

  const toast = useToast();
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<ResetSchema>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      const payload: Record<string, string> = {
        new_password: values.password,
      };
      if (credentials.code) {
        payload.code = credentials.code;
      }
      if (credentials.access_token) {
        payload.access_token = credentials.access_token;
        if (credentials.refresh_token) {
          payload.refresh_token = credentials.refresh_token;
        }
      }

      const response = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw await toApiError(response);
      }

      await refreshProfile();
      toast({
        title: "Password updated",
        description: "You can now continue using Guild Manager.",
      });
      router.replace("/dashboard");
    } catch (error) {
      const apiError = await toApiError(error);
      toast({
        title: "Failed to reset password",
        description: apiError.message,
      });
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          {...form.register("password")}
        />
        {form.formState.errors.password && (
          <p className="text-xs text-destructive">
            {form.formState.errors.password.message}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input
          id="confirmPassword"
          type="password"
          placeholder="••••••••"
          {...form.register("confirmPassword")}
        />
        {form.formState.errors.confirmPassword && (
          <p className="text-xs text-destructive">
            {form.formState.errors.confirmPassword.message}
          </p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Updating password…" : "Update password"}
      </Button>
    </form>
  );
}
