import {History} from "./history";
import {Player} from "./player";
import {GameState, PlayerGameState} from "./state";
import {getRandomKey, shuffleArray} from "../utils";
import {CardType, generateCardDeck, parseCard} from "./card";

/**
 * @version 1.0.0
 * Class holds all game logic and all game state access methods.
 *
 * @author Alexander. E. Fedotov
 * */
export class Game {
    private deck: string[] = generateCardDeck();
    private trumpCard: CardType;
    private tableTop: Map<string, string | null>;


    get victory(): boolean {
        return this._victory;
    }

    set victory(value: boolean) {
        this._victory = value;
    }

    static DeckSize: number = 6;

    private readonly history: History | null;
    private players: Map<string, Player>;
    private _victory: boolean = false;

    /**
     * @version 1.0.0
     * Game constructor initialises the game deck, players and the
     * history object.
     *
     * @constructor
     * @param {Array<string>} players An array of player names that are within the game.
     * @param {History} history - An array of history nodes for the game to rebuild the previous
     * state from.
     * */
    constructor(players: string[], history: History | null) {
        this.history = history;
        this.players = new Map();

        /**
         * This is the deck that's currently placed on the table. It's easier to work
         * with a Key-Value structure. The keys signify cards that are opposing the
         * defending player, and the values are the cards that the defending player
         * sets to defend against the card. */
        this.tableTop = new Map();

        // Check if the players argument follows the specified constraints.
        if (!Number.isInteger(players.length) && players.length < 1) {
            throw new Error("Number of players must be a positive integer.");
        } else if (players.length > 8) {
            throw new Error("Number of players cannot be greater than eight.");
        }

        // check that all of the player names are unique
        if ((new Set(players)).size !== players.length) {
            throw new Error("Player names must be unique.")
        }

        // generate card deck and shuffle it for the game
        shuffleArray(this.deck);

        // set the game up for the 'players' number.
        for (let index = 0; index < players.length; index++) {
            this.players.set(players[index], new Player());
        }

        // distribute the cards between the players as if in a physical way
        for (let index = 0; index < Game.DeckSize; index++) {
            this.players.forEach((player) => {
                player.addCard(this.deck.shift()!);
            });
        }

        // select the attacking player randomly, the SDK can provide a method
        // for overriding the starting attacking player later on...
        const chosenDefendingPlayer: string = getRandomKey(this.players);
        this.setDefendingPlayer(chosenDefendingPlayer);

        // Select the first remaining card and set the 'suit' of the game and then
        // shift the first element to the end of the stack.
        const topCard: CardType = parseCard(this.deck[0]);

        this.trumpCard = {
            value: topCard.value,
            suit: topCard.suit,
            card: this.deck[0],
        }

        // put top card to the bottom of the deck as is in the real game
        this.deck.push(this.deck.shift()!);
    }


    /**
     * @version 1.0.0
     * Create a game object from a previous game state.
     *
     * @param {{
     *     players: Object<string, Object>,
     *     history: Object<number, Object>,
     *     tableTop: Object<string, string>,
     *     deck: Array<string>,
     *     trumpCard: {value: number, suit: string, card: string},
     *     hasVictory: boolean,
     * }} state - The game state including players, history, tableTop, deck and trump card.
     *
     * @return {Game} A game object from the game state.
     * */
    static fromState(state: GameState) {
        const game = new Game(Object.keys(state.players), state.history);

        game.trumpCard = state.trumpCard;
        game.tableTop = new Map(Object.entries(state.tableTop));
        game.players = new Map(Object.entries(state.players));
        game.deck = state.deck;
        game.victory = state.victory;

        return game;
    }


