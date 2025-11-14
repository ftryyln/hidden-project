import type { User } from "@supabase/supabase-js";
import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ensureUuid } from "../utils/validation.js";
import { requireGuildRole } from "../services/access.js";
import { supabaseAdmin } from "../supabase.js";
import { fromZodError } from "../errors.js";
import {
  payrollBatchCreateSchema,
  payrollListQuerySchema,
  payrollSummaryQuerySchema,
} from "../validators/schemas.js";
import {
  createPayrollBatch,
  getAvailableBalance,
  getPayrollBatchDetail,
  listPayrollBatches,
} from "../services/payroll.js";

const router = Router();

const MEMBER_ROLES = ["guild_admin", "officer", "raider", "member", "viewer"] as const;

function resolveDisplayName(user: User): string {
  const metadata = (user.user_metadata as Record<string, string> | undefined) ?? {};
  return metadata.display_name ?? user.email ?? user.id;
}

router.get(
  "/guilds/:guildId/payroll/summary",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const guildId = ensureUuid(req.params.guildId, "guildId");
    await requireGuildRole(supabaseAdmin, req.user!.id, guildId, [...MEMBER_ROLES]);

    const parsed = payrollSummaryQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw fromZodError(parsed.error);
    }

    const source = parsed.data.source ?? "TRANSACTION";
    const summary = await getAvailableBalance(guildId, source);

    res.json({
      data: {
        source,
        availableBalance: summary.balance,
        asOf: summary.asOf.toISOString(),
      },
      error: null,
    });
  }),
);

router.post(
  "/guilds/:guildId/payroll/batches",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const guildId = ensureUuid(req.params.guildId, "guildId");
    await requireGuildRole(supabaseAdmin, req.user!.id, guildId, ["guild_admin", "officer"]);

    const parsed = payrollBatchCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw fromZodError(parsed.error);
    }

    const displayName = resolveDisplayName(req.user!);
    const result = await createPayrollBatch(guildId, {
      ...parsed.data,
      distributedByUserId: req.user!.id,
      distributedByName: displayName,
    });

    res.status(201).json({
      data: {
        batchId: result.batchId,
        referenceCode: result.referenceCode,
        totalAmount: result.totalAmount,
        source: result.source,
        balanceBefore: result.balanceBefore,
        balanceAfter: result.balanceAfter,
        createdAt: result.createdAt,
        distributedByName: result.distributedByName,
      },
      error: null,
    });
  }),
);

router.get(
  "/guilds/:guildId/payroll/batches",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const guildId = ensureUuid(req.params.guildId, "guildId");
    await requireGuildRole(supabaseAdmin, req.user!.id, guildId, [...MEMBER_ROLES]);

    const parsed = payrollListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw fromZodError(parsed.error);
    }

    const list = await listPayrollBatches(guildId, parsed.data);

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

router.get(
  "/guilds/:guildId/payroll/batches/:batchId",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const guildId = ensureUuid(req.params.guildId, "guildId");
    const batchId = ensureUuid(req.params.batchId, "batchId");
    await requireGuildRole(supabaseAdmin, req.user!.id, guildId, [...MEMBER_ROLES]);

    const batch = await getPayrollBatchDetail(guildId, batchId);

    res.json({
      data: {
        id: batch.id,
        referenceCode: batch.reference_code,
        source: batch.source,
        totalAmount: batch.total_amount,
        mode: batch.mode,
        notes: batch.notes ?? null,
        distributedByName: batch.distributed_by_name,
        distributedByUserId: batch.distributed_by_user_id,
        createdAt: batch.created_at,
        periodFrom: batch.period_from ?? null,
        periodTo: batch.period_to ?? null,
        balanceBefore: batch.balance_before,
        balanceAfter: batch.balance_after,
        items: batch.items.map((item) => ({
          memberId: item.member_id,
          memberName: item.member_name ?? null,
          amount: item.amount,
          percentage: item.percentage ?? null,
        })),
      },
      error: null,
    });
  }),
);

export const payrollRouter = router;
