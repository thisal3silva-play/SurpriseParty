import { createServer } from "node:http";

import next from "next";
import { Server } from "socket.io";
import { z } from "zod";

import { loadEraPhotos } from "./src/lib/era-photos";
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
const eraPhotos = loadEraPhotos();
const rooms = new RoomRegistry(undefined, eraPhotos);

const nameSchema = z.string().trim().min(1, "Enter your name.").max(24);
const codeSchema = z.string().trim().length(4, "Room codes are four characters.");
const gameSchema = z.enum(["trivia", "guess-the-era", "steph-did-that"]);
const voteSchema = z.object({ answer: z.boolean() });
const eraGuessSchema = z.object({ age: z.number().int().min(0).max(30) });
const triviaAnswerSchema = z.object({ optionIndex: z.number().int().nonnegative() });
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

    socket.on("selectGame", (input, callback) => {
      try {
        const { playerId, roomCode } = currentPlayer(socket.data);
        const room = rooms.selectGame(roomCode, playerId, gameSchema.parse(input.gameId));
        callback({ ok: true, room });
        io.to(channel(roomCode)).emit("roomUpdated", room);
      } catch (error) {
        callback({ ok: false, error: messageFor(error) });
      }
    });

    socket.on("startGame", (callback) => {
      try {
        const { playerId, roomCode } = currentPlayer(socket.data);
        const room = rooms.startGame(roomCode, playerId);
        callback({ ok: true, room });
        io.to(channel(roomCode)).emit("roomUpdated", room);
      } catch (error) {
        callback({ ok: false, error: messageFor(error) });
      }
    });

    socket.on("submitStephVote", (input, callback) => {
      try {
        const { playerId, roomCode } = currentPlayer(socket.data);
        const { answer } = voteSchema.parse(input);
        const room = rooms.submitStephVote(roomCode, playerId, answer);
        callback({ ok: true, room });
        io.to(channel(roomCode)).emit("roomUpdated", room);
      } catch (error) {
        callback({ ok: false, error: messageFor(error) });
      }
    });

    socket.on("closeStephAnswers", (callback) => {
      try {
        const { playerId, roomCode } = currentPlayer(socket.data);
        const room = rooms.closeStephAnswers(roomCode, playerId);
        callback({ ok: true, room });
        io.to(channel(roomCode)).emit("roomUpdated", room);
      } catch (error) {
        callback({ ok: false, error: messageFor(error) });
      }
    });

    socket.on("nextStephQuestion", (callback) => {
      try {
        const { playerId, roomCode } = currentPlayer(socket.data);
        const room = rooms.nextStephQuestion(roomCode, playerId);
        callback({ ok: true, room });
        io.to(channel(roomCode)).emit("roomUpdated", room);
      } catch (error) {
        callback({ ok: false, error: messageFor(error) });
      }
    });

    socket.on("submitEraGuess", (input, callback) => {
      try {
        const { playerId, roomCode } = currentPlayer(socket.data);
        const { age } = eraGuessSchema.parse(input);
        const room = rooms.submitEraGuess(roomCode, playerId, age);
        callback({ ok: true, room });
        io.to(channel(roomCode)).emit("roomUpdated", room);
      } catch (error) {
        callback({ ok: false, error: messageFor(error) });
      }
    });

    socket.on("closeEraGuesses", (callback) => {
      try {
        const { playerId, roomCode } = currentPlayer(socket.data);
        const room = rooms.closeEraGuesses(roomCode, playerId);
        callback({ ok: true, room });
        io.to(channel(roomCode)).emit("roomUpdated", room);
      } catch (error) {
        callback({ ok: false, error: messageFor(error) });
      }
    });

    socket.on("nextEraPhoto", (callback) => {
      try {
        const { playerId, roomCode } = currentPlayer(socket.data);
        const room = rooms.nextEraPhoto(roomCode, playerId);
        callback({ ok: true, room });
        io.to(channel(roomCode)).emit("roomUpdated", room);
      } catch (error) {
        callback({ ok: false, error: messageFor(error) });
      }
    });

    socket.on("submitTriviaAnswer", (input, callback) => {
      try {
        const { playerId, roomCode } = currentPlayer(socket.data);
        const { optionIndex } = triviaAnswerSchema.parse(input);
        const room = rooms.submitTriviaAnswer(roomCode, playerId, optionIndex);
        callback({ ok: true, room });
        io.to(channel(roomCode)).emit("roomUpdated", room);
      } catch (error) {
        callback({ ok: false, error: messageFor(error) });
      }
    });

    socket.on("closeTriviaAnswers", (callback) => {
      try {
        const { playerId, roomCode } = currentPlayer(socket.data);
        const room = rooms.closeTriviaAnswers(roomCode, playerId);
        callback({ ok: true, room });
        io.to(channel(roomCode)).emit("roomUpdated", room);
      } catch (error) {
        callback({ ok: false, error: messageFor(error) });
      }
    });

    socket.on("nextTriviaQuestion", (callback) => {
      try {
        const { playerId, roomCode } = currentPlayer(socket.data);
        const room = rooms.nextTriviaQuestion(roomCode, playerId);
        callback({ ok: true, room });
        io.to(channel(roomCode)).emit("roomUpdated", room);
      } catch (error) {
        callback({ ok: false, error: messageFor(error) });
      }
    });

    socket.on("disconnect", leaveCurrentRoom);
  });


function currentPlayer(data: SocketData): Required<SocketData> {
  if (!data.playerId || !data.roomCode) throw new RoomError("Join a room first.");
  return { playerId: data.playerId, roomCode: data.roomCode };
}
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
