import { randomInt } from "node:crypto";

import type { EraGameState, GameId, Player, RoomState, StephGameState, TriviaGameState } from "@/types/party";

import { STEPH_QUESTIONS, TRIVIA_QUESTIONS } from "./question-banks";

export { STEPH_QUESTIONS, TRIVIA_QUESTIONS } from "./question-banks";

const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const MAX_PLAYERS = 12;

interface StephSession {
  questionIndex: number;
  phase: "voting" | "revealed";
  votes: Map<string, boolean>;
}

interface TriviaSession {
  questionIndex: number;
  phase: "answering" | "revealed";
  answers: Map<string, number>;
}

export interface EraPhoto {
  imageUrl: string;
  age: number;
}

interface EraSession {
  photoIndex: number;
  phase: "guessing" | "revealed";
  guesses: Map<string, number>;
}

interface MutableRoom extends Omit<RoomState, "gameState" | "leaderboard"> {
  stephSession?: StephSession;
  eraSession?: EraSession;
  triviaSession?: TriviaSession;
  scores: Map<string, number>;
}

function randomRoomCode(): string {
  return Array.from(
    { length: 4 },
    () => ROOM_CODE_CHARS[randomInt(ROOM_CODE_CHARS.length)],
  ).join("");
}

export class RoomError extends Error {}

export class RoomRegistry {
  private readonly rooms = new Map<string, MutableRoom>();

