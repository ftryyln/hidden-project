import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ensureUuid } from "../utils/validation.js";
import { requireGuildRole } from "../services/access.js";
import { supabaseAdmin } from "../supabase.js";
import {
  transactionCreateSchema,
  transactionFiltersSchema,
} from "../validators/schemas.js";
import {
  confirmTransaction,
  createTransaction,
  listTransactions,
} from "../services/transactions.js";
import { fromZodError } from "../errors.js";

const router = Router();

router.get(
  "/guilds/:guildId/transactions",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const guildId = ensureUuid(req.params.guildId, "guildId");
    await requireGuildRole(supabaseAdmin, req.user!.id, guildId, [
      "guild_admin",
      "officer",
      "raider",
      "member",
      "viewer",
    ]);

    const parsed = transactionFiltersSchema.safeParse(req.query);
    if (!parsed.success) {
      throw fromZodError(parsed.error);
    }

    const result = await listTransactions(guildId, parsed.data);
    res.json(result);
  }),
);

router.post(
  "/guilds/:guildId/transactions",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const guildId = ensureUuid(req.params.guildId, "guildId");
    await requireGuildRole(supabaseAdmin, req.user!.id, guildId, ["guild_admin", "officer"]);

    const parsed = transactionCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw fromZodError(parsed.error);
    }

    const tx = await createTransaction(guildId, req.user!.id, parsed.data);
    res.status(201).json(tx);
  }),
);

const confirmSchema = z.object({
  confirmed: z.boolean().optional(),
});

router.post(
  "/guilds/:guildId/transactions/:transactionId/confirm",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const guildId = ensureUuid(req.params.guildId, "guildId");
    const transactionId = ensureUuid(req.params.transactionId, "transactionId");
    await requireGuildRole(supabaseAdmin, req.user!.id, guildId, ["guild_admin", "officer"]);

    // Accept optional body for compatibility even if unused
    if (Object.keys(req.body ?? {}).length > 0) {
      const parsed = confirmSchema.safeParse(req.body);
      if (!parsed.success) {
        throw fromZodError(parsed.error);
      }
    }

    const tx = await confirmTransaction(guildId, transactionId, req.user!.id);
    res.json(tx);
  }),
);

export const transactionRouter = router;
