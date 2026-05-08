import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import lojasRouter from "./lojas";
import veiculosRouter from "./veiculos";
import publicRouter from "./public";
import agenteRouter from "./agente";
import leadsRouter from "./leads";
import conversasRouter from "./conversas";
import alertasRouter from "./alertas";
import financiamentosRouter from "./financiamentos";
import billingRouter from "./billing";
import adminRouter from "./admin";
import landingRouter from "./landing";
import whatsappRouter from "./whatsapp";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(lojasRouter);
router.use(veiculosRouter);
router.use(publicRouter);
router.use(agenteRouter);
router.use(leadsRouter);
router.use(conversasRouter);
router.use(alertasRouter);
router.use(financiamentosRouter);
router.use(billingRouter);
router.use(adminRouter);
router.use(landingRouter);
router.use(whatsappRouter);

export default router;
