import { describe, expect, it } from "vitest";

import { MAX_PLAYERS, RoomError, RoomRegistry } from "./rooms";

const player = (id: string, name = id) => ({ id, name, joinedAt: Date.now() });

describe("RoomRegistry", () => {
  it("creates a room and makes its creator the host", () => {
    const rooms = new RoomRegistry(() => "CAKE");

    const room = rooms.create(player("one", "Maya"));

    expect(room.code).toBe("CAKE");
    expect(room.hostId).toBe("one");
    expect(room.players).toHaveLength(1);
  });

  it("joins room codes without case sensitivity", () => {
    const rooms = new RoomRegistry(() => "CAKE");
    rooms.create(player("one", "Maya"));

    const room = rooms.join("cake", player("two", "Noah"));

    expect(room.players.map(({ name }) => name)).toEqual(["Maya", "Noah"]);
  });

  it("rejects duplicate display names", () => {
    const rooms = new RoomRegistry(() => "CAKE");
    rooms.create(player("one", "Maya"));

    expect(() => rooms.join("CAKE", player("two", "maya"))).toThrow(RoomError);
  });

  it("promotes the next player when the host leaves", () => {
    const rooms = new RoomRegistry(() => "CAKE");
    rooms.create(player("one", "Maya"));
    rooms.join("CAKE", player("two", "Noah"));

    const room = rooms.leave("CAKE", "one");

    expect(room?.hostId).toBe("two");
  });

  it("enforces the room capacity", () => {
    const rooms = new RoomRegistry(() => "CAKE");
    rooms.create(player("0"));
    for (let index = 1; index < MAX_PLAYERS; index += 1) {
      rooms.join("CAKE", player(String(index)));
    }

    expect(() => rooms.join("CAKE", player("extra"))).toThrow("full");
  });
});
