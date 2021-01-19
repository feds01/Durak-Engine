import {CardType} from "./card";
import {GameState} from "./state";
import InvalidHistoryState from "./errors/InvalidHistoryState";

// bound to change
export enum ActionType {
    PLACE = "place", // used
    COVER = "cover", // used
    FORFEIT = "forfeit", // used
    NEW_ROUND = "new_round",
    PICKUP = "pickup", // pickup
    EXIT = "exit",   // used
    VICTORY = "victory" // used
}

// Special types when recording the actor, "tableTop" is what is on the actual
// table at any time. The "void" actor type is used to represent when cards are
// discarded or removed from the table top.
export type ActorType = {player: string} | "tableTop" | "void";

export type Action = {
    readonly type: ActionType;
    readonly data?: CardType[] | string[];
    readonly to?: ActorType;
    readonly from: ActorType;
    readonly additional?: {on?: number, at?: number};
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
    private _finalised: boolean;

    constructor(actions: Action[] | null) {
        this._actions = Array.isArray(actions) ? actions : [];
        this._finalised = false;
    }

    set actions(value: Action[]) {
        this._actions = value;
    }

    get actions(): Action[] {
        return this._actions;
    }

    set finalised(value: boolean) {
        this._finalised = value;
    }

    get finalised(): boolean {
        return this._finalised;
    }

    addAction(action: Action): void {
        this._actions.push(action);
    }

    findAction(type: ActionType): Action[] {
        return this._actions.filter((action) => action.type === type);
    }

    removeLast(): void {
        if (this._actions.length === 0) return;

        this._actions.pop();
    }

    serialize(): Action[] {
        return this._actions;
    }
}

export type HistoryState = {
    initialState: GameState | null,
    nodes: Action[][]
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
    constructor(initialState: GameState, nodes: Action[][] | null) {
        this.initialState = initialState;
        this.nodes = Array.isArray(nodes) ? nodes.map((node) => new HistoryNode(node)) : [];
    }

    /**
     * Method to add a history node to the history.
     *
     * @param {Action | null} begin - Optional initial history entry for the current to start
     * the node off. This parameter is optional and does not need to be utilised.
     *
     * */
    createNode(begin: Action | null): void {
        const nodes = [];

        // We might have to declare the previous node as finalised
        const prevNode = this.getLastNode();
        if (prevNode !== null) prevNode.finalised = true;

        // Add the initial node to the HistoryNode (if provided)
        if (begin !== null) nodes.push(begin);

        this.nodes.push(new HistoryNode(nodes));
    }


    /**
     * Method to an entry to the most recent history node. If no node currently
     * exists in the history object, the method will throw an exception as it expects
     * that at least one {@see HistoryNode} exists.
     *
     * @param {Action} action - The action that is to be added.
     * @throws {InvalidHistoryState} If no HistoryNode exists in the current object
     * */
    addEntry(action: Action): void {
        if (this.nodes.length === 0) {
            throw new InvalidHistoryState("Cannot add entry when no nodes exist.");
        }

        const node = this.getLastNode()!;
        node.addAction(action);
    }

    /**
     * Method to remove the last added node to the history. If no nodes are currently within
     * the history, no action is performed.
     * */
    removeLastNode(): void {
        if (this.nodes.length === 0) return;

        this.nodes.pop();
    }

    getLastNode(): HistoryNode | null {
        if (this.nodes.length === 0) return null;

        return this.nodes[this.nodes.length - 1];
    }

    /**
     * This method is used to serialize the object so it can be written to the database
     * or send over a http transmission.
     *
     * @return {HistoryState} the serialized version of the history.
     * */
    serialize(): HistoryState {
        return {
            initialState: this.initialState,
            nodes: this.nodes.map(node => node.serialize()),
        }
    }

}
