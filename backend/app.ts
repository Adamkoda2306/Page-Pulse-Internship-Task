import path from 'node:path';
import cors from 'cors';
import express, { RequestHandler } from 'express';
import auditRoutes from './routes/audit.routes';
import { errorHandler, notFound } from './middleware/error.middleware';
import { dashboardRouter } from "logsave-hub";

export const app = express();

app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, uptime: Math.round(process.uptime()) });
});

if (process.env.NODE_ENV !== "test") {
    app.use("/api/logsave-hub", dashboardRouter as unknown as RequestHandler);
}
app.use('/api/audit', auditRoutes);

app.use('/api', notFound);
app.use(errorHandler);