    /**
     * @version 1.0.0
     * This function will setup the next round of the game. The method performs
     * several check and operations in order to prepare for the next round. Firstly,
     * we should determine who the the next defending player should be. This depends
     * on the fact if the current defending player managed to successfully defend
     * themselves or has decided to pickup the cards. Additionally, the method should
     * iterate over all the players to replenish the player card decks.
     *
     * @todo add this transaction as a history node.
     * */
    finaliseRound(): void {
        if (this.victory) {
            throw new Error("Can't mutate game state after victory.");
        }

        // the round cannot be finalised if no cards were ever put down on to the table
        if (this.tableTop.size === 0) {
            throw new Error("Cannot finalise round before any cards have been played.");
        }

        // get the round starter before it is overwritten by the 'defense' transfer
        const roundStarter = this.getRoundStarter();

        // Check that all of the cards have been covered by the defending player...
        let forfeitRound = Array.from(this.tableTop.values()).some((card) => {
            return card === null;
        });

        if (forfeitRound) {
            // Take the cards from the table top and move them into the players
            // personal deck
            const player = this.getPlayer(this.getDefendingPlayerName());
            player.deck = [...player.deck, ...this.getTableTopDeck()];

            this.setDefendingPlayer(this.getPlayerNameByOffset(this.getDefendingPlayerName(), 2));
        } else {
            // check that all players have declared that they finished the round.
            this.setDefendingPlayer(this.getPlayerNameByOffset(this.getDefendingPlayerName(), 1));
        }

        this.voidTableTop();

        // Check if the 'spare' deck size is greater than zero and therefore we can
        // replenish the players' card decks.
        if (this.deck.length > 0) {
            // we need to transpose the player list to begin with the player
            // who began the round and the rest following in a clockwise manner.
            for (let offset = 0; offset < this.getActivePlayers().length; offset++) {
                const playerName = this.getPlayerNameByOffset(roundStarter, offset);
                const playerByOffset = this.getPlayer(playerName);

                if (playerByOffset.deck.length < 6) {
                    playerByOffset.deck = [...playerByOffset.deck, ...this.deck.splice(0, 6 - playerByOffset.deck.length)];
                }

                // no point of distributing the cards if there are no cards left.
                if (this.deck.length === 0) break;
            }
        }

        let hasVictory = true;

        // victory condition: check if the defender is the only player who isn't out.
        this.getActivePlayers().forEach(([name, player]) => {

            // check if we need to declare someone as 'out' of the game.
            if (player.deck.length === 0) {
                player.out = Date.now();

                // We need to finalise the round, just in case it hasn't been done previously
                // This needs to happen if a defender or any other player exits the game whilst
                // placing or covering cards.
                this.finalisePlayerTurn(name);
            }

            if (name !== this.getDefendingPlayerName() && player.out === null) {
                hasVictory = false;
            }
        });

        this.victory = hasVictory;
    }

