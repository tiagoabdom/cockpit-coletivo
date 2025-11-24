
// server.js
// MVP "Cockpit Coletivo" - servidor WebSocket + arquivos estáticos
// Rodar: npm install && npm start
// Acessar:
// - Telão: http://SEU_IP:3000/
// - Celular: http://SEU_IP:3000/controller

const path = require("path");
const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;
const TICK_MS = 2000; // rodada de votação

const app = express();
app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let clients = new Set();
let votes = {}; // { clientId: "L"|"R"|"U"|"D"|"S" }
let round = 0;

function broadcast(obj) {
const msg = JSON.stringify(obj);
for (const ws of clients) {
if (ws.readyState === WebSocket.OPEN) ws.send(msg);
}
}

function computeRoundResult() {
const counts = { L: 0, R: 0, U: 0, D: 0, S: 0 };
const total = Object.keys(votes).length;

for (const v of Object.values(votes)) {
if (counts[v] !== undefined) counts[v]++;
}

// comando vencedor
let winner = "S";
let winnerCount = 0;
for (const k of Object.keys(counts)) {
if (counts[k] > winnerCount) {
winnerCount = counts[k];
winner = k;
}
}

const consensus = total > 0 ? winnerCount / total : 0; // 0..1
// força 1..5 baseada no consenso
let strength = 1;
if (consensus >= 0.80) strength = 5;
else if (consensus >= 0.65) strength = 4;
else if (consensus >= 0.55) strength = 3;
else if (consensus >= 0.50) strength = 2;

return { counts, total, winner, consensus, strength };
}

setInterval(() => {
round++;
const result = computeRoundResult();

broadcast({
type: "round",
round,
...result,
});

// zera votos para próxima rodada
votes = {};
}, TICK_MS);

wss.on("connection", (ws) => {
const id = Math.random().toString(36).slice(2);
ws.id = id;
clients.add(ws);

ws.send(JSON.stringify({ type: "hello", id }));
broadcast({ type: "clients", count: clients.size });

ws.on("message", (raw) => {
let msg;
try { msg = JSON.parse(raw); } catch { return; }

if (msg.type === "vote" && msg.vote) {
votes[id] = msg.vote; // salva/atualiza voto do cliente
broadcast({ type: "vote_update", totalVotes: Object.keys(votes).length });
}
});

ws.on("close", () => {
clients.delete(ws);
delete votes[id];
broadcast({ type: "clients", count: clients.size });
});
});

server.listen(PORT, () => {
console.log(`Servidor rodando em http://localhost:${PORT}`);
});