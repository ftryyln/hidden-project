import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ensureUuid } from "../utils/validation.js";
import { fromZodError } from "../errors.js";
import { requireGuildRole } from "../services/access.js";
import {
  createAttendanceSession,
  deleteAttendanceSession,
  getAttendanceDetail,
  listAttendanceHistory,
  listAttendanceSessions,
  updateAttendanceSession,
} from "../services/attendance.js";
import type { AttendanceDetail } from "../services/attendance.js";
import {
  attendanceListQuerySchema,
  attendanceSessionSchema,
} from "../validators/schemas.js";
import { supabaseAdmin } from "../supabase.js";

const router = Router();

function serializeDetail(detail: AttendanceDetail) {
  return {
    session: detail.session,
    entries: detail.entries.map((entry) => ({
      id: entry.id,
      sessionId: entry.session_id,
      memberId: entry.member_id,
      memberName: entry.member_name ?? null,
      note: entry.note ?? null,
      lootTag: entry.loot_tag ?? null,
      createdAt: entry.created_at,
      updatedAt: entry.updated_at,
    })),
  };
}

const VIEW_ROLES = ["guild_admin", "officer", "raider", "member", "viewer"] as const;
const MANAGE_ROLES = ["guild_admin", "officer"] as const;

router.get(
  "/guilds/:guildId/attendance",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const guildId = ensureUuid(req.params.guildId, "guildId");
    await requireGuildRole(supabaseAdmin, req.user!.id, guildId, [...VIEW_ROLES]);

    const parsed = attendanceListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw fromZodError(parsed.error);
    }

    const list = await listAttendanceSessions(guildId, parsed.data);
    res.json({
      data: list.items,
      meta: {
        page: list.page,
        pageSize: list.pageSize,
        totalItems: list.total,
        totalPages: list.totalPages,
      },
      error: null,
    });
  }),
);

router.post(
  "/guilds/:guildId/attendance",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const guildId = ensureUuid(req.params.guildId, "guildId");
    await requireGuildRole(supabaseAdmin, req.user!.id, guildId, [...MANAGE_ROLES]);

    const parsed = attendanceSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw fromZodError(parsed.error);
    }

    const detail = await createAttendanceSession(guildId, {
      ...parsed.data,
      userId: req.user!.id,
    });

    res.status(201).json({
      data: serializeDetail(detail),
      error: null,
    });
  }),
);

router.get(
  "/guilds/:guildId/attendance/:sessionId",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const guildId = ensureUuid(req.params.guildId, "guildId");
    const sessionId = ensureUuid(req.params.sessionId, "sessionId");
    await requireGuildRole(supabaseAdmin, req.user!.id, guildId, [...VIEW_ROLES]);

    const detail = await getAttendanceDetail(guildId, sessionId);
    res.json({ data: serializeDetail(detail), error: null });
  }),
);

router.put(
  "/guilds/:guildId/attendance/:sessionId",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const guildId = ensureUuid(req.params.guildId, "guildId");
    const sessionId = ensureUuid(req.params.sessionId, "sessionId");
    await requireGuildRole(supabaseAdmin, req.user!.id, guildId, [...MANAGE_ROLES]);

    const parsed = attendanceSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw fromZodError(parsed.error);
    }

    const detail = await updateAttendanceSession(guildId, sessionId, {
      ...parsed.data,
      userId: req.user!.id,
    });

    res.json({ data: serializeDetail(detail), error: null });
  }),
);

router.delete(
  "/guilds/:guildId/attendance/:sessionId",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const guildId = ensureUuid(req.params.guildId, "guildId");
    const sessionId = ensureUuid(req.params.sessionId, "sessionId");
    await requireGuildRole(supabaseAdmin, req.user!.id, guildId, [...MANAGE_ROLES]);

    await deleteAttendanceSession(guildId, sessionId, req.user!.id);
    res.status(204).send();
  }),
);

router.get(
  "/guilds/:guildId/attendance/:sessionId/history",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const guildId = ensureUuid(req.params.guildId, "guildId");
    const sessionId = ensureUuid(req.params.sessionId, "sessionId");
    await requireGuildRole(supabaseAdmin, req.user!.id, guildId, [...VIEW_ROLES]);

    const history = await listAttendanceHistory(guildId, sessionId);
    res.json({
      data: history.map((item) => ({
        id: item.id,
        sessionId: item.session_id,
        action: item.action,
        details: item.details ?? null,
        performedBy: item.performed_by,
        performerName: item.performer_name ?? null,
        performedAt: item.performed_at,
      })),
      error: null,
    });
  }),
);

export const attendanceRouter = router;
