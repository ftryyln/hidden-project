import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useState } from "react";
import { toApiError } from "@/lib/api/errors";

const forgotSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type ForgotSchema = z.infer<typeof forgotSchema>;

export function ForgotPasswordForm() {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<ForgotSchema>({
    resolver: zodResolver(forgotSchema),
    defaultValues: {
      email: "",
    },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        throw await toApiError(response);
      }

      toast({
        title: "Check your email",
        description:
          "If an account exists, you'll receive a reset link shortly.",
      });
    } catch (error) {
      const apiError = await toApiError(error);
      toast({
        title: "Unable to send reset link",
        description: apiError.message,
      });
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Sending reset link…" : "Send reset link"}
      </Button>
    </form>
  );
}
