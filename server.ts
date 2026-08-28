import { createServer } from "node:http";

import next from "next";
import { Server } from "socket.io";
import { z } from "zod";

import { RoomError, RoomRegistry } from "./src/lib/rooms";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from "./src/types/party";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "localhost";
const port = Number(process.env.PORT ?? 3000);
const app = next({ dev, hostname, port });
const requestHandler = app.getRequestHandler();
const rooms = new RoomRegistry();

const nameSchema = z.string().trim().min(1, "Enter your name.").max(24);
const codeSchema = z.string().trim().length(4, "Room codes are four characters.");
const channel = (code: string) => `party:${code}`;

async function main() {
  await app.prepare();

  const httpServer = createServer(requestHandler);
  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    SocketData
  >(httpServer);

  io.on("connection", (socket) => {
    const leaveCurrentRoom = () => {
      const { playerId, roomCode } = socket.data;
      if (!playerId || !roomCode) return;

      const nextRoom = rooms.leave(roomCode, playerId);
      socket.leave(channel(roomCode));
      socket.data = {};

      if (nextRoom) io.to(channel(roomCode)).emit("roomUpdated", nextRoom);
    };

    socket.on("createRoom", (input, callback) => {
      try {
        const name = nameSchema.parse(input.name);
        leaveCurrentRoom();
        const room = rooms.create({ id: socket.id, name, joinedAt: Date.now() });
        socket.data = { playerId: socket.id, roomCode: room.code };
        socket.join(channel(room.code));
        callback({ ok: true, room, playerId: socket.id });
        io.to(channel(room.code)).emit("roomUpdated", room);
      } catch (error) {
        callback({ ok: false, error: messageFor(error) });
      }
    });

    socket.on("joinRoom", (input, callback) => {
      try {
        const name = nameSchema.parse(input.name);
        const roomCode = codeSchema.parse(input.roomCode).toUpperCase();
        leaveCurrentRoom();
        const room = rooms.join(roomCode, {
          id: socket.id,
          name,
          joinedAt: Date.now(),
        });
        socket.data = { playerId: socket.id, roomCode: room.code };
        socket.join(channel(room.code));
        callback({ ok: true, room, playerId: socket.id });
        io.to(channel(room.code)).emit("roomUpdated", room);
      } catch (error) {
        callback({ ok: false, error: messageFor(error) });
      }
    });

    socket.on("leaveRoom", leaveCurrentRoom);
    socket.on("disconnect", leaveCurrentRoom);
  });

  httpServer.listen(port, () => {
    console.log(`Surprise Party is ready at http://${hostname}:${port}`);
  });
}

void main().catch((error: unknown) => {
  console.error("Failed to start Surprise Party:", error);
  process.exitCode = 1;
});

function messageFor(error: unknown): string {
  if (error instanceof RoomError) return error.message;
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Invalid input.";
  console.error(error);
  return "Something went wrong. Please try again.";
}
