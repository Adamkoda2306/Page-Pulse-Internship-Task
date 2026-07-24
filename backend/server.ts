import { Server } from "socket.io";
import http from "http";
import enableLogging, { attachDashboard } from "logsave-hub";
import { env } from './config/env.config';
import { app } from './app';

const server = http.createServer(app);
const io = new Server(server);

// logsave-hub Configuration
attachDashboard(io);

enableLogging({
  override: true,
  outDir: "./logs",
  retention: false
});

server.listen(env.port, () => {
  console.log(`Page Pulse listening on http://localhost:${env.port}`);
});