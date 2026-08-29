import { describe, expect, it } from "vitest";

import { MAX_PLAYERS, RoomError, RoomRegistry, STEPH_QUESTIONS, TRIVIA_QUESTIONS } from "./rooms";

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

  it("allows multiple players to join the same room", () => {
    const rooms = new RoomRegistry(() => "CAKE");
    rooms.create(player("host", "Maya"));

    rooms.join("CAKE", player("two", "Noah"));
    rooms.join("CAKE", player("three", "Avery"));
    const room = rooms.join("CAKE", player("four", "Jordan"));

    expect(room.players.map(({ name }) => name)).toEqual(["Maya", "Noah", "Avery", "Jordan"]);
  });

  it("allows players to join after a game has started", () => {
    const rooms = new RoomRegistry(() => "CAKE");
    rooms.create(player("host", "Maya"));
    rooms.selectGame("CAKE", "host", "trivia");
    rooms.startGame("CAKE", "host");

    const room = rooms.join("CAKE", player("late", "Noah"));

    expect(room.players.map(({ name }) => name)).toEqual(["Maya", "Noah"]);
    expect(room.gameState).toMatchObject({ game: "trivia", phase: "answering" });
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

  it("only lets the host select and start Steph did that!?", () => {
    const rooms = new RoomRegistry(() => "CAKE");
    rooms.create(player("host"));
    rooms.join("CAKE", player("guest"));

    expect(() => rooms.selectGame("CAKE", "guest", "steph-did-that")).toThrow("host");
    rooms.selectGame("CAKE", "host", "steph-did-that");
    const room = rooms.startGame("CAKE", "host");

    expect(room.status).toBe("playing");
    expect(room.gameState).toMatchObject({ phase: "voting", questionNumber: 1, votesReceived: 0 });
  });

  it("keeps answers private until the host closes voting", () => {
    const rooms = new RoomRegistry(() => "CAKE");
    rooms.create(player("host"));
    rooms.join("CAKE", player("guest"));
    rooms.selectGame("CAKE", "host", "steph-did-that");
    rooms.startGame("CAKE", "host");

    rooms.submitStephVote("CAKE", "host", false);
    const voting = rooms.submitStephVote("CAKE", "guest", true);
    expect(voting.gameState).toMatchObject({ phase: "voting", votesReceived: 2 });
    expect(voting.gameState).not.toHaveProperty("correctAnswer");
    expect(voting.gameState).not.toHaveProperty("trueVotes");

    const revealed = rooms.closeStephAnswers("CAKE", "host");
    expect(revealed.gameState).toMatchObject({
      phase: "revealed",
      trueVotes: 1,
      falseVotes: 1,
      correctAnswer: false,
    });
    expect(revealed.leaderboard).toEqual([
      { playerId: "host", playerName: "host", points: 5 },
      { playerId: "guest", playerName: "guest", points: 0 },
    ]);
  });

  it("lets a player change an answer before voting closes", () => {
    const rooms = new RoomRegistry(() => "CAKE");
    rooms.create(player("host"));
    rooms.selectGame("CAKE", "host", "steph-did-that");
    rooms.startGame("CAKE", "host");

    rooms.submitStephVote("CAKE", "host", true);
    rooms.submitStephVote("CAKE", "host", false);
    const revealed = rooms.closeStephAnswers("CAKE", "host");

    expect(revealed.gameState).toMatchObject({ trueVotes: 0, falseVotes: 1 });
  });

  it("advances to a fresh question after answers are revealed", () => {
    const rooms = new RoomRegistry(() => "CAKE");
    rooms.create(player("host"));
    rooms.selectGame("CAKE", "host", "steph-did-that");
    rooms.startGame("CAKE", "host");
    rooms.submitStephVote("CAKE", "host", true);
    rooms.closeStephAnswers("CAKE", "host");

    const room = rooms.nextStephQuestion("CAKE", "host");

    expect(room.gameState).toMatchObject({ phase: "voting", questionNumber: 2, votesReceived: 0 });
  });

  it("keeps era ages and guesses private until the host reveals them", () => {
    const photos = [
      { imageUrl: "/api/era-photo/opaque-one", age: 7 },
      { imageUrl: "/api/era-photo/opaque-two", age: 18 },
    ];
    const rooms = new RoomRegistry(() => "CAKE", photos);
    rooms.create(player("host", "Maya"));
    rooms.join("CAKE", player("guest", "Noah"));
    rooms.selectGame("CAKE", "host", "guess-the-era");
    rooms.startGame("CAKE", "host");

    rooms.submitEraGuess("CAKE", "host", 6);
    const guessing = rooms.submitEraGuess("CAKE", "guest", 7);
    expect(guessing.gameState).toMatchObject({
      game: "guess-the-era",
      phase: "guessing",
      imageUrl: "/api/era-photo/opaque-one",
      guessesReceived: 2,
    });
    expect(guessing.gameState).not.toHaveProperty("correctAge");
    expect(guessing.gameState).not.toHaveProperty("guesses");

    expect(() => rooms.closeEraGuesses("CAKE", "guest")).toThrow("host");
    const revealed = rooms.closeEraGuesses("CAKE", "host");
    expect(revealed.gameState).toMatchObject({
      phase: "revealed",
      correctAge: 7,
      guesses: [
        { playerName: "Maya", age: 6 },
        { playerName: "Noah", age: 7 },
      ],
    });
    expect(revealed.leaderboard).toEqual([
      { playerId: "guest", playerName: "Noah", points: 5 },
      { playerId: "host", playerName: "Maya", points: 0 },
    ]);
  });

  it("validates and replaces era guesses before reveal", () => {
    const rooms = new RoomRegistry(
      () => "CAKE",
      [{ imageUrl: "/api/era-photo/opaque", age: 12 }],
    );
    rooms.create(player("host"));
    rooms.selectGame("CAKE", "host", "guess-the-era");
    rooms.startGame("CAKE", "host");

    expect(() => rooms.submitEraGuess("CAKE", "host", 31)).toThrow("0 to 30");
    rooms.submitEraGuess("CAKE", "host", 10);
    rooms.submitEraGuess("CAKE", "host", 12);
    const revealed = rooms.closeEraGuesses("CAKE", "host");

    expect(revealed.gameState).toMatchObject({ guesses: [{ age: 12 }] });
  });

  it("advances through era photos and returns to the lobby", () => {
    const rooms = new RoomRegistry(
      () => "CAKE",
      [
        { imageUrl: "/api/era-photo/one", age: 4 },
        { imageUrl: "/api/era-photo/two", age: 20 },
      ],
    );
    rooms.create(player("host"));
    rooms.selectGame("CAKE", "host", "guess-the-era");
    rooms.startGame("CAKE", "host");
    rooms.closeEraGuesses("CAKE", "host");

    const secondPhoto = rooms.nextEraPhoto("CAKE", "host");
    expect(secondPhoto.gameState).toMatchObject({ phase: "guessing", photoNumber: 2, guessesReceived: 0 });

    rooms.closeEraGuesses("CAKE", "host");
    const finished = rooms.nextEraPhoto("CAKE", "host");
    expect(finished).toMatchObject({ status: "lobby", selectedGame: null, gameState: null });
  });

  it("requires an uploaded photo before Guess the Era can start", () => {
    const rooms = new RoomRegistry(() => "CAKE");
    rooms.create(player("host"));
    rooms.selectGame("CAKE", "host", "guess-the-era");

    expect(() => rooms.startGame("CAKE", "host")).toThrow("photo");
  });

  it("keeps a player's score when they reconnect with the same name", () => {
    const rooms = new RoomRegistry(() => "CAKE");
    rooms.create(player("old-socket", "Maya"));
    rooms.join("CAKE", player("keeper", "Noah"));
    rooms.selectGame("CAKE", "old-socket", "steph-did-that");
    rooms.startGame("CAKE", "old-socket");
    rooms.submitStephVote("CAKE", "old-socket", STEPH_QUESTIONS[0].answer);
    rooms.closeStephAnswers("CAKE", "old-socket");

    for (let index = 1; index < STEPH_QUESTIONS.length; index += 1) {
      rooms.nextStephQuestion("CAKE", "old-socket");
      rooms.closeStephAnswers("CAKE", "old-socket");
    }
    rooms.nextStephQuestion("CAKE", "old-socket");

    rooms.leave("CAKE", "old-socket");
    const rejoined = rooms.join("CAKE", player("new-socket", "Maya"));

    expect(rejoined.leaderboard).toContainEqual({
      playerId: "new-socket",
      playerName: "Maya",
      points: 5,
    });
  });

  it("accumulates points from every game during the room session", () => {
    const rooms = new RoomRegistry(
      () => "CAKE",
      [{ imageUrl: "/api/era-photo/opaque", age: 12 }],
    );
    rooms.create(player("host", "Maya"));
    rooms.selectGame("CAKE", "host", "steph-did-that");
    rooms.startGame("CAKE", "host");

    for (const question of STEPH_QUESTIONS) {
      rooms.submitStephVote("CAKE", "host", question.answer);
      rooms.closeStephAnswers("CAKE", "host");
      rooms.nextStephQuestion("CAKE", "host");
    }

    rooms.selectGame("CAKE", "host", "guess-the-era");
    rooms.startGame("CAKE", "host");
    rooms.submitEraGuess("CAKE", "host", 12);
    const revealed = rooms.closeEraGuesses("CAKE", "host");

    expect(revealed.leaderboard).toEqual([
      { playerId: "host", playerName: "Maya", points: 30 },
    ]);
  });

  it("keeps trivia answers private until the host reveals them", () => {
    const rooms = new RoomRegistry(() => "CAKE");
    rooms.create(player("host", "Maya"));
    rooms.join("CAKE", player("guest", "Noah"));
    rooms.selectGame("CAKE", "host", "trivia");
    rooms.startGame("CAKE", "host");

    const correct = TRIVIA_QUESTIONS[0].answer;
    const wrong = (correct + 1) % TRIVIA_QUESTIONS[0].options.length;
    rooms.submitTriviaAnswer("CAKE", "host", correct);
    const answering = rooms.submitTriviaAnswer("CAKE", "guest", wrong);

    expect(answering.gameState).toMatchObject({
      game: "trivia",
      phase: "answering",
      answersReceived: 2,
    });
    expect(answering.gameState).not.toHaveProperty("correctOptionIndex");
    expect(answering.gameState).not.toHaveProperty("answerCounts");
    expect(() => rooms.closeTriviaAnswers("CAKE", "guest")).toThrow("host");

    const revealed = rooms.closeTriviaAnswers("CAKE", "host");
    expect(revealed.gameState).toMatchObject({
      phase: "revealed",
      correctOptionIndex: correct,
    });
    expect(revealed.leaderboard[0]).toMatchObject({ playerName: "Maya", points: 5 });
  });

  it("validates trivia options and advances to a fresh question", () => {
    const rooms = new RoomRegistry(() => "CAKE");
    rooms.create(player("host"));
    rooms.selectGame("CAKE", "host", "trivia");
    rooms.startGame("CAKE", "host");

    expect(() => rooms.submitTriviaAnswer("CAKE", "host", 99)).toThrow("available");
    rooms.closeTriviaAnswers("CAKE", "host");
    const next = rooms.nextTriviaQuestion("CAKE", "host");

    expect(next.gameState).toMatchObject({
      game: "trivia",
      phase: "answering",
      questionNumber: 2,
      answersReceived: 0,
    });
  });
});
