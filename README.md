# Surprise Party

A full-stack starter for browser-based birthday party games. Players can create a temporary room, share a four-character code, join with a display name, and see the lobby update in real time.

## What is included

- Next.js App Router, React, TypeScript, and Tailwind CSS
- A responsive birthday-themed landing page and multiplayer lobby
- Socket.IO room creation, joining, leaving, host migration, and presence updates
- Shared, strongly typed client/server events
- An in-memory room registry with validation and unit tests
- Playable Birthday Trivia, “Steph did that!?”, and “Guess the Era” party games
- ESLint, strict TypeScript, and Vitest configuration

## Requirements

- Node.js 20.9 or newer
- npm 10 or newer

## Start developing

1. Install dependencies:

   `npm install`

2. Copy `.env.example` to `.env.local` if you want to change the port.

3. Start the custom Next.js and Socket.IO development server:

   `npm run dev`

4. Open [http://localhost:3000](http://localhost:3000). Open another browser or private window to test multiple players.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Next.js and Socket.IO with reloads |
| `npm run build` | Create a production Next.js build |
| `npm start` | Run the production custom server |
| `npm run typecheck` | Check TypeScript |
| `npm run lint` | Run ESLint |
| `npm test` | Run the room registry tests |

## Project map

- `server.ts` — custom HTTP server and typed Socket.IO event handlers
- `src/app` — App Router pages, metadata, and global styles
- `src/components/party-lobby.tsx` — create/join flow and live room UI
- `src/lib/rooms.ts` — server-side room state and rules
- `src/lib/socket.ts` — browser Socket.IO singleton
- `src/types/party.ts` — shared room and event contracts

## Adding the first game

1. Add its identifier to `GameId` in `src/types/party.ts`.
2. Add game-specific state and commands to the shared event contracts.
3. Implement authoritative game rules on the server; do not trust scores sent by browsers.
4. Add a route such as `src/app/room/[code]/trivia/page.tsx` or switch the lobby view based on room status.
5. Add server tests for scoring, turn order, time limits, reconnects, and host changes.

## Adding Guess the Era photos

Place Stephanie photos in `content/steph-eras`. Start each filename with her age when the photo was taken, followed by an optional description:

- `0-newborn.jpg`
- `7-first-day-of-school.png`
- `18-graduation.webp`
- `30-birthday.jpeg`

Ages must be whole numbers from 0 through 30. AVIF, GIF, JPG/JPEG, PNG, and WebP images are supported. Restart the server after changing the photos. The application serves each image through an opaque URL so the filename does not reveal the answer during play.

## Editing game questions

Question banks are editable JSON files in `content/questions`. Restart the server after changing them.

For `steph-did-that.json`, each entry has a question and a true/false answer:

```json
{
   "question": "Steph has eaten cake for breakfast three days in a row.",
   "answer": true
}
```

For `birthday-trivia.json`, each entry has a question, an array of answer options, and the zero-based index of the correct option. In this example, `1` means the second option:

```json
{
   "question": "A golden birthday happens when your age matches what?",
   "options": ["Your birth month", "Your birth date", "Your birth year"],
   "answer": 1
}
```

The server validates both files at startup and does not send correct answers to players before the host reveals them.

## Production notes

The room registry is intentionally in memory, so rooms disappear whenever the server restarts. The custom server also requires a host that supports a long-running Node.js process and WebSockets; it is not designed for a serverless-only deployment.

Before scaling beyond one server instance, move room state to a durable store and add the Socket.IO Redis adapter. Also add authentication or signed reconnect tokens, rate limits, structured logging, origin restrictions, and monitoring.
