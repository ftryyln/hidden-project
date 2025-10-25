import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";
import { fetchDashboard, fetchGuildSummaries } from "../services/guilds.js";
import { ensureUuid } from "../utils/validation.js";

const router = Router();

router.get(
  "/guilds",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const guilds = await fetchGuildSummaries(req.user!.id);
    res.json(guilds);
  }),
);

router.get(
  "/dashboard",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const guildIdParam = typeof req.query.guildId === "string" ? req.query.guildId : undefined;
    const guildId = guildIdParam ? ensureUuid(guildIdParam, "guildId") : undefined;
    const dashboard = await fetchDashboard(req.user!.id, guildId);
    res.json(dashboard);
  }),
);

export const guildRouter = router;
