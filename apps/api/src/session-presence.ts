import type { GameSession, Player } from "./types.js";

const ACTIVE_GAME_STATES = new Set<GameSession["state"]>([
  "GAME_COUNTDOWN",
  "QUESTION_PREVIEW",
  "RUNNING",
  "QUESTION_RESULT",
  "PAUSED",
]);

export function hasOnlinePlayers(players: Array<Pick<Player, "online">>) {
  return players.some((player) => player.online);
}

export function shouldEndEmptySession(
  session: Pick<GameSession, "state">,
  players: Array<Pick<Player, "online">>,
) {
  return ACTIVE_GAME_STATES.has(session.state) && !hasOnlinePlayers(players);
}
