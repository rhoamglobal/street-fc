# Street FC
npm install
npm run dev          # client on :5173, game server on :2567

Open http://localhost:5173 in two tabs -> Play online -> same code (or blank for quick match).
Phone on the same Wi-Fi: open http://<your-computer-ip>:5173 (the client finds the server on the same host, port 2567; allow both ports in your firewall).
Set VITE_SERVER_URL to point at a hosted server (e.g. wss://your-app.fly.dev).

shared/sim.ts   game rules: runs on the server (online) and in the browser (offline modes)
server/index.ts Colyseus room: takes inputs, runs sim at 60 Hz, sends snapshots at 20 Hz, AI fills empty slots
src/main.ts     3D client, menus, touch/keyboard/gamepad input
src/net.ts      connect + snapshot smoothing (no prediction yet)

## Deploy (Vercel + a game-server host)
Vercel hosts the CLIENT only (static Vite build). The game server needs a long-lived WebSocket process, which Vercel
functions can't run, so host it on Fly.io / Railway / Render using the included Dockerfile:
  fly launch   (accept the Dockerfile, internal port 2567)  ->  wss://<app>.fly.dev
Then in Vercel: import the repo (framework: Vite), add env var VITE_SERVER_URL=wss://<app>.fly.dev, redeploy.

## Notes
Clubs 0-7 colours follow an older RSSSF colours list; Rivers United and Remo Stars colours are guesses. Edit shared/data.ts.

## Deploy steps (server)
Render: New > Blueprint > pick this repo (uses render.yaml). Copy the https URL, use it as wss://<host> below.
Railway: New Project > Deploy from GitHub repo (it uses the Dockerfile) > Settings > Networking > Generate Domain (port 2567 or leave default; the server reads PORT).
Then Vercel: Import the repo (Vite), add VITE_SERVER_URL=wss://<your-server-host>, Deploy.
Check: open https://<your-server-host>/matchmake/ in a browser. Seeing [] means the server is up (the bare / address shows nothing, that is normal).

## Online modes
Quick match: 12s countdown then auto-start, bots fill empty slots, late joiners take over a bot.
Private room: share the invite link (?room=CODE) or the 5-letter code. Host picks "against each other" or "together vs bots", everyone taps Ready, host starts.
Humans on both sides -> captains do the heads/tails toss, winner picks the stadium; otherwise the host picks stadium and kits. Room locks at kickoff; after full time it returns to the waiting room.
A dropped connection keeps your player (a bot covers) for 60s while the client retries.

## Gamepad
Plug in / pair a controller and press any button. In a match: left stick or d-pad move, X(cross) pass / press / call, Square shoot (hold) / tackle, Triangle through pass, Circle lob / slide, L1 switch, R1 sprint, L2 shield, R2 knock-on, Start = pause menu.
In menus: d-pad or left stick moves the highlight, X selects, Circle goes back, Start resumes. Touch controls hide while a pad is connected.

Team / stadium pickers: use the arrow buttons (touch) or d-pad left/right (gamepad) to cycle; up/down moves between rows.

## Gameplay notes
Online, the camera follows your own player. Passes: tap Pass for an assisted pass to the best open teammate in the direction you push; the ball bends toward its receiver. Press Pass/Shoot as the ball arrives for a one-touch. Shots are NOT aim-assisted. Fouls only happen on a slide tackle from behind.

## Lag
Online play predicts your own movement locally, interpolates everyone else ~100ms in the past, shows ping (top-left), and lowers render resolution on slow phones. Dev tools: run the server with LAG=100 to fake ~200ms round trip; add ?nopredict to the page URL to compare without prediction.

## Wow + retention features
Sound (synthesised, toggle top-left or in the main menu) and vibration on goals/tackles; install as an app (manifest + service worker; needs HTTPS, so use the Vercel URL; on iPhone use Share > Add to Home Screen);
guided tutorial on first play (Training mode); slow-motion goal replays (Skip button); Street Cup (QF, SF, Final vs Nigerian clubs, saved on the phone; draws go to a golden goal, then a coin toss);
career stats saved on the phone (played, won, goals, man of the match, cups). Accounts + a shared leaderboard need a backend (Supabase) - not built yet.
