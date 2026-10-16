const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const QRCode = require("qrcode");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const PORT = Number(process.env.PORT || 3000);
const sessions = new Map(); // room -> { game, controllers, createdAt }
const clients = new Map();

app.use(express.static("public"));
app.get("/api/health", (_req, res) => res.json({ ok: true, service: "motion-controller" }));
app.get("/api/room", async (_req, res) => {
  const room = crypto.randomBytes(3).toString("hex").toUpperCase();
  sessions.set(room, { game: null, controllers: new Set(), createdAt: Date.now() });
  const host = `${_req.protocol}://${_req.get("host")}`;
  const controllerUrl = `${host}/controller.html?room=${room}`;
  try {
    const qr = await QRCode.toDataURL(controllerUrl, { margin: 1, width: 240 });
    res.json({ room, controllerUrl, qr });
  } catch (e) { res.status(500).json({ error: "Could not create QR code" }); }
});

function send(ws, payload) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
}
function broadcast(room, payload, except) {
  for (const [ws, meta] of clients) if (meta.room === room && ws !== except) send(ws, payload);
}

wss.on("connection", (ws) => {
  clients.set(ws, { room: null, role: null, id: crypto.randomUUID() });
  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return send(ws, { type: "error", message: "Invalid message" }); }
    const meta = clients.get(ws);
    if (msg.type === "join") {
      const room = String(msg.room || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (!sessions.has(room)) sessions.set(room, { game: null, controllers: new Set(), createdAt: Date.now() });
      meta.room = room;
      meta.role = msg.role === "game" ? "game" : "controller";
      const session = sessions.get(room);
      if (meta.role === "game") session.game = ws;
      else session.controllers.add(ws);
      send(ws, { type: "joined", room, role: meta.role, controllerCount: session.controllers.size });
      broadcast(room, { type: "peers", controllerCount: session.controllers.size, gameConnected: !!session.game });
      if (meta.role === "game") {
        for (const controller of session.controllers) send(controller, { type: "game-status", connected: true });
      }
      return;
    }
    if (!meta.room) return send(ws, { type: "error", message: "Join a room first" });
    const session = sessions.get(meta.room);
    if (msg.type === "motion" && meta.role === "controller") {
      const packet = {
        type: "motion", x: clamp(msg.x, -1, 1), y: clamp(msg.y, -1, 1),
        shake: !!msg.shake, jump: !!msg.jump, buttons: msg.buttons || {},
        sentAt: Number(msg.sentAt) || Date.now(), controllerId: meta.id
      };
      if (session && session.game) send(session.game, packet);
      broadcast(meta.room, { type: "motion-preview", x: packet.x, y: packet.y, sentAt: packet.sentAt }, ws);
    } else if (msg.type === "ping") {
      send(ws, { type: "pong", sentAt: msg.sentAt, serverAt: Date.now() });
    } else if (msg.type === "calibrate" && meta.role === "controller") {
      send(ws, { type: "calibrated", ok: true });
    } else if (msg.type === "game-event" && meta.role === "game") {
      broadcast(meta.room, msg, ws);
    }
  });
  ws.on("close", () => {
    const meta = clients.get(ws);
    if (meta && meta.room && sessions.has(meta.room)) {
      const session = sessions.get(meta.room);
      if (meta.role === "game") session.game = null;
      if (meta.role === "controller") session.controllers.delete(ws);
      broadcast(meta.room, { type: "peers", controllerCount: session.controllers.size, gameConnected: !!session.game });
      for (const controller of session.controllers) if (!session.game) send(controller, { type: "game-status", connected: false });
      if (!session.game && session.controllers.size === 0 && Date.now() - session.createdAt > 60_000) sessions.delete(meta.room);
    }
    clients.delete(ws);
  });
});
function clamp(n, min, max) { n = Number(n); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : 0; }

server.listen(PORT, "0.0.0.0", () => console.log(`Motion controller ready at http://localhost:${PORT}`));