    /**
     * @version 1.0.0
     * This function is used to add a card from the attacking player, or any
     * attacking player. The function will do some basic logic checking on the
     * conditions that should be passed for the card to be added. There are three
     * basic requirements for the card to be added:
     *
     * 1. The defending player must have the the same or greater number of cards
     *    than the cards that aren't covered in the tableTop.
     *
     * 2. There can only be a maximum of 6 cards in a table top
     *
     * 3. The card to be added into the pile must have the same numerical value
     *    as some card on the table top.
     *
     * If these conditions pass, the card is added onto the table top and a history
     * node is added to the game history. The card is also taken from the player
     * that adds the card.
     *
     * @param {String} name - The id of the player that's taking the card.
     * @param {String} card - The card that's being added to the table top.
     * */
    addCardToTableTop(name: string, card: string): void {
        if (this.victory) throw new Error("Can't mutate game state after victory.");

        // check if the deck is already filled up.
        if (this.tableTop.size === 6) throw new Error("Player deck already full.");

        // Check that the player exists
        const player = this.getPlayer(name);

        // Now check the presence of the given card, in the players deck.
        if (!player.deck.includes(card)) throw new Error("Player doesn't hold current card");

        // Also check that the current card is allowed to be added to the deck. To determine this,
        // the cardLabel of the card to be added must be present on the tableTop.
        const coveringCard: CardType = parseCard(card);
        const tableTopCards = this.getTableTopDeck();

        if (tableTopCards.length > 0 && !tableTopCards.map(item => parseCard(item).value).includes(coveringCard.value)) {
            throw new Error("Card numerical value isn't present on the table top.");
        }

        // Now let's determine if the player is trying to transfer the defensive position
        // to the left hand side player. This can be checked by the fact if the 'card' they
        // are trying to cover is equal to null.
        if (player.isDefending) {
            // the player can't transfer defense if any of the cards are covered...
            if (this.getCoveredCount() !== 0) {
                throw new Error("Player can't transfer defense since they have covered a card.")
            }

            const nextPlayer = this.getPlayer(this.getPlayerNameByOffset(name, 1));

            if (this.tableTop.size + 1 > nextPlayer.deck.length) {
                throw new Error("Player doesn't have enough cards to cover attack.");
            }

            // we need to check if the player can transfer the defensive role to
            // the next player. For this to be true, all of the cards in the deck
            // must have the same card label, and, no card must be covered on the
            // deck. Additionally, the role can't be passed if the player to the
            // left has less cards than the length of the deck + 1.
            if (Array.from(this.tableTop.keys()).some((tableCard) => parseCard(tableCard).value !== coveringCard.value)) {
                throw new Error("Improper card for the transfer of defense state to next player.");
            }

            // transfer defense state to the next player
            this.setDefendingPlayer(this.getPlayerNameByOffset(name, 1));
        }

        // add the card to the table top from the player's deck.
        this.transferCardOntoTable(player, card);

        // check if the player has no cards in the deck and there no cards in the game deck, then the
        // current player has 'won' the game and apply a timestamp to when they exited the round.
        if (player.deck.length === 0 && this.deck.length === 0) {
            player.out = Date.now();

            // call finaliseTurn since they might be the attacker at the start of the round, by doing
            // this, all other players can now place cards on the table top.
            this.finalisePlayerTurn(name);

            // now check here if there is only one player remaining in the game.
            if (this.getActivePlayers().length === 1) {
                this.victory = true;
            }
        }
    }

    /**
     * @version 1.0.0
     * This function is responsible for the logic that dictates what should happen
     * when the defending player attempts to cover a card which is present on the
     * tableTop. There are several checks that must be carried out before the card
     * is placed or covers another card. These checks are:
     *
     * 1. Is the card present in the defending players deck.
     *
     * 2. Is the card they are trying to cover hierarchically higher than the cards
     *    that's on the table. This means that it must have a higher numerical value
     *    and the same suit and or be a card in the trumping suit. If it does not,
     *    the player cannot use it to cover the card.
     *
     * 3. Is the player trying to transfer the defensive role to the next player
     *    by placing the same numeric card as the cards that are present on the
     *    table. For example, if there are two sevens on the table and the player
     *    puts down another seven on the table onto a new spot on the tableTop, this
     *    means that the player on the left hand side becomes the defending player.
     *    The defending player can only do this if they haven't covered any other
     *    cards.
     *
     * @param {string} card - The card that's going to be used to cover the table top card.
     * @param {number} pos - The position of the card that's going to be covered.
     *
     * @todo add this transaction as a history node.
     * */
    coverCardOnTableTop(card: string, pos: number) {
        const defendingPlayer = this.getPlayer(this.getDefendingPlayerName());

        if (this.victory) {
            throw new Error("Can't mutate game state after victory.");
        }

        // check that the 'card' is present on the table top...
        if (!defendingPlayer.deck.includes(card)) {
            throw new Error("Defending card is not present in the defending players deck.");
        }


        // check that the 'coveringCard' is present in the defending players deck.
        if (!this.getCardOnTableTopAt(pos)) {
            throw new Error("Defending card is not present in the defending players deck.");
        }


        const placedCard: CardType = parseCard(this.getCardOnTableTopAt(pos)!);
        const coveringCard: CardType = parseCard(card);

        /* check whether we are dealing with the same suit of card, or if the defending
         * player is attempting to use the trumping suit. In general, there are three
         * possible states the game can end up in. These are:
         *
         * 1. If the defending player is using the same suits to cover the table top card
         *
         * 2. If the player is using a trumping suit card to cover another card, unless if
         *    the table card is also a trumping suit. If this is the case, then the defending
         *    player must use a higher numerical value.
         *
         * 3. The defending player attempts to use a different, non-trumping suit card to
         *    cover the card which is an illegal state.
         */
        if (coveringCard.suit === placedCard.suit) {
            // The trumping suit doesn't matter here since they are the same
            if (placedCard.value > coveringCard.value) {
                throw new Error("Covering card must have a higher value.");
            }
        } else if (coveringCard.suit !== this.trumpCard.suit) {
            throw new Error(`Covering card suit must be the same suit as the table card and have a higher numerical value.`);
        }

        // Transfer the player card from their deck to the the table top.
        this.tableTop.set(this.getCardOnTableTopAt(pos)!, card);
        defendingPlayer.deck = defendingPlayer.deck.filter((playerCard) => playerCard !== card);

        // check if the whole table has been covered, then invoke finaliseRound()
        if (this.getCoveredCount() === Game.DeckSize || defendingPlayer.deck.length === 0) {
            this.finaliseRound();
        } else {
            // reset everybody's (except defender) 'turned' value since the tableTop state changed.
            this.getActivePlayers().forEach(([name, player]) => {
                player.turned = false;
            });
        }
    }

