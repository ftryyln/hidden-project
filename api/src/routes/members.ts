import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ensureUuid } from "../utils/validation.js";
import { memberListQuerySchema, memberUpsertSchema } from "../validators/schemas.js";
import {
  createMember,
  deleteMember,
  listMembers,
  toggleMemberActive,
  updateMember,
} from "../services/members.js";
import { requireGuildRole } from "../services/access.js";
import { supabaseAdmin } from "../supabase.js";
import { fromZodError } from "../errors.js";
import { z } from "zod";

const router = Router();

router.get(
  "/guilds/:guildId/members",
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

    const parseResult = memberListQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      throw fromZodError(parseResult.error);
    }
    const filters = parseResult.data;

    const result = await listMembers(guildId, {
      search: filters.search,
      active: filters.active,
      page: filters.page,
      pageSize: filters.pageSize,
    });
    res.json(result);
  }),
);

router.post(
  "/guilds/:guildId/members",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const guildId = ensureUuid(req.params.guildId, "guildId");
    await requireGuildRole(supabaseAdmin, req.user!.id, guildId, ["guild_admin", "officer"]);

    const parsed = memberUpsertSchema.safeParse(req.body);
    if (!parsed.success) {
      throw fromZodError(parsed.error);
    }

    const member = await createMember(guildId, parsed.data);
    res.status(201).json(member);
  }),
);

router.put(
  "/guilds/:guildId/members/:memberId",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const guildId = ensureUuid(req.params.guildId, "guildId");
    const memberId = ensureUuid(req.params.memberId, "memberId");
    await requireGuildRole(supabaseAdmin, req.user!.id, guildId, ["guild_admin", "officer"]);

    const parsed = memberUpsertSchema.safeParse(req.body);
    if (!parsed.success) {
      throw fromZodError(parsed.error);
    }

    const member = await updateMember(guildId, memberId, parsed.data);
    res.json(member);
  }),
);

const toggleSchema = z.object({
  is_active: z.boolean(),
});

router.patch(
  "/guilds/:guildId/members/:memberId/status",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const guildId = ensureUuid(req.params.guildId, "guildId");
    const memberId = ensureUuid(req.params.memberId, "memberId");
    await requireGuildRole(supabaseAdmin, req.user!.id, guildId, ["guild_admin", "officer"]);

    const parsed = toggleSchema.safeParse(req.body);
    if (!parsed.success) {
      throw fromZodError(parsed.error);
    }

    const member = await toggleMemberActive(guildId, memberId, parsed.data.is_active);
    res.json(member);
  }),
);

router.delete(
  "/guilds/:guildId/members/:memberId",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const guildId = ensureUuid(req.params.guildId, "guildId");
    const memberId = ensureUuid(req.params.memberId, "memberId");
    await requireGuildRole(supabaseAdmin, req.user!.id, guildId, ["guild_admin"]);

    await deleteMember(guildId, memberId);
    res.status(204).send();
  }),
);

export const memberRouter = router;
