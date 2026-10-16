# Anything but a Game Controller

A complete starter project for the brief: a phone becomes a motion controller for a browser game on a laptop. Includes a Node.js WebSocket server, room pairing, QR code, gyroscope/accelerometer input, calibration, reconnect handling, a Canvas maze game, manual controls, and live telemetry.

## Requirements covered

- [x] Read gyroscope/orientation and accelerometer/motion events; map tilt to X/Y controls and shake to jump.
- [x] Pair phone and laptop using a QR code or room code.
- [x] Stream input over WebSockets at a 20 Hz send interval (50 ms); game runs on `requestAnimationFrame`.
- [x] Browser game controlled by phone; includes a motion maze, walls, hazard, goal, and keyboard fallback.
- [x] Neutral-position calibration.
- [x] Connection status on both devices and automatic WebSocket reconnection.
- [x] Live tilt, connected-phone count, packet time, and approximate end-to-end packet age.
- [x] On-screen phone buttons as fallback and multiplayer-ready room/session architecture.
- [x] README with stack, pairing, latency approach, and run instructions.

## Tech stack

- Node.js + Express serves the web app.
- `ws` provides bidirectional WebSocket communication.
- `qrcode` generates the room pairing QR code.
- HTML/CSS/JavaScript and Canvas render the laptop game.
- DeviceOrientation and DeviceMotion browser APIs read phone sensors.

## Run locally

1. Install Node.js 18 or newer.
2. Unzip the project and open a terminal in this folder.
3. Run `npm install`.
4. Run `npm start`.
5. On the laptop, open `http://localhost:3000`.
6. Click **Create pairing room**. Scan the QR with your phone.
7. If the phone cannot reach the laptop, use the laptop's LAN IP in the controller URL (for example `http://192.168.1.20:3000/controller.html?room=ABC123`). Allow port 3000 through the local firewall if needed.
8. Tap **Enable motion**, hold the phone flat, tap **Calibrate neutral**, then press **Start / restart game** on the laptop.

### Important sensor/browser notes

- Motion sensor access is generally restricted to HTTPS on deployed sites; localhost is treated as a secure context. For a physical phone on a local network, use an HTTPS tunnel or deploy behind HTTPS if the browser blocks sensor APIs.
- On iOS, tap **Enable motion** to trigger the browser's permission request.
- If sensors are unavailable, the phone's arrow pad and Jump button still work.
- Use a modern browser on both devices. Keep the controller tab visible to avoid background throttling.

## Pairing and message protocol

The laptop requests a new room from `GET /api/room`, which returns a short room code, controller URL, and QR data URL. Both devices join the same room through WebSocket messages. Controller motion packets contain normalized `x` and `y` values in `[-1, 1]`, jump/shake flags, and a client timestamp. The server forwards controller packets to the game client.

## Latency approach

- Controller samples are sent every 50 ms (nominal 20 Hz).
- The game updates at the browser animation frame rate and uses velocity smoothing to reduce jitter.
- The UI shows packet age based on the phone's timestamp; this is an approximate measure and can be skewed by clock differences between devices. For rigorous measurements, add server-side timestamps and a synchronized clock or ping/pong round-trip measurement.
- The server relays the latest controls rather than queuing a long backlog, so temporary network congestion does not create a long input queue.

## Security and deployment

This is a demo project, not a hardened public service. Rooms are short and unguessable enough for a local demo, but there is no authentication, rate limiting, or persistent session storage. Use HTTPS/WSS and add access controls before exposing it publicly.

## Deliverables checklist

- [x] App source
- [x] Game source
- [x] WebSocket server source
- [x] Pairing QR implementation
- [x] README and setup guide
- [ ] Public hosted build link — requires deployment credentials/hosting
- [ ] Real phone-to-laptop screen recording — must be recorded while running on physical devices

The source project is ready to run locally. A hosted URL and genuine device recording cannot be truthfully included without deploying the app and testing/recording it on actual devices.