    /**
     * @version 1.0.0
     * This method will transfer the status of defending player to the
     * specified player id.
     *
     * @param {String} name - The name of the player that the defending status
     *        is being transferred to.
     * */
    setDefendingPlayer(name: string): void {
        if (this.victory) {
            throw new Error("Can't mutate game state after victory.");
        }

        const defendingPlayer = this.getPlayer(name);

        // reset everyone's privileges for attacking/defending...
        this.players.forEach((player) => {
            player.canAttack = false;
            player.beganRound = false;
            player.isDefending = false;
            player.turned = false;
        });

        // Update the parameters for the attacking and defending player...
        let attackingPlayer = this.getPlayer(this.getPlayerNameByOffset(name, -1));

        attackingPlayer.canAttack = true;
        attackingPlayer.beganRound = true;
        defendingPlayer.isDefending = true;
    }

    /**
     * @version 1.0.0
     * This method will transfer the status of defending player to the
     * specified player id.
     *
     * @param {String} name - The name of the player that the defending status
     *        is being transferred to.
     *
     * @todo add this transaction as a history node.
     * */
    finalisePlayerTurn(name: string): void {
        if (this.victory) {
            throw new Error("Can't mutate game state after victory.");
        }

        if (this.tableTop.size === 0) {
            throw new Error("Cannot finalise turn when no cards have been placed.");
        }

        const player = this.getPlayer(name);
        player.turned = true;

        // If this is the attacking player, set everyone's 'canAttack' (except defending)
        // player as true since the move has been made..
        const defendingPlayerName = this.getDefendingPlayerName();
        const attackingPlayer = this.getPlayerNameByOffset(defendingPlayerName, -1);

        // If the defender forfeits, everybody can now attack
        if (attackingPlayer === name || defendingPlayerName === name) {
            this.getActivePlayers().forEach(([name, player]) => {
                if (name !== defendingPlayerName) {
                    player.canAttack = true;
                }
            });
        }

        if (this.getActivePlayers().every(player => player[1].turned)) {
            this.finaliseRound();
        }


        // The case where if everyone but the defending player declares that they have
        // finished the round, and all cards are covered by the defender, we invoke
        // finaliseRound since nobody can perform any additional action on the tabletop.
        let canFinalise = true;

        this.getActivePlayers().forEach(([name, player]) => {
            if (!player.turned && name !== defendingPlayerName) {
                canFinalise = false;
            }
        });

        // https://github.com/feds01/durak-cards#26 - The round should be finalised if attackers
        // can't put down anymore cards.
        const uncoveredCards = this.tableTop.size - this.getCoveredCount();

        if (name === defendingPlayerName) {
            if (
                this.tableTop.size === Game.DeckSize ||
                uncoveredCards === player.deck.length ||

                // Special case where 4 cards of the same numeric have been placed and
                // all of them have not been covered, hence preventing attackers from
                // placing anymore cards. Therefore it is safe to finalise the round.
                (this.tableTop.size === 4 && uncoveredCards === 4 && new Set(...this.getTableTopDeck()).size === 1))
            {
                this.finaliseRound();
            }
        }

        if (canFinalise && this.getCoveredCount() === this.tableTop.size) this.finaliseRound();
    }


