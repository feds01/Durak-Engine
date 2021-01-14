import {History} from "./history";
import {Player} from "./player";
import {CardType} from "./card";

export class GameState {
    constructor(
        public players: Map<string, Player>,
        public history: History | null,
        public tableTop: Map<string, string | null>,
        public deck: string[],
        public trumpCard: CardType,
        public victory: boolean
    ) {}
}

export type PlayerState = {
    name: string,
    deck: number,
    out: boolean,
    turned: boolean,
    beganRound: boolean,
    isDefending: boolean,
    canAttack: boolean,
}

export class PlayerGameState {
    constructor(
        public players: PlayerState[],
        public history: History | null,
        public tableTop: {[key: string]: string},
        public deckSize: number,
        public trumpCard: CardType,
        public victory: boolean
    ) {
    }
}
