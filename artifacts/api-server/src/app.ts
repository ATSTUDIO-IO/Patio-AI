import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

const isDev = process.env.NODE_ENV === "development";

// Build exact-match origin allowlist from REPLIT_DOMAINS at startup.
// REPLIT_DOMAINS is a comma-separated list of domains assigned by Replit
// (e.g. "abc123.picard.replit.dev" in dev, "myapp.replit.app" in prod).
// Deploy checklist: ensure REPLIT_DOMAINS, JWT_SECRET, WHATSAPP_APP_SECRET,
// and WHATSAPP_VERIFY_TOKEN are set in production secrets before first deploy.
const replitDomainOrigins = new Set<string>();
const replitDomainsEnv = process.env.REPLIT_DOMAINS ?? "";
for (const domain of replitDomainsEnv.split(",")) {
  const d = domain.trim();
  if (d) {
    replitDomainOrigins.add(`https://${d}`);
    if (isDev) replitDomainOrigins.add(`http://${d}`);
  }
}

// Strict regex for .replit.app deploy domains (single-level subdomain only).
// Used as a fallback when REPLIT_DOMAINS does not list all production URLs
// (e.g. custom deployment domains). Intentionally limited to .replit.app TLD.
const REPLIT_APP_RE = /^https:\/\/[a-zA-Z0-9-]+\.replit\.app$/;

function isOriginAllowed(origin: string): boolean {
  // Priority 1: exact match against REPLIT_DOMAINS (most restrictive)
  if (replitDomainOrigins.has(origin)) return true;
  // Priority 2: localhost only in development
  if (isDev && /^https?:\/\/localhost(:\d+)?$/.test(origin)) return true;
  // Priority 3: .replit.app regex fallback for production deploy domains
  // not explicitly listed in REPLIT_DOMAINS (intentional, see comment above)
  if (!isDev && REPLIT_APP_RE.test(origin)) return true;
  return false;
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server requests (no Origin header: curl, proxy, etc.)
      if (!origin) return callback(null, true);
      if (isOriginAllowed(origin)) return callback(null, true);
      logger.warn({ origin }, "CORS: origem rejeitada");
      callback(new Error("Origem não permitida por CORS"));
    },
    credentials: true,
  }),
);

app.use(
  express.json({
    limit: "1mb",
    verify: (req: express.Request & { rawBody?: Buffer }, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.set("trust proxy", 1);

const agenteRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições. Tente novamente em alguns instantes." },
});

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: "Muitas tentativas de login. Tente novamente em 15 minutos." },
});

const landingChatRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições. Tente novamente em alguns instantes." },
});

const whatsappWebhookRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições ao webhook." },
});

app.use("/api/agente", agenteRateLimit);
app.use("/api/auth/login", loginRateLimit);
app.use("/api/landing/chat", landingChatRateLimit);

// Webhook rate limit scoped to POST only — GET /webhook is used by Meta's
// verification handshake and must not be throttled.
app.use("/api/whatsapp/webhook", (req, res, next) => {
  if (req.method === "POST") {
    whatsappWebhookRateLimit(req, res, next);
  } else {
    next();
  }
});

app.use(
  "/api/agente/mensagem",
  express.json({ limit: "50mb" }),
  express.urlencoded({ extended: true, limit: "50mb" }),
);

app.use("/api", router);

export default app;