    /**
     * @version 1.0.0
     * This function is used to retrieve the current defending player from the
     * player list.
     *
     * @return {String} the 'id' of the defending player.
     * */
    getDefendingPlayerName(): string {
        const defendingPlayer = Array.from(this.players.keys()).find((name) => this.players.get(name)!.isDefending);

        if (typeof defendingPlayer === "undefined") {
            throw new Error("Invalid game state.")
        }

        return defendingPlayer;
    }

    /**
     * @version 1.0.0
     * This function is used to retrieve a player based by an index from the
     * current defending player. If the index is negative, it will index it from
     * the left hand side. If it's positive, then it will return the index from
     * the right hand side.
     *
     * @param {string} name - The player to begin the index at..
     * @param {number} offset - The offset from the current defending player.
     *
     * @return {String} the name of player 'offset' positions after the given one.
     * */
    getPlayerNameByOffset(name: string, offset: number): string {
        const playerNames = this.getActivePlayers().map(([name]) => name);
        const playerIndex = playerNames.indexOf(name);

        if (playerIndex < 0) {
            throw new Error("Player doesn't exist within the lobby.");
        }

        let index = offset + playerIndex;
        if (index < 0) index += playerNames.length;

        return playerNames[index % playerNames.length];
    }

    /**
     * @version 1.0.0
     * Return the players that are still in the game.
     *
     * @returns {Array<Array<string, object>>} An array of player name with the player's state.
     * */
    getActivePlayers(): [string, Player][] {
        return Array.from(this.players.entries()).filter(([name, player]) => player.out === null);
    }

    /**
     * @version 1.0.0
     * Method to retrieve the player who started the current round, this method
     * is used to determine how cards should be handed out(replenished) at the end
     * of a round if any player needs cards to fill their deck.
     *
     * @return {string} the name of the player who initiated the round.
     * */
    getRoundStarter(): string {
        const roundStarter = Array.from(this.players.keys()).find((name) => this.players.get(name)!.beganRound);

        if (typeof roundStarter === "undefined") {
            throw new Error("Invalid game state");
        }

        return roundStarter;
    }

    /**
     * @version 1.0.0
     * This function is used to return the contents of the table top in the form of
     * an array. The function does not return 'empty' slots if there are any present.
     *
     * @return {Array<String>} an array of cards.
     * */
    getTableTopDeck(): string[] {
        const tableCard: (string | null)[] = Array.from(this.tableTop.entries()).flat();

        return tableCard.filter((item): item is string => item !== null);
    }

    /**
     * @version 1.0.0
     * Method to get the number of cards that have been covered on the table top.
     *
     * @return {number} the number of covered cards.
     * */
    getCoveredCount(): number {
        return Array.from(this.tableTop.values()).filter((item): item is string => item !== null).length;
    }

    /**
     * Method to get a bottom card of the table top by a position on the table.
     *
     * @param {number} pos - The position of the card to get from the table top,
     *
     * @return {?String} The card on the table top at the given position, if nothing
     * is at the given position the method will return 'undefined'.
     * */
    getCardOnTableTopAt(pos: number): string | null {
        if (pos < 0 || pos > 5) {
            throw new Error(`Can't get table top card at position '${pos}'`);
        }

        return Array.from(this.tableTop.keys())[pos];
    }

