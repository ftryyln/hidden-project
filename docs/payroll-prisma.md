# Payroll / Salary Schema

```prisma
enum PayrollSource {
  TRANSACTION
  LOOT
}

enum PayrollMode {
  EQUAL
  PERCENTAGE
  FIXED
}

model PayrollBatch {
  id                 String        @id @default(uuid())
  guildId            String
  guild              Guild         @relation(fields: [guildId], references: [id], onDelete: Cascade)
  referenceCode      String?       @unique
  source             PayrollSource
  mode               PayrollMode
  periodFrom         DateTime?
  periodTo           DateTime?
  totalAmount        Decimal       @db.Decimal(18, 2)
  notes              String?
  distributedByUserId String
  distributedBy      Profile       @relation("PayrollDistributor", fields: [distributedByUserId], references: [id])
  distributedByName  String
  balanceBefore      Decimal       @db.Decimal(18, 2)
  balanceAfter       Decimal       @db.Decimal(18, 2)
  membersCount       Int           @default(0)
  createdAt          DateTime      @default(now())
  updatedAt          DateTime      @updatedAt
  items              PayrollItem[]

  @@index([guildId, createdAt], map: "payroll_batches_guild_created_idx")
}

model PayrollItem {
  id          String       @id @default(uuid())
  batchId     String
  batch       PayrollBatch @relation(fields: [batchId], references: [id], onDelete: Cascade)
  memberId    String
  member      Member       @relation(fields: [memberId], references: [id], onDelete: Cascade)
  amount      Decimal      @db.Decimal(18, 2)
  percentage  Decimal?     @db.Decimal(9, 4)
  createdAt   DateTime     @default(now())

  @@unique([batchId, memberId], map: "payroll_items_batch_member_uniq")
  @@index([memberId], map: "payroll_items_member_idx")
}
```

The equivalent PostgreSQL migration lives in `supabase/migrations/087_payroll_tables.sql` and creates:

- Enums `payroll_source`, `payroll_mode`
- Tables `payroll_batches`, `payroll_items`
- Indices on `(guild_id, created_at)` and `member_id`
- Helper functions `payroll_sum_confirmed_income`, `payroll_sum_loot_value`, and `payroll_sum_disbursed` used by the API service layer.
