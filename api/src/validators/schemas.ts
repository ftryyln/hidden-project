import { z } from "zod";

export const guildIdParamSchema = z.object({
  guildId: z.string().uuid(),
});

export const paginationSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
  })
  .partial();

export const memberListQuerySchema = z
  .object({
    search: z.string().max(120).optional(),
    active: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
  })
  .merge(paginationSchema);

export const memberUpsertSchema = z.object({
  in_game_name: z.string().min(1).max(120),
  role_in_guild: z.enum(["leader", "officer", "raider", "casual"]),
  join_date: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  contact: z.record(z.string(), z.string().optional().nullable()).optional(),
  is_active: z.boolean().optional(),
});

export const transactionFiltersSchema = z
  .object({
    from: z.string().optional(),
    to: z.string().optional(),
    type: z.enum(["income", "expense", "transfer"]).optional(),
  })
  .merge(paginationSchema);

export const transactionCreateSchema = z.object({
  tx_type: z.enum(["income", "expense", "transfer"]),
  category: z.string().min(1).max(120),
  amount: z.coerce.number().min(0),
  description: z.string().optional().nullable(),
  evidence_path: z.string().optional().nullable(),
});

export const lootCreateSchema = z.object({
  boss_name: z.string().min(1).max(120),
  item_name: z.string().min(1).max(160),
  item_rarity: z.enum(["common", "rare", "epic", "legendary", "mythic"]),
  estimated_value: z.coerce.number().min(0),
  notes: z.string().optional().nullable(),
});

export const lootDistributionSchema = z.object({
  loot_id: z.string().uuid(),
  distributions: z
    .array(
      z.object({
        member_id: z.string().uuid(),
        share_amount: z.coerce.number().min(0),
      }),
    )
    .min(1),
});

export const reportsQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

export const exportCsvSchema = z.object({
  resource: z.enum(["members", "transactions"]),
  from: z.string().optional(),
  to: z.string().optional(),
});

const payrollSourceEnum = z.enum(["TRANSACTION", "LOOT"]);
const payrollModeEnum = z.enum(["EQUAL", "PERCENTAGE", "FIXED"]);

export const payrollSummaryQuerySchema = z.object({
  source: payrollSourceEnum.optional(),
});

const payrollMemberSchema = z.object({
  memberId: z.string().uuid(),
  amount: z.coerce.number().min(0).optional(),
  percentage: z.coerce.number().min(0).optional(),
});

export const payrollBatchCreateSchema = z.object({
  source: payrollSourceEnum,
  mode: payrollModeEnum,
  periodFrom: z.string().optional().nullable(),
  periodTo: z.string().optional().nullable(),
  totalAmount: z.coerce.number().positive(),
  members: z.array(payrollMemberSchema).min(1),
  notes: z.string().max(2000).optional().nullable(),
});

export const payrollListQuerySchema = paginationSchema.extend({
  source: payrollSourceEnum.optional(),
  distributedByUserId: z.string().uuid().optional(),
  memberId: z.string().uuid().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});
