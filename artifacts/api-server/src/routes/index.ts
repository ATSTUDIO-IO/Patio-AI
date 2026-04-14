import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import lojasRouter from "./lojas";
import veiculosRouter from "./veiculos";
import publicRouter from "./public";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(lojasRouter);
router.use(veiculosRouter);
router.use(publicRouter);

export default router;
