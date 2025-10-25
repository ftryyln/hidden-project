import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ensureUuid } from "../utils/validation.js";
import { requireGuildRole } from "../services/access.js";
import { supabaseAdmin } from "../supabase.js";
import { exportCsvSchema, reportsQuerySchema } from "../validators/schemas.js";
import { exportCsv, fetchReports } from "../services/reports.js";
import { ApiError, fromZodError } from "../errors.js";

const router = Router();

router.get(
  "/guilds/:guildId/reports",
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

    const parsed = reportsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw fromZodError(parsed.error);
    }

    const data = await fetchReports(guildId, parsed.data);
    res.json(data);
  }),
);

router.post(
  "/guilds/:guildId/reports/export",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const guildId = ensureUuid(req.params.guildId, "guildId");
    await requireGuildRole(supabaseAdmin, req.user!.id, guildId, ["guild_admin", "officer"]);

    const parsed = exportCsvSchema.safeParse(req.body);
    if (!parsed.success) {
      throw fromZodError(parsed.error);
    }

    const { filename, content } = await exportCsv(guildId, parsed.data.resource, {
      from: parsed.data.from,
      to: parsed.data.to,
    });

    if (!filename || !content) {
      throw new ApiError(500, "Unable to export CSV");
    }

    res
      .status(200)
      .setHeader("Content-Type", "text/csv; charset=utf-8")
      .setHeader("Content-Disposition", `attachment; filename="${filename}"`)
      .send(content);
  }),
);

export const reportsRouter = router;
