# ATTI — Real-Time Communication App (CodeAlpha Task 4)

Multi-user video calling, screen sharing, file sharing, and a shared whiteboard, with
username/password authentication. Video, screen, and file data all travel peer-to-peer
over WebRTC (encrypted by default via DTLS-SRTP) — the server only handles login and
signaling, never touches your media.

## Files
- `server.js` — Express + Socket.IO server: auth (register/login) and WebRTC signaling relay
- `public/index.html` — entire frontend: auth screen, room join, video grid, controls,
  chat, file transfer, whiteboard
- `package.json` — dependencies (`express`, `socket.io`)

## How it meets the task brief
| Requirement | Where |
|---|---|
| Video calling (multi-user) | Full mesh WebRTC — each peer connects directly to every other peer in the room |
| Screen sharing | `getDisplayMedia()` swaps the outgoing video track on every peer connection |
| File sharing | Sent in chunks over a WebRTC `RTCDataChannel`, peer-to-peer |
| Whiteboard | HTML canvas; draw events relayed to the room via Socket.IO |
| Data encryption | WebRTC's built-in DTLS-SRTP encrypts all media/data channels in transit |
| User authentication | Username/password, PBKDF2-hashed, session tokens (in-memory store) |

## Deploy on Render (matches your existing ATTI setup)
1. Upload these 3 files (`server.js`, `package.json`, `public/index.html`) to your
   `CodeAlpha_ProjectName` GitHub repo via the GitHub web upload UI, keeping
   `index.html` inside a `public/` folder.
2. On Render: New → Web Service → connect the repo.
   - Build command: `npm install`
   - Start command: `npm start`
3. Once deployed, open the Render URL, create an account, share the room code with a
   friend on another device/browser, and join the same room from both.

## Known scope limits (fine for internship scope)
- Auth store is in-memory — restarting the server clears accounts. Swap in a real DB
  (Supabase, like your other projects) if you want persistence.
- Mesh video works well for small rooms (2–4 people); very large rooms would need an
  SFU media server instead of full mesh.
- TURN is not configured (same as your existing ATTI notes) — calls between two
  strict/corporate networks may need a TURN relay to connect.
