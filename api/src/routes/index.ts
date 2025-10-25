import { Router } from "express";
import { authRouter } from "./auth.js";
import { authRegisterRouter } from "./auth-register.js";
import { guildRouter } from "./guilds.js";
import { memberRouter } from "./members.js";
import { transactionRouter } from "./transactions.js";
import { lootRouter } from "./loot.js";
import { reportsRouter } from "./reports.js";
import { guildAccessRouter } from "./guild-user-roles.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ ok: true });
});

router.use(authRouter);
router.use(authRegisterRouter);
router.use(guildRouter);
router.use(memberRouter);
router.use(transactionRouter);
router.use(lootRouter);
router.use(reportsRouter);
router.use(guildAccessRouter);

export { router };
