import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ensureUuid } from "../utils/validation.js";
import { fromZodError } from "../errors.js";
import { requireSuperAdmin } from "../services/access.js";
import {
  createAdminGuild,
  deleteAdminGuild,
  listAdminGuilds,
  updateAdminGuild,
} from "../services/admin-guilds.js";

const router = Router();

const guildUpsertSchema = z.object({
  name: z.string().min(3).max(120),
  tag: z.string().min(2).max(24),
  description: z.string().max(500).optional().nullable(),
});

router.get(
  "/admin/guilds",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await requireSuperAdmin(req.user!.id);
    const guilds = await listAdminGuilds();
    res.json(guilds);
  }),
);

router.post(
  "/admin/guilds",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await requireSuperAdmin(req.user!.id);

    const parsed = guildUpsertSchema.safeParse(req.body);
    if (!parsed.success) {
      throw fromZodError(parsed.error);
    }

    const guild = await createAdminGuild(req.user!.id, parsed.data);
    res.status(201).json(guild);
  }),
);

router.patch(
  "/admin/guilds/:guildId",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await requireSuperAdmin(req.user!.id);
    const guildId = ensureUuid(req.params.guildId, "guildId");

    const parsed = guildUpsertSchema.safeParse(req.body);
    if (!parsed.success) {
      throw fromZodError(parsed.error);
    }

    const guild = await updateAdminGuild(req.user!.id, guildId, parsed.data);
    res.json(guild);
  }),
);

router.delete(
  "/admin/guilds/:guildId",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await requireSuperAdmin(req.user!.id);
    const guildId = ensureUuid(req.params.guildId, "guildId");
    await deleteAdminGuild(req.user!.id, guildId);
    res.status(204).send();
  }),
);

export const adminRouter = router;
