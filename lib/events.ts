export enum SERVER_EVENTS {
    JOIN_GAME,
    UPDATE_PASSPHRASE,
    START_GAME,
    KICK_PLAYER,
    MOVE,
}

export enum CLIENT_EVENTS {
    JOINED_GAME,
    NEW_PLAYER,
    COUNTDOWN,
    GAME_STARTED,
    BEGIN_ROUND,
    ACTION,

    // @redundant event.
    UPDATED_PASSPHRASE,

    // Event signifying that an error occurred on the server side.
    ERROR,
    INVALID_MOVE,

    // Event signifying that a connection is to be forcefully closed between client and
    // server instances.
    CLOSE,
}
