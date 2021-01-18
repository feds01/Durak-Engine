import {CardType} from "./card";
import {Player} from "./player";
import {GameState} from "./state";

// bound to change
enum HistoryNodeType {
    PLACE="place",
    COVER="cover",
    FORFEIT="forfeit",
    NEW_ROUND="new_round",
    VOID="void",
    PICKUP="pickup",
    EXIT="exit",
    VICTORY="victory"
}

type ActorType = Player | "tableTop";

type Action = {
    readonly type: HistoryNodeType
    readonly data: CardType[];
    readonly actors: ActorType[]
}

/**
 * @version 1.0.0
 * History class for a game. This class is used to record actions and player
 * interactions within a game so it can later be recalled or re-created.
 *
 * @author Alexander. E. Fedotov
 * */
export class HistoryNode {
    private _actions: Action[];

    constructor(actions: Action[] | null) {
        this._actions = Array.isArray(actions) ? actions : [];
    }

    set actions(value: Action[]) {
        this._actions = value;
    }
    get actions(): Action[] {
        return this._actions;
    }

    addAction(action: Action): void {
        // TODO: We don't do sanity checking yet.
        this._actions.push(action);
    }

    removeLast(): void {
        if (this._actions.length === 0) return;

        this._actions.pop();
    }

    serialize(): Action[] {
        return this._actions;
    }
}


/**
 * @version 1.0.0
 * History class for a game. This class is used to record actions and player
 * interactions within a game so it can later be recalled or re-created.
 *
 * @author Alexander. E. Fedotov
 * */
export class History {
    private readonly initialState: GameState;
    private readonly nodes: HistoryNode[];

    /**
     * History class constructor
     *
     * @param {GameState} initialState - The initial state of the game so that
     *                    the game can be re-created from the initial state.
     * @param {?HistoryNode[]} nodes - The history nodes of the previous history
     * */
    constructor(initialState: GameState, nodes: HistoryNode[] | null) {
        this.initialState = initialState;
        this.nodes = Array.isArray(nodes) ? nodes : [];
    }

    /**
     * Method to add a history node to the history.
     *
     * @throws {InvalidGameState} if the node type data or actors are inconsistent with
     * the initial game state.
     * */
    createNode(): void {
        this.nodes.push(new HistoryNode([]));
    }

    /**
     * Method to remove the last added node to the history. If no nodes are currently within
     * the history, no action is performed.
     * */
    removeLastNode(): void {
        if (this.nodes.length === 0) return;

        this.nodes.pop();
    }

    /**
     *
     * */
    getLastNode(): HistoryNode | null {
        if (this.nodes.length === 0) return null;

        return this.nodes[this.nodes.length - 1];
    }

    serialize(): {initialState: GameState, nodes: HistoryNode[]} {
        return {
            initialState: this.initialState,
            nodes: this.nodes,
        }
    }

}
