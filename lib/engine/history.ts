import {GameState} from "./state";

export class History {
    private state: GameState | null;
    private nodes: GameState[] | null;

    constructor(state: GameState | null, nodes: GameState[] | null) {
        this.state = state;
        this.nodes = nodes;
    }

}
