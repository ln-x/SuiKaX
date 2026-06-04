import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import healthLogsRouter from "./health-logs";
import sessionsRouter from "./sessions";
import presetsRouter from "./presets";
import categoriesRouter from "./categories";
import stressFactorsRouter from "./stress-factors";
import regulationStrategiesRouter from "./regulation-strategies";
import regulationLogsRouter from "./regulation-logs";
import environmentSnapshotsRouter from "./environment-snapshots";
import earthFeedsRouter from "./earth-feeds";
import localEnvRouter from "./local-env";
import userRouter from "./user";
import insightsRouter from "./insights";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(healthLogsRouter);
router.use(sessionsRouter);
router.use(presetsRouter);
router.use(categoriesRouter);
router.use(stressFactorsRouter);
router.use(regulationStrategiesRouter);
router.use(regulationLogsRouter);
router.use(environmentSnapshotsRouter);
router.use(earthFeedsRouter);
router.use(localEnvRouter);
router.use(userRouter);
router.use(insightsRouter);

export default router;
