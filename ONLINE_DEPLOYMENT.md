# Four Crowns — Play Online on Phone, Tablet, Laptop

Four Crowns is a responsive multiplayer **website**, not an Android or iOS app requiring installation. Run one Node.js server on the internet; all four players visit its **same HTTPS URL**, choose unique houses, and join a six-character room.

**This edition is intentionally silent.** It has no audio files, autoplay, or music controls.

## Recommended: Render (GitHub → public HTTPS link)

1. Extract the ZIP. Open the `four-crowns-online` folder (the folder containing `package.json`, `server.js`, `render.yaml` and `public/`).
2. Create an empty repository on [GitHub](https://github.com/new), for example `four-crowns-online`. Add no README on GitHub because the project already has one.
3. In the extracted folder, open a terminal and run:

   ```bash
   git init -b main
   git add .
   git commit -m "Deploy Four Crowns online"
   git remote add origin https://github.com/YOUR_USERNAME/four-crowns-online.git
   git push -u origin main
   ```

   Change `YOUR_USERNAME` to your GitHub username. GitHub may prompt for authentication; GitHub does not accept ordinary account passwords for Git pushes.
4. Open [Render dashboard](https://dashboard.render.com/), create an account, and connect GitHub.
5. Choose **New → Blueprint** and select the repository. Render reads the included `render.yaml`. Alternatively choose **New → Web Service** and set **Runtime: Node**, **Build: `npm install --no-audit --no-fund`**, **Start: `npm start`**, **Health check: `/api/health`**, and **Instance: Free (demo) or Starter (more reliable)**.
6. Approve deployment. Wait until Render reports **Live** and shows a URL such as `https://four-crowns-online-xxxx.onrender.com`. This is an EXAMPLE URL, not a deployed game link.
7. Open that URL on your laptop. Enter your name and **Create Room**. Use **ROOM CODE** to copy the invite URL; share it via messaging with three friends.
8. Each friend opens the SAME web URL on their phone, tablet or laptop, enters their own name, joins via the code, and selects a different house. Four players mark Ready; the host starts the game.
9. Verify the server is healthy by visiting `https://YOUR_DEPLOYED_HOST/api/health` (should return JSON with `ok: true`).

### Important hosting caveats

- The server stores games **in RAM**, not in a database. **A host restart or redeploy loses active rooms and current matches.** If this matters, ask to add a persistent database before treating the game as production-ready.
- Use **one running server instance / one replica**. Multiple replicas with separate RAM have conflicting room state. The included Render and Railway settings assume single-instance deployment.
- Render's **free** web service can spin down after 15 minutes of inactivity and take time to wake up. Restarts/spin-down erase in-memory matches. For uninterrupted class demonstrations, consider a paid always-on service.
- A phone using cellular data can play with a laptop on home Wi-Fi because both reach the same HTTPS website.
- Do **not** use GitHub Pages or another static-only web host: multiplayer relies on the Node.js backend.
- Share only the **public room invite link**, never the private `token` present inside individual authenticated event-stream requests.

## Alternative: Railway

1. Upload/push the folder to GitHub as above.
2. Go to [Railway](https://railway.com/), create a project, and **Deploy from GitHub repo**.
3. Railway uses included `railway.json`: Node.js start command `npm start`, `/api/health`, and one replica. Add an HTTPS public domain in the service's networking settings.
4. Share the public HTTPS URL and six-character room code. Railway pricing / free trial depends on your account; verify on its website.

## Alternative: Your own VPS / university server

Install Node 20 or newer. From the project folder run:

```bash
NODE_ENV=production HOST=0.0.0.0 PORT=3000 npm start
```

Use a reverse proxy (for example Caddy or Nginx) to provide HTTPS and a public domain. Proxy both normal requests and `/api/events` (an SSE stream); disable buffering and allow connections to stay open. Open only 80/443 externally, not a raw Node process if using a reverse proxy. Consider a process manager/systemd and firewall. Run **one** Node instance.

## Mobile gameplay

- The responsive layout supports narrow phones, landscape tablets, desktop browsers, and touch interactions. The card hand scrolls horizontally on smaller screens.
- A saved room can be recovered with the **Resume Last Room** button if the same server room still exists, even after reopening the browser. Do not use that button on a shared device to impersonate someone else's seat.
- Desktop and mobile users receive the same synchronized events. Turns are sequential (like card strategy games); attacked players respond in real time during a 25-second response window.
- You can use **Add to Home Screen** in Safari/Chrome where supported to create a convenient launcher. An internet connection is still required to play.

## Test locally first

```bash
npm test
npm start
```

Open `http://localhost:3000` in a browser. Use separate browser profiles or devices to simulate four unique players.

## Online troubleshooting

| Problem | What to check |
|---|---|
| "Room not found" | Are all four players using the **same URL / hosted service**? Did the host restart? Was the room code copied correctly? |
| Waiting for server | Check `/api/health` and hosting logs; free servers may take time to wake. |
| "RECONNECTING" | Check mobile internet signal and server health. SSE reconnects automatically when the connection recovers. |
| Everyone appears as one player | Use different phones/browsers. If testing in browser tabs, avoid duplicating a tab with cloned session state. |
| Friend cannot join | Room accepts exactly four players and closes after the match begins. |
| Home screen app cannot run offline | The game requires the server for moves, cards, and state synchronization. |
| Match vanished | This demo uses memory-only storage; a server restart clears games. |

## What the server does

- `POST /api/create` — create game room
- `POST /api/join` — join by room code
- `POST /api/resume` — restore session state with private token
- `POST /api/action` — validate and execute a player's turn or response
- `GET /api/events?code=…&token=…` — private Server-Sent Events (SSE) state updates
- `GET /api/health` — deployment health endpoint

**Do not mistake this deployment-ready ZIP for a deployed/live public URL.** The website becomes accessible from anywhere only **after you deploy it to your hosting account**.
