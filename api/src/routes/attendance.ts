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

// New endpoints for Discord bot integration

// Find member by Discord username
router.get(
  "/members/by-discord/:username",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const username = req.params.username;
    
    const { data, error } = await supabaseAdmin
      .from("members")
      .select("id, guild_id, user_id, in_game_name, role_in_guild, contact, is_active")
      .eq("is_active", true)
      .like("contact->>discord_username", username)
      .single();
    
    if (error || !data) {
      return res.status(404).json({
        data: null,
        error: "Member not found with Discord username: " + username,
      });
    }
    
    res.json({
      data: {
        id: data.id,
        guildId: data.guild_id,
        userId: data.user_id,
        inGameName: data.in_game_name,
        roleInGuild: data.role_in_guild,
        discordUsername: (data.contact as any)?.discord_username,
      },
      error: null,
    });
  }),
);

// Get pending attendance entries
router.get(
  "/guilds/:guildId/attendance/pending",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const guildId = ensureUuid(req.params.guildId, "guildId");
    await requireGuildRole(supabaseAdmin, req.user!.id, guildId, [...VIEW_ROLES]);
    
    const { data, error } = await supabaseAdmin
      .from("pending_attendance_view")
      .select("*")
      .eq("guild_id", guildId)
      .order("entry_created_at", { ascending: false });
    
    if (error) {
      throw new Error("Failed to fetch pending attendance: " + error.message);
    }
    
    res.json({
      data: (data || []).map((item) => ({
        entryId: item.entry_id,
        sessionId: item.session_id,
        memberId: item.member_id,
        memberName: item.member_name,
        discordUsername: item.discord_username,
        bossName: item.boss_name,
        mapName: item.map_name,
        sessionName: item.boss_name || item.map_name || "Unknown",
        startedAt: item.session_started_at,
        createdAt: item.entry_created_at,
        note: item.note,
        lootTag: item.loot_tag,
      })),
      error: null,
    });
  }),
);

// Confirm single attendance entry
router.patch(
  "/guilds/:guildId/attendance/entries/:entryId/confirm",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const guildId = ensureUuid(req.params.guildId, "guildId");
    const entryId = ensureUuid(req.params.entryId, "entryId");
    await requireGuildRole(supabaseAdmin, req.user!.id, guildId, [...MANAGE_ROLES]);
    
    const { data, error } = await supabaseAdmin.rpc("confirm_attendance_entry", {
      p_entry_id: entryId,
      p_confirmed_by: req.user!.id,
    });
    
    if (error) {
      throw new Error("Failed to confirm attendance: " + error.message);
    }
    
    res.json({
      data: {
        id: data.id,
        confirmed: data.confirmed,
        confirmedBy: data.confirmed_by,
        confirmedAt: data.confirmed_at,
      },
      error: null,
    });
  }),
);

// Bulk confirm attendance entries
router.post(
  "/guilds/:guildId/attendance/entries/bulk-confirm",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const guildId = ensureUuid(req.params.guildId, "guildId");
    await requireGuildRole(supabaseAdmin, req.user!.id, guildId, [...MANAGE_ROLES]);
    
    const { entryIds } = req.body;
    if (!Array.isArray(entryIds) || entryIds.length === 0) {
      return res.status(400).json({
        data: null,
        error: "entryIds must be a non-empty array",
      });
    }
    
    const { data, error } = await supabaseAdmin.rpc("bulk_confirm_attendance_entries", {
      p_entry_ids: entryIds,
      p_confirmed_by: req.user!.id,
    });
    
    if (error) {
      throw new Error("Failed to bulk confirm attendance: " + error.message);
    }
    
    res.json({
      data: {
        confirmed: data?.length || 0,
        entries: data || [],
      },
      error: null,
    });
  }),
);

export const attendanceRouter = router;
