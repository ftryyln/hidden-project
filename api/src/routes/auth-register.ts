import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/async-handler.js";
import { supabaseAdmin, supabaseAuth } from "../supabase.js";
import { ApiError } from "../errors.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { config } from "../env.js";
import { acceptInviteForEmail, acceptInviteWithToken } from "../services/invites.js";
import type { GuildRole } from "../types.js";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  display_name: z.string().min(1).max(120).optional(),
  invite_token: z.string().trim().min(1).optional(),
});

const resendVerificationSchema = z.object({
  email: z.string().email(),
});

function resolveRegistrationRedirect(): string {
  return (
    config.registrationRedirectUrl ?? `${config.frontendUrl.replace(/\/$/, "")}/login`
  );
}

router.post(
  "/auth/register",
  asyncHandler(async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation error",
        parsed.error.flatten().fieldErrors,
      );
    }

    const { email, password, display_name, invite_token } = parsed.data;

    const displayName = display_name ?? email.split("@")[0];
    const registrationRedirect = resolveRegistrationRedirect();

    let { data, error } = await supabaseAuth.auth.signUp({
      email,
      password,
      options: {
        ...(registrationRedirect
          ? { emailRedirectTo: registrationRedirect }
          : {}),
        data: {
          display_name: displayName,
        },
      },
    });

    if (error || !data?.user) {
      if (
        error?.message &&
        error.message.toLowerCase().includes("database error finding user")
      ) {
        const created = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: false,
          user_metadata: { display_name: displayName },
          app_metadata: {},
        });

        if (created.error || !created.data?.user) {
          throw new ApiError(
            created.error?.status ?? 400,
            created.error?.message ?? "Unable to register",
          );
        }

        data = { user: created.data.user, session: null };
        error = null;
      } else {
        throw new ApiError(
          error?.status ?? 400,
          error?.message ?? "Unable to register",
        );
      }
    }

    if (!data?.user) {
      throw new ApiError(
        400,
        "Unable to register",
      );
    }

    const userId = data.user.id;

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: userId,
        email,
        display_name: displayName,
      });
    if (profileError) {
      console.warn(
        "Failed to upsert profile during registration",
        profileError,
      );
    }

    let assignedAppRole: GuildRole | null = null;

    if (invite_token) {
      try {
        const { role } = await acceptInviteWithToken(invite_token, userId, email);
        assignedAppRole = role;
      } catch (err) {
        if (err instanceof ApiError) {
          throw err;
        }
        console.error("Failed to accept invite during registration", err);
        throw new ApiError(500, "Unable to apply invite token");
      }
    }

    if (!assignedAppRole) {
      const autoInvite = await acceptInviteForEmail(email, userId);
      if (autoInvite) {
        assignedAppRole = autoInvite.role;
      }
    }

    if (!assignedAppRole) {
      assignedAppRole = "viewer";
      await Promise.allSettled([
        supabaseAdmin.from("profiles").update({ app_role: assignedAppRole }).eq("id", userId),
        supabaseAdmin.auth.admin.updateUserById(userId, {
          app_metadata: { role: assignedAppRole },
        }),
      ]);
    }

    const session = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });

    const signInErrorMessage = session.error?.message?.toLowerCase() ?? "";
    const requiresVerification =
      signInErrorMessage.includes("email not confirmed") ||
      signInErrorMessage.includes("email confirmation required");

    if (requiresVerification) {
      const resendResult = await supabaseAuth.auth.resend({
        type: "signup",
        email,
        options: registrationRedirect ? { emailRedirectTo: registrationRedirect } : undefined,
      });
      if (resendResult.error) {
        console.warn("Failed to resend verification email", resendResult.error);
      }
      res.status(202).json({
        requires_verification: true,
        message: "Email verification required",
        email,
      });
      return;
    }

    if (session.error || !session.data.session) {
      throw new ApiError(
        400,
        session.error?.message ?? "Unable to authenticate after registration",
      );
    }

    const user = session.data.session.user;

    res.json({
      access_token: session.data.session.access_token,
      refresh_token: session.data.session.refresh_token,
      expires_in: session.data.session.expires_in,
      expires_at: session.data.session.expires_at ?? null,
      user: {
        id: user.id,
        email: user.email ?? email,
        display_name:
          (user.user_metadata as Record<string, string> | undefined)
            ?.display_name ??
          displayName ??
          email,
        app_role: user.app_metadata?.role ?? null,
      },
    });
  }),
);

