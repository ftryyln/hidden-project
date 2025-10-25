import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ensureUuid } from "../utils/validation.js";
import { requireGuildRole } from "../services/access.js";
import { supabaseAdmin } from "../supabase.js";
import { lootCreateSchema, lootDistributionSchema } from "../validators/schemas.js";
import { createLoot, distributeLoot, listLoot } from "../services/loot.js";
import { ApiError, fromZodError } from "../errors.js";

const router = Router();

router.get(
  "/guilds/:guildId/loot",
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

    const loot = await listLoot(guildId);
    res.json(loot);
  }),
);

router.post(
  "/guilds/:guildId/loot",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const guildId = ensureUuid(req.params.guildId, "guildId");
    await requireGuildRole(supabaseAdmin, req.user!.id, guildId, [
      "guild_admin",
      "officer",
      "raider",
    ]);

    const parsed = lootCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw fromZodError(parsed.error);
    }

    const loot = await createLoot(guildId, parsed.data);
    res.status(201).json(loot);
  }),
);

router.post(
  "/guilds/:guildId/loot/:lootId/distribute",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const guildId = ensureUuid(req.params.guildId, "guildId");
    const lootId = ensureUuid(req.params.lootId, "lootId");
    await requireGuildRole(supabaseAdmin, req.user!.id, guildId, [
      "guild_admin",
      "officer",
      "raider",
    ]);

    const parsed = lootDistributionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw fromZodError(parsed.error);
    }

    if (parsed.data.loot_id !== lootId) {
      throw new ApiError(400, "validation error", {
        loot_id: "payload loot_id does not match URL parameter",
      });
    }

    const loot = await distributeLoot(guildId, req.user!.id, {
      lootId,
      distributions: parsed.data.distributions,
    });
    res.json(loot);
  }),
);

export const lootRouter = router;
