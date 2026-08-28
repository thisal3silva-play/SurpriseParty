# Surprise Party coding guidelines

- Use strict TypeScript and shared event types from `src/types/party.ts`.
- Keep multiplayer game state authoritative on the server. Clients submit intentions, never trusted scores or outcomes.
- Keep room and game rules independent from Socket.IO handlers so they remain easy to unit test.
- Validate every client payload and return player-safe error messages.
- Preserve the cheerful, accessible, mobile-first visual language in `src/app/globals.css`.
- Add tests for rule changes, especially host migration, disconnects, capacity, scoring, and turn order.
- Do not put secrets in `NEXT_PUBLIC_*` environment variables.