    /**
     * @version 1.0.0
     * This method is used to move a card from a players deck onto the table top. If
     * the tableTop deck is already the size of six or if the card isn't present in
     * the players deck, the method will throw the error.
     *
     * @param {Object} player - The player object that holds player state.
     * @param {String} card - The card that's being transferred from the players deck
     *        to the tableTop deck.
     *
     * @todo add this transaction as a history node.
     * */
    transferCardOntoTable(player: Player, card: string) {
        if (this.victory) {
            throw new Error("Can't mutate game state after victory.");
        }

        if (this.tableTop.size === 6) {
            throw new Error("Player deck already full.");
        }

        if (!player.deck.includes(card)) {
            throw new Error("Defending card is not present in the defending players deck.");
        }

        this.tableTop.set(card, null);
        player.deck.splice(player.deck.indexOf(card), 1);
    }

    /**
     * @version 1.0.0
     * */
    addHistoryNode() {
    }

    /**
     * @version 1.0.0
     * This function is used to move the contents of the table top to a players
     * deck. An error is thrown if the player that's passed to the function doesn't
     * exist. This transaction is recorded into the history object. If the player does
     * exist, the contents are transferred to the players deck, the table top is cleared.
     *
     * @param {String} to - the 'id' of the player that the table top is being transferred to.
     *
     * @todo add this transaction as a history node.
     * */
    transferTableTop(to: string) {
        if (this.victory) {
            throw new Error("Can't mutate game state after victory.");
        }

        if (!this.players.has(to)) {
            throw new Error("Player doesn't exist.");
        }

        this.players.get(to)!.deck.push(...this.getTableTopDeck());
        this.voidTableTop();
    }


    /**
     * @version 1.0.0
     * This function will void all the cards that are currently on the table top
     * because it is the end of the round, and the defending player successfully
     * defended themselves against the attackers.
     *
     * @todo add this transaction as a history node.
     * */
    voidTableTop(): void {
        this.tableTop.clear();
    }

    /**
     * Method used to generate a game state from the perspective of a player. Using the player
     * name, a game state is constructed; notifying the given player with how many cards are in the
     * deck, how many other cards players hold, who has turned, etc.
     *
     * It's important that the information that this method generates for a player does not
     * give any more information than it should. Otherwise the game might not be considered to
     * be fair.
     *
     * @param {String} playerName - The name of the player to generate state for
     * */
    getStateForPlayer(playerName: string): PlayerGameState {
        const player = this.getPlayer(playerName);

        // transpose the array to match the position of the player on the table
        const players = Array.from(this.players.keys());
        const idx = players.indexOf(playerName);

        const playerOrder = [...players.slice(idx + 1, players.length), ...players.slice(0, idx)];

        return {
            ...player,
            out: player.out !== null,

            // general info about the game state
            trumpCard: this.trumpCard,
            deckSize: this.deck.length,

            // @ts-ignore
            tableTop: Object.fromEntries(this.tableTop),

            // information about other players, including how many cards they
            // are holding, if they have turned, and if they are defending...
            players: playerOrder.map(name => {
                    const player = this.players.get(name)!;

                    return {
                        name,
                        ...player,

                        // overwrite these values to suit the required format and to
                        // not reveal sensitive information about game state to other
                        // players
                        out: player.out !== null,
                        deck: player.deck.length,
                    }
                }),
        }
    }

    getPlayer(name: string): Player {

        const player = this.players.get(name);

        if (typeof player === 'undefined') {
            throw new Error("Invalid game state.")
        }

        return player;
    }

    /**
     * This method is used to serialize the object so it can be written to the database
     * or send over a http transmission.
     *
     * @return {{
     *  trumpCard: {suit: String, value: number, card: String},
     *  players: Map<string, Object>,
     *  deck: Array<string>,
     *  tableTop: Map<string, string>,
     *  history: Map<number, Object>
     * }}
     * */
    serialize(): GameState {
        return new GameState(
            this.players,
            this.history,
            this.tableTop,
            this.deck,
            this.trumpCard,
            this.victory,
        );
    }
}
