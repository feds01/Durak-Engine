// server events
export const JOIN_GAME = "join_game";
export const UPDATE_PASSPHRASE = "update_passphrase";
export const START_GAME = "start_game";
export const TURN = "turn";
export const NEXT_ROUND = "next_round";
export const KICK_PLAYER = "kick_player";


// client events
export const JOINED_GAME = "joined_game";
export const NEW_PLAYER = "new_player";
export const COUNTDOWN = "countdown";
export const GAME_STARTED = "game_started";

// @redundant event.
export const UPDATED_PASSPHRASE = "updated_passphrase";

// generic events

// Event signifying that an error occurred on the server side.
export const ERROR = "error";

// Event signifying that a connection is to be forcefully closed between client and
// server instances.
export const CLOSE = "close";
