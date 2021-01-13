import * as game from './engine/game';
import * as error from './error';
import * as utils from "./utils";
import * as events from "./events";

export {game, utils, events, error};

export enum GameStatus {
    WAITING,
    STARTED,
    PLAYING,
}