router.post(
  "/auth/resend-verification",
  asyncHandler(async (req, res) => {
    const parsed = resendVerificationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(422, "validation error", parsed.error.flatten().fieldErrors);
    }

    const registrationRedirect = resolveRegistrationRedirect();
    const result = await supabaseAuth.auth.resend({
      type: "signup",
      email: parsed.data.email,
      options: registrationRedirect ? { emailRedirectTo: registrationRedirect } : undefined,
    });

    if (result.error) {
      throw new ApiError(
        result.error.status ?? 400,
        result.error.message ?? "Unable to resend verification email",
      );
    }

    res.status(202).json({ message: "Verification email sent" });
  }),
);

const forgotSchema = z.object({
  email: z.string().email(),
});

router.post(
  "/auth/forgot",
  asyncHandler(async (req, res) => {
    const parsed = forgotSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation error",
        parsed.error.flatten().fieldErrors,
      );
    }

    const redirectUrl =
      config.resetPasswordRedirectUrl ??
      `${config.frontendUrl.replace(/\/$/, "")}/reset-password`;

    const { error } = await supabaseAuth.auth.resetPasswordForEmail(
      parsed.data.email,
      {
        redirectTo: redirectUrl,
      },
    );
    if (error) {
      throw new ApiError(
        error.status ?? 400,
        error.message ?? "Unable to send reset email",
      );
    }

    res.json({ message: "Reset link sent" });
  }),
);

const resetSchema = z
  .object({
    code: z.string().min(1).optional(),
    access_token: z.string().min(1).optional(),
    refresh_token: z.string().min(1).optional(),
    new_password: z.string().min(6),
  })
  .refine((payload) => Boolean(payload.code) || Boolean(payload.access_token), {
    message: "Missing reset token",
    path: ["code"],
  })
  .refine(
    (payload) =>
      !payload.access_token || (payload.access_token && Boolean(payload.refresh_token)),
    {
      message: "Missing refresh token",
      path: ["refresh_token"],
    },
  );

router.post(
  "/auth/reset",
  asyncHandler(async (req, res) => {
    const parsed = resetSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation error",
        parsed.error.flatten().fieldErrors,
      );
    }

    const { code, access_token, refresh_token, new_password } = parsed.data;

    let session: Awaited<
      ReturnType<typeof supabaseAuth.auth.getSession>
    >["data"]["session"] | null = null;

    if (code) {
      const exchange = await supabaseAuth.auth.exchangeCodeForSession(code);
      if (exchange.error || !exchange.data.session) {
        throw new ApiError(
          400,
          exchange.error?.message ?? "Invalid or expired reset code",
        );
      }
      session = exchange.data.session;
    } else if (access_token) {
      const sessionPayload = {
        access_token,
        refresh_token: refresh_token!,
      };
      const {
        data: sessionData,
        error: sessionError,
      } = await supabaseAuth.auth.setSession(sessionPayload);
      if (sessionError || !sessionData.session) {
        throw new ApiError(
          sessionError?.status ?? 400,
          sessionError?.message ?? "Invalid or expired reset token",
        );
      }
      session = sessionData.session;
    }

    if (!session) {
      throw new ApiError(400, "Invalid reset payload");
    }
    const { error: updateError } = await supabaseAuth.auth.updateUser({
      password: new_password,
    });
    if (updateError) {
      throw new ApiError(
        updateError.status ?? 400,
        updateError.message ?? "Unable to update password",
      );
    }

    res.json({
      access_token: session.access_token,
      refresh_token: session.refresh_token ?? "",
      expires_in: session.expires_in,
      expires_at: session.expires_at ?? null,
      user: {
        id: session.user.id,
        email: session.user.email ?? "",
        display_name:
          (session.user.user_metadata as Record<string, string> | undefined)
            ?.display_name ??
          session.user.email ??
          "",
        app_role: session.user.app_metadata?.role ?? null,
      },
    });
  }),
);

router.post(
  "/auth/accept-invite",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const acceptSchema = z.object({ token: z.string().trim().min(1) });
    const parsed = acceptSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(422, "validation error", parsed.error.flatten().fieldErrors);
    }

    const user = req.user!;
    try {
      const { guildId, role } = await acceptInviteWithToken(
        parsed.data.token,
        user.id,
        user.email ?? undefined,
      );
      res.json({ guild_id: guildId, role });
    } catch (err) {
      if (err instanceof ApiError) {
        throw err;
      }
      console.error("Failed to accept invite", err);
      throw new ApiError(500, "Unable to accept invite");
    }
  }),
);

export const authRegisterRouter = router;
