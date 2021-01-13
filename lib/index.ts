export * as error from './error';
export {shuffleArray, getRandomKey} from "./utils";
export {ServerEvents, ClientEvents} from "./events";


export {Game} from "./engine/game";
export { CardType, parseCard} from "./engine/card";
export {CardNumerics, CardSuits} from './engine/consts';

/**
 * Possible move types that any player can make.
 * */
export enum MoveTypes {
    PLACE,
    COVER,
    FORFEIT,
}


export enum GameStatus {
    WAITING,
    STARTED,
    PLAYING,
}
