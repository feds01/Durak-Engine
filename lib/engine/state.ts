import {History} from "./history";
import {Player} from "./player";
import {CardType} from "./card";

export class GameState {
    trumpCard: { suit: string; value: number; card: string };
    tableTop: Map<string, string | null>;
    deck: string[];
    victory: boolean;
    history: History | null;
    players: Map<string, Player>;

    constructor(
        players: Map<string, Player>,
        history: History | null,
        tableTop: Map<string, string | null>,
        deck: string[],
        trumpCard: CardType,
        victory: boolean
    ) {
        this.players = players;
        this.history = history;
        this.tableTop = tableTop;
        this.deck = deck;
        this.trumpCard = trumpCard;
        this.victory = victory;
    }
}
