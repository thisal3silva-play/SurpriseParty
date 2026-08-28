import { randomInt } from "node:crypto";

import type { Player, RoomState } from "@/types/party";

const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const MAX_PLAYERS = 12;

type MutableRoom = RoomState;

function randomRoomCode(): string {
  return Array.from(
    { length: 4 },
    () => ROOM_CODE_CHARS[randomInt(ROOM_CODE_CHARS.length)],
  ).join("");
}

export class RoomError extends Error {}

export class RoomRegistry {
  private readonly rooms = new Map<string, MutableRoom>();

  constructor(private readonly makeCode: () => string = randomRoomCode) {}

  create(player: Player): RoomState {
    let code = this.makeCode().toUpperCase();
    let attempts = 0;

    while (this.rooms.has(code) && attempts < 20) {
      code = this.makeCode().toUpperCase();
      attempts += 1;
    }

    if (this.rooms.has(code)) {
      throw new RoomError("Could not create a unique room. Please try again.");
    }

    const room: MutableRoom = {
      code,
      hostId: player.id,
      players: [player],
      selectedGame: null,
      status: "lobby",
    };

    this.rooms.set(code, room);
    return this.snapshot(room);
  }

  join(codeInput: string, player: Player): RoomState {
    const code = codeInput.trim().toUpperCase();
    const room = this.rooms.get(code);

    if (!room) throw new RoomError("That room does not exist.");
    if (room.status !== "lobby") {
      throw new RoomError("That game has already started.");
    }
    if (room.players.length >= MAX_PLAYERS) {
      throw new RoomError("That room is full.");
    }
    if (room.players.some(({ name }) => name.toLowerCase() === player.name.toLowerCase())) {
      throw new RoomError("That name is already being used in this room.");
    }

    room.players.push(player);
    return this.snapshot(room);
  }

  leave(codeInput: string, playerId: string): RoomState | null {
    const code = codeInput.toUpperCase();
    const room = this.rooms.get(code);

    if (!room) return null;

    room.players = room.players.filter((player) => player.id !== playerId);
    if (room.players.length === 0) {
      this.rooms.delete(code);
      return null;
    }

    if (room.hostId === playerId) room.hostId = room.players[0].id;
    return this.snapshot(room);
  }

  get(codeInput: string): RoomState | null {
    const room = this.rooms.get(codeInput.trim().toUpperCase());
    return room ? this.snapshot(room) : null;
  }

  private snapshot(room: MutableRoom): RoomState {
    return { ...room, players: room.players.map((player) => ({ ...player })) };
  }
}
