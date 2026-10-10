import './admin.css';

type RoomStat = { roomId: string; type: string; phase: string; players: number; capacity: number; field: string; mode: string };
type Stats = {
  capturedAt: string; uptimeSeconds: number; onlinePlayers: number; activeRooms: number;
  matchesInProgress: number; playersInMatches: number; waitingRooms: number;
  joinsSinceBoot: number; matchesStartedSinceBoot: number; completedMatchesSinceBoot: number;
  disconnectsSinceBoot: number; peakPlayersSinceBoot: number;
  serverHealth: { cpuPercent: number; memoryRssMb: number; heapUsedMb: number };
  performance: { averageSimulationTickMs: number; maxSimulationTickMs: number; simulationSamples: number; averageClientRttMs: number; maxClientRttMs: number; clientsReportingRtt: number };
  rooms: RoomStat[];
};

const $ = (id: string) => document.getElementById(id)!;
const form = $('auth-form') as HTMLFormElement;
const tokenInput = $('admin-token') as HTMLInputElement;
const statusLine = $('status');
const dashboard = $('dashboard');
let token = '';
let timer: number | undefined;

function endpoint() {
  const explicit = import.meta.env.VITE_ADMIN_API_URL as string | undefined;
  if (explicit) return `${explicit.replace(/\/$/, '')}/admin/analytics`;
  const gameServer = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (gameServer) return `${gameServer.replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:').replace(/\/$/, '')}/admin/analytics`;
  return `${location.protocol === 'https:' ? 'https:' : 'http:'}//${location.hostname}:2567/admin/analytics`;
}

function showStatus(message: string, kind: 'ok' | 'error' | 'idle' = 'idle') {
  statusLine.textContent = message;
  statusLine.className = `status ${kind}`;
}

function duration(seconds: number) {
  const days = Math.floor(seconds / 86400), hours = Math.floor(seconds % 86400 / 3600), minutes = Math.floor(seconds % 3600 / 60);
  return days ? `${days}d ${hours}h` : hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function roomCell(value: string | number) {
  const cell = document.createElement('td');
  cell.textContent = String(value);
  return cell;
}

function render(data: Stats) {
  $('online-players').textContent = String(data.onlinePlayers);
  $('active-rooms').textContent = String(data.activeRooms);
  $('live-matches').textContent = String(data.matchesInProgress);
  $('match-players').textContent = `${data.playersInMatches} players in matches`;
  $('waiting-rooms').textContent = String(data.waitingRooms);
  $('uptime').textContent = duration(data.uptimeSeconds);
  $('joins').textContent = `${data.joinsSinceBoot} joins`;
  $('matches-started').textContent = `${data.matchesStartedSinceBoot} matches started`;
  $('peak-players').textContent = String(data.peakPlayersSinceBoot);
  $('completed-matches').textContent = `${data.completedMatchesSinceBoot} completed matches`;
  $('disconnects').textContent = `${data.disconnectsSinceBoot} disconnects`;
  $('cpu').textContent = `${data.serverHealth.cpuPercent}%`;
  $('memory').textContent = `${data.serverHealth.memoryRssMb} MB RSS · ${data.serverHealth.heapUsedMb} MB heap`;
  $('simulation').textContent = `${data.performance.averageSimulationTickMs} ms`;
  $('simulation-max').textContent = `${data.performance.maxSimulationTickMs} ms max · ${data.performance.simulationSamples.toLocaleString()} ticks`;
  $('network').textContent = `${data.performance.averageClientRttMs} ms`;
  $('network-max').textContent = `${data.performance.maxClientRttMs} ms max · ${data.performance.clientsReportingRtt} clients`;
  $('updated-at').textContent = `Updated ${new Date(data.capturedAt).toLocaleTimeString()}`;

  const body = $('rooms');
  body.replaceChildren();
  if (!data.rooms.length) {
    const row = document.createElement('tr'), empty = document.createElement('td');
    empty.colSpan = 6; empty.className = 'empty'; empty.textContent = 'No active rooms.'; row.append(empty); body.append(row); return;
  }
  for (const room of data.rooms) {
    const row = document.createElement('tr');
    row.append(roomCell(room.roomId.slice(0, 8)), roomCell(room.type), roomCell(room.phase.replace(/_/g, ' ')), roomCell(`${room.players} / ${room.capacity}`), roomCell(room.mode), roomCell(room.field));
    body.append(row);
  }
}

async function refresh(): Promise<boolean> {
  if (!token) return false;
  const currentToken = token;
  try {
    const response = await fetch(endpoint(), { headers: { Authorization: `Bearer ${currentToken}` }, cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    if (currentToken !== token) return false;
    render(data as Stats);
    dashboard.hidden = false;
    $('disconnect').hidden = false;
    showStatus('Connected. Refreshing every 10 seconds.', 'ok');
    return true;
  } catch (error) {
    if (currentToken !== token) return false;
    dashboard.hidden = true;
    showStatus(error instanceof Error ? error.message : 'Could not load analytics.', 'error');
    if (timer) window.clearInterval(timer);
    timer = undefined;
    return false;
  }
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  token = tokenInput.value.trim();
  if (!token) return;
  if (timer) window.clearInterval(timer);
  if (await refresh() && token) timer = window.setInterval(refresh, 10_000);
});

$('disconnect').addEventListener('click', () => {
  token = '';
  tokenInput.value = '';
  dashboard.hidden = true;
  $('disconnect').hidden = true;
  if (timer) window.clearInterval(timer);
  timer = undefined;
  showStatus('Dashboard is disconnected.');
});