  constructor(
    private readonly makeCode: () => string = randomRoomCode,
    private readonly eraPhotos: readonly EraPhoto[] = [],
  ) {}

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
      scores: new Map([[this.scoreKey(player.name), 0]]),
    };

    this.rooms.set(code, room);
    return this.snapshot(room);
  }

  join(codeInput: string, player: Player): RoomState {
    const code = codeInput.trim().toUpperCase();
    const room = this.rooms.get(code);

    if (!room) throw new RoomError("That room does not exist.");
    if (room.players.length >= MAX_PLAYERS) {
      throw new RoomError("That room is full.");
    }
    if (room.players.some(({ name }) => name.toLowerCase() === player.name.toLowerCase())) {
      throw new RoomError("That name is already being used in this room.");
    }

    room.players.push(player);
    const scoreKey = this.scoreKey(player.name);
    if (!room.scores.has(scoreKey)) room.scores.set(scoreKey, 0);
    return this.snapshot(room);
  }

  leave(codeInput: string, playerId: string): RoomState | null {
    const code = codeInput.toUpperCase();
    const room = this.rooms.get(code);

    if (!room) return null;

    room.players = room.players.filter((player) => player.id !== playerId);
    room.stephSession?.votes.delete(playerId);
    room.eraSession?.guesses.delete(playerId);
    room.triviaSession?.answers.delete(playerId);
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

  selectGame(codeInput: string, playerId: string, gameId: GameId): RoomState {
    const room = this.requireRoom(codeInput);
    this.requireHost(room, playerId);
    if (room.status !== "lobby") throw new RoomError("A game is already in progress.");

    room.selectedGame = gameId;
    return this.snapshot(room);
  }

  startGame(codeInput: string, playerId: string): RoomState {
    const room = this.requireRoom(codeInput);
    this.requireHost(room, playerId);
    if (room.status !== "lobby") throw new RoomError("A game is already in progress.");
    if (room.selectedGame === "steph-did-that") {
      room.stephSession = { questionIndex: 0, phase: "voting", votes: new Map() };
    } else if (room.selectedGame === "trivia") {
      room.triviaSession = { questionIndex: 0, phase: "answering", answers: new Map() };
    } else if (room.selectedGame === "guess-the-era") {
      if (this.eraPhotos.length === 0) {
        throw new RoomError("Add at least one age-named photo to content/steph-eras, then restart the server.");
      }
      room.eraSession = { photoIndex: 0, phase: "guessing", guesses: new Map() };
    } else {
      throw new RoomError("Choose an available game to start playing.");
    }

    room.status = "playing";
    return this.snapshot(room);
  }

  submitStephVote(codeInput: string, playerId: string, answer: boolean): RoomState {
    const room = this.requireRoom(codeInput);
    this.requirePlayer(room, playerId);
    const session = this.requireStephSession(room);
    if (session.phase !== "voting") throw new RoomError("Answers are already closed.");

    session.votes.set(playerId, answer);
    return this.snapshot(room);
  }

  closeStephAnswers(codeInput: string, playerId: string): RoomState {
    const room = this.requireRoom(codeInput);
    this.requireHost(room, playerId);
    const session = this.requireStephSession(room);
    if (session.phase !== "voting") throw new RoomError("Answers are already closed.");

    session.phase = "revealed";
    const correctAnswer = STEPH_QUESTIONS[session.questionIndex].answer;
    for (const [voterId, answer] of session.votes) {
      if (answer === correctAnswer) this.awardPoints(room, voterId);
    }
    return this.snapshot(room);
  }

  nextStephQuestion(codeInput: string, playerId: string): RoomState {
    const room = this.requireRoom(codeInput);
    this.requireHost(room, playerId);
    const session = this.requireStephSession(room);
    if (session.phase !== "revealed") throw new RoomError("Close the answers first.");

    if (session.questionIndex === STEPH_QUESTIONS.length - 1) {
      room.status = "lobby";
      room.selectedGame = null;
      delete room.stephSession;
    } else {
      session.questionIndex += 1;
      session.phase = "voting";
      session.votes.clear();
    }
    return this.snapshot(room);
  }

  submitEraGuess(codeInput: string, playerId: string, age: number): RoomState {
    const room = this.requireRoom(codeInput);
    this.requirePlayer(room, playerId);
    const session = this.requireEraSession(room);
    if (session.phase !== "guessing") throw new RoomError("Guesses are already closed.");
    if (!Number.isInteger(age) || age < 0 || age > 30) {
      throw new RoomError("Choose an age from 0 to 30.");
    }

    session.guesses.set(playerId, age);
    return this.snapshot(room);
  }

  closeEraGuesses(codeInput: string, playerId: string): RoomState {
    const room = this.requireRoom(codeInput);
    this.requireHost(room, playerId);
    const session = this.requireEraSession(room);
    if (session.phase !== "guessing") throw new RoomError("Guesses are already closed.");

    session.phase = "revealed";
    const correctAge = this.eraPhotos[session.photoIndex].age;
    for (const [guesserId, age] of session.guesses) {
      if (age === correctAge) this.awardPoints(room, guesserId);
    }
    return this.snapshot(room);
  }

  nextEraPhoto(codeInput: string, playerId: string): RoomState {
    const room = this.requireRoom(codeInput);
    this.requireHost(room, playerId);
    const session = this.requireEraSession(room);
    if (session.phase !== "revealed") throw new RoomError("Close the guesses first.");

    if (session.photoIndex === this.eraPhotos.length - 1) {
      room.status = "lobby";
      room.selectedGame = null;
      delete room.eraSession;
    } else {
      session.photoIndex += 1;
      session.phase = "guessing";
      session.guesses.clear();
    }
    return this.snapshot(room);
  }

  submitTriviaAnswer(codeInput: string, playerId: string, optionIndex: number): RoomState {
    const room = this.requireRoom(codeInput);
    this.requirePlayer(room, playerId);
    const session = this.requireTriviaSession(room);
    if (session.phase !== "answering") throw new RoomError("Answers are already closed.");

    const question = TRIVIA_QUESTIONS[session.questionIndex];
    if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= question.options.length) {
      throw new RoomError("Choose one of the available answers.");
    }

    session.answers.set(playerId, optionIndex);
    return this.snapshot(room);
  }

  closeTriviaAnswers(codeInput: string, playerId: string): RoomState {
    const room = this.requireRoom(codeInput);
    this.requireHost(room, playerId);
    const session = this.requireTriviaSession(room);
    if (session.phase !== "answering") throw new RoomError("Answers are already closed.");

    session.phase = "revealed";
    const correctOptionIndex = TRIVIA_QUESTIONS[session.questionIndex].answer;
    for (const [answeringPlayerId, optionIndex] of session.answers) {
      if (optionIndex === correctOptionIndex) this.awardPoints(room, answeringPlayerId);
    }
    return this.snapshot(room);
  }

  nextTriviaQuestion(codeInput: string, playerId: string): RoomState {
    const room = this.requireRoom(codeInput);
    this.requireHost(room, playerId);
    const session = this.requireTriviaSession(room);
    if (session.phase !== "revealed") throw new RoomError("Close the answers first.");

    if (session.questionIndex === TRIVIA_QUESTIONS.length - 1) {
      room.status = "lobby";
      room.selectedGame = null;
      delete room.triviaSession;
    } else {
      session.questionIndex += 1;
      session.phase = "answering";
      session.answers.clear();
    }
    return this.snapshot(room);
  }

  private requireRoom(codeInput: string): MutableRoom {
    const room = this.rooms.get(codeInput.trim().toUpperCase());
    if (!room) throw new RoomError("That room does not exist.");
    return room;
  }

  private requirePlayer(room: MutableRoom, playerId: string): void {
    if (!room.players.some((player) => player.id === playerId)) {
      throw new RoomError("You are not in that room.");
    }
  }

  private requireHost(room: MutableRoom, playerId: string): void {
    this.requirePlayer(room, playerId);
    if (room.hostId !== playerId) throw new RoomError("Only the host can do that.");
  }

  private requireStephSession(room: MutableRoom): StephSession {
    if (room.status !== "playing" || room.selectedGame !== "steph-did-that" || !room.stephSession) {
      throw new RoomError("Steph did that!? is not currently running.");
    }
    return room.stephSession;
  }

  private requireEraSession(room: MutableRoom): EraSession {
    if (room.status !== "playing" || room.selectedGame !== "guess-the-era" || !room.eraSession) {
      throw new RoomError("Guess the Era is not currently running.");
    }
    return room.eraSession;
  }

  private requireTriviaSession(room: MutableRoom): TriviaSession {
    if (room.status !== "playing" || room.selectedGame !== "trivia" || !room.triviaSession) {
      throw new RoomError("Birthday Trivia is not currently running.");
    }
    return room.triviaSession;
  }

  private awardPoints(room: MutableRoom, playerId: string): void {
    const player = room.players.find(({ id }) => id === playerId);
    if (!player) return;
    const scoreKey = this.scoreKey(player.name);
    room.scores.set(scoreKey, (room.scores.get(scoreKey) ?? 0) + 5);
  }

  private scoreKey(playerName: string): string {
    return playerName.trim().toLocaleLowerCase();
  }

  private snapshot(room: MutableRoom): RoomState {
    const { stephSession, eraSession, triviaSession, scores, ...state } = room;
    let gameState: StephGameState | EraGameState | TriviaGameState | null = null;

    if (stephSession) {
      const current = STEPH_QUESTIONS[stephSession.questionIndex];
      const shared = {
        question: current.question,
        questionNumber: stephSession.questionIndex + 1,
        totalQuestions: STEPH_QUESTIONS.length,
      };
      gameState = stephSession.phase === "voting"
        ? { ...shared, game: "steph-did-that", phase: "voting", votesReceived: stephSession.votes.size }
        : {
            ...shared,
            game: "steph-did-that",
            phase: "revealed",
            trueVotes: [...stephSession.votes.values()].filter(Boolean).length,
            falseVotes: [...stephSession.votes.values()].filter((vote) => !vote).length,
            correctAnswer: current.answer,
          };
    }

    if (eraSession) {
      const current = this.eraPhotos[eraSession.photoIndex];
      const shared = {
        game: "guess-the-era" as const,
        imageUrl: current.imageUrl,
        photoNumber: eraSession.photoIndex + 1,
        totalPhotos: this.eraPhotos.length,
      };
      gameState = eraSession.phase === "guessing"
        ? { ...shared, phase: "guessing", guessesReceived: eraSession.guesses.size }
        : {
            ...shared,
            phase: "revealed",
            correctAge: current.age,
            guesses: room.players.flatMap((player) => {
              const age = eraSession.guesses.get(player.id);
              return age === undefined ? [] : [{ playerId: player.id, playerName: player.name, age }];
            }),
          };
    }

    if (triviaSession) {
      const current = TRIVIA_QUESTIONS[triviaSession.questionIndex];
      const shared = {
        game: "trivia" as const,
        question: current.question,
        options: [...current.options],
        questionNumber: triviaSession.questionIndex + 1,
        totalQuestions: TRIVIA_QUESTIONS.length,
      };
      gameState = triviaSession.phase === "answering"
        ? { ...shared, phase: "answering", answersReceived: triviaSession.answers.size }
        : {
            ...shared,
            phase: "revealed",
            correctOptionIndex: current.answer,
            answerCounts: current.options.map((_, optionIndex) =>
              [...triviaSession.answers.values()].filter((answer) => answer === optionIndex).length),
          };
    }

    const leaderboard = room.players
      .map((player) => ({
        playerId: player.id,
        playerName: player.name,
        points: scores.get(this.scoreKey(player.name)) ?? 0,
      }))
      .sort((left, right) => right.points - left.points || left.playerName.localeCompare(right.playerName));

    return { ...state, players: room.players.map((player) => ({ ...player })), gameState, leaderboard };
  }
}
