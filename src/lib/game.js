import {getRandomKey, shuffleArray} from "./utils";

export const CardNumerics = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
export const CardSuits = {'H': '♡', 'D': '♢', 'C': '♣', 'S': '♤'};

export const GameState = Object.freeze({
    WAITING: "WAITING",
    STARTED: "STARTED",
    PLAYING: "PLAYING",
});

/**
 * Generates a whole card deck for use in the format of a list. Each
 * element follows the format of '<label> of <suit>'.
 * */
export function generateCardDeck() {
    return CardNumerics.map((label) => {
        return Object.keys(CardSuits).map((suit) => {
            return `${label}${suit}`;
        })
    }).flat();
}


/**
 * Simple function to split the card string into it's 'numerical'
 * value and it's 'suit' value.
 *
 * @param {String} card String representing card which is to be parsed.
 * @return {Array<String>} The numerical and suit component of the card.
 * */
export function parseCard(card) {

    // ensure the numeric and suit are valid
    const suit = card.substring(card.length - 1);
    const rawNumeric = card.substring(0, card.length - 1);

    if (!Object.keys(CardSuits).includes(suit)) {
        throw new Error("Invalid card suit.");
    }

    if (!CardNumerics.includes(rawNumeric)) {
        throw new Error("Invalid card numeric.")
    }

    return [CardNumerics.indexOf(rawNumeric) + 2, suit];
}


/**
 * @version 1.0.0
 * Class holds all game logic and all game state access methods.
 *
 * @author Alexander. E. Fedotov
 * */
export class Game {
    static DeckSize = 6;

    /**
     * Possible move types that any player can make.
     * */
    static MoveTypes = {
        PLACE: "place",
        COVER: "cover",
        FORFEIT: "forfeit",
    };

    /**
     * @version 1.0.0
     * Game constructor initialises the game deck, players and the
     * history object.
     *
     * @constructor
     * @param {Array<string>} players An array of player names that are within the game.
     * @param {Map<string, any>} history - An array of history nodes for the game to rebuild the previous
     * state from.
     * @param {boolean} generateInitialState - Whether the constructor should initiate an initial state for the game.
     * */
    constructor(players, history = new Map(), generateInitialState = true) {
        this.history = history;
        this.players = new Map();

        /**
         * This is the deck that's currently placed on the table. It's easier to work
         * with a Key-Value structure. The keys signify cards that are opposing the
         * defending player, and the values are the cards that the defending player
         * sets to defend against the card. */
        this.tableTop = new Map();

        // Check if the players argument follows the specified constraints.
        if (!Number.isInteger(players) && players < 1) {
            throw new Error("Number of players must be a positive integer.");
        } else if (players > 8) {
            throw new Error("Number of players cannot be greater than eight.");
        }

        // check that all of the player names are unique
        if ((new Set(players)).size !== players.length) {
            throw new Error("Player names must be unique.")
        }


        // If we shouldn't need to generate an initial state for the game, return
        // here since the caller will initialise the game state.
        if (!generateInitialState) {
            return;
        }


        // generate card deck and shuffle it for the game
        this.deck = generateCardDeck();
        shuffleArray(this.deck);

        // set the game up for the 'players' number.
        for (let index = 0; index < players.length; index++) {
            this.players.set(players[index], {
                deck: [],
                canAttack: false,
                beganRound: false,
                turned: false,
                isDefending: false,
            });
        }

        // distribute the cards between the players as if in a physical way
        for (let index = 0; index < Game.DeckSize; index++) {
            this.players.forEach((value, key) => {
                this.players.get(key).deck.push(this.deck.shift());
            });
        }

        // select the attacking player randomly, the SDK can provide a method
        // for overriding the starting attacking player later on...
        const chosenDefendingPlayer = getRandomKey(this.players);
        this.setDefendingPlayer(chosenDefendingPlayer);

        // Select the first remaining card and set the 'suit' of the game and then
        // shift the first element to the end of the stack.
        const [trumpValue, trumpSuit] = parseCard(this.deck[0]);

        this.trumpCard = {
            value: trumpValue,
            suit: trumpSuit,
            card: this.deck[0],
        }

        this.deck.push(this.deck.shift());
    }


    /**
     * @version 1.0.0
     * Create a game object from a previous game state.
     *
     * @param {Object<string, Object>} players - The players present in the game.
     * @param {Object<number, Object>} history - Game history
     * @param {Object<string, string>} tableTop - The current game table top.
     * @param {Array<String>} deck - The current game deck.
     * @param {{value: number, suit: string, card: string}} trumpCard - The game's trump card.
     *
     * @return {Game} A game object from the game state.
     * */
    static fromState(players, history, tableTop, deck, trumpCard) {
        const game = new Game(Object.keys(players), new Map(Object.entries(history)), false);

        game.trumpCard = trumpCard;
        game.tableTop = new Map(Object.entries(tableTop));
        game.players = new Map(Object.entries(players));
        game.deck = deck;

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
    finaliseRound() {
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
            const player = this.players.get(this.getDefendingPlayerName());
            player.deck = [...player.deck, ...this.getTableTopDeck()];

            this.setDefendingPlayer(this.getPlayerNameByOffset(this.getDefendingPlayerName(), 2));
        } else {
            // check that all players have declared that they finished the round.
            if (!Array.from(this.players.values()).every(player => player.turned)) {
                throw new Error("Cannot finalise round since not all players have declared that they finished the round");
            }

            this.setDefendingPlayer(this.getPlayerNameByOffset(this.getDefendingPlayerName(), 1));
        }

        this.voidTableTop();

        // Check if the 'spare' deck size is greater than zero and therefore we can
        // replenish the players' card decks.
        if (this.deck.length > 0) {

            // we need to transpose the player list to begin with the player
            // who began the round and the rest following in a clockwise manner.
            for (let offset = 0; offset < this.players.size; offset++) {
                const nameByOffset = this.getPlayerNameByOffset(roundStarter, offset);
                const playerByOffset = this.players.get(nameByOffset);

                if (playerByOffset.deck.length < 6) {
                    playerByOffset.deck = [...playerByOffset.deck, ...this.deck.splice(0, 6 - playerByOffset.deck.length)];
                }

                playerByOffset.turned = false;
            }
        }
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
    addCardToTableTop(name, card) {
        // check if the deck is already filled up.
        if (!(this.tableTop.size < 6)) {
            throw new Error("Player deck already full.");
        }

        const player = this.players.get(name);

        // check if the id is valid
        if (typeof player === 'undefined') throw new Error("Player doesn't exist.");

        // check that the defending play is able to cover the table top cards.
        const coveredCards = Array.from(this.tableTop.values()).filter((item) => item !== null);

        // get the next player from this one...
        const nextPlayer = this.players.get(this.getPlayerNameByOffset(name, 1));

        if (this.tableTop.size - coveredCards.length + 1 > nextPlayer.deck.length) {
            throw new Error("Player doesn't have enough cards to cover attack.");
        }

        const [cardNumeric] = parseCard(card);

        // Now check the presence of the given card, in the players deck.
        if (!player.deck.includes(card)) {
            throw new Error("Player doesn't hold current card");
        }

        // Also check that the current card is allowed to be added to the deck. To determine this,
        // the cardLabel of the card to be added must be present on the tableTop.
        const tableTopCards = this.getTableTopDeck();

        if (tableTopCards.length > 0 && !tableTopCards.map(item => parseCard(item)[0]).includes(cardNumeric)) {
            throw new Error("Card numerical value isn't present on the table top.");
        }

        // Now let's determine if the player is trying to transfer the defensive position
        // to the left hand side player. This can be checked by the fact if the 'card' they
        // are trying to cover is equal to null.
        if (player.isDefending) {

            // we need to check if the player can transfer the defensive role to
            // the next player. For this to be true, all of the cards in the deck
            // must have the same card label, and, no card must be covered on the
            // deck. Additionally, the role can't be passed if the player to the
            // left has less cards than the length of the deck + 1.
            if (Array.from(this.tableTop.keys()).some((tableCard) => parseCard(tableCard)[0] !== cardNumeric)) {
                throw new Error("Improper card for the transfer of defense state to next player.");
            }

            // transfer defense state to the next player
            this.setDefendingPlayer(this.getPlayerNameByOffset(name, 1));
        }

        // add the card to the table top from the player's deck.
        this.transferCardOntoTable(player, card);

        // finally, reset everybody's 'turned' value since the tableTop state changed.
        this.players.forEach((player, name) => {
            player.turned = false;
        });
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
     * @param {String} card - The card that's going to be used to cover the table top card.
     * @param {number} pos - The position of the card that's going to be covered.
     *
     * @todo add this transaction as a history node.
     * */
    coverCardOnTableTop(card, pos) {
        const defendingPlayer = this.players.get(this.getDefendingPlayerName());

        // check that the 'card' is present on the table top...
        if (!defendingPlayer.deck.includes(card)) {
            throw new Error("Defending card is not present in the defending players deck.");
        }


        // check that the 'coveringCard' is present in the defending players deck.
        if (!this.getCardOnTableTopAt(pos)) {
            throw new Error("Defending card is not present in the defending players deck.");
        }


        const [numeric, suit] = parseCard(this.getCardOnTableTopAt(pos));
        const [coveringNumeric, coveringSuit] = parseCard(card);

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
        if (coveringSuit === suit) {
            // The trumping suit doesn't matter here since they are the same
            if (numeric > coveringNumeric) {
                throw new Error("Covering card must have a higher value.");
            }
        } else if (coveringSuit !== this.trumpCard.suit) {
            throw new Error(`Covering card suit must be the same suit as the table card and have a higher numerical value.`);
        }

        // Transfer the player card from their deck to the the table top.
        this.tableTop.set(this.getCardOnTableTopAt(pos), card);
        defendingPlayer.deck = defendingPlayer.deck.filter((playerCard) => playerCard !== card);

        // finally, reset everybody's 'turned' value since the tableTop state changed.
        this.players.forEach((player, name) => {
            player.turned = false;
        });
    }

    /**
     * @version 1.0.0
     * This method will transfer the status of defending player to the
     * specified player id.
     *
     * @param {String} name - The name of the player that the defending status
     *        is being transferred to.
     * */
    setDefendingPlayer(name) {
        const player = this.players.get(name);

        if (typeof player === 'undefined') {
            throw new Error("Player doesn't exist.");
        }

        // unset the current defending player status, and then set the status
        // of the given player id as defending.
        const defendingPlayerName = this.getDefendingPlayerName();
        let attackingPlayerName;

        if (typeof defendingPlayerName !== "undefined") {
            attackingPlayerName = defendingPlayerName;
        } else {
            // only unset if there even exists a defending player. This can happen
            // when a game is being initialised and there is no current defender.
            attackingPlayerName = this.getPlayerNameByOffset(name, -1);
        }

        // reset everyone's 'canAttack' privileges...
        this.players.forEach((player, name) => {
            player.canAttack = false;
        });


        // Update the parameters for the attacking player...
        let attackingPlayer = this.players.get(attackingPlayerName);

        attackingPlayer = {
            ...attackingPlayer,
            isDefending: false,
            canAttack: true,
            beganRound: true,
        }

        // TODO: add this transaction as a history node.
        this.players.set(attackingPlayerName, attackingPlayer);


        player.isDefending = true;
        player.canAttack = false;
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
    finalisePlayerTurn(name) {
        const player = this.players.get(name);

        // player doesn't exist.
        if (typeof player === 'undefined') {
            throw new Error("Player doesn't exist.")
        }

        player.turned = true;

        // If this is the attacking player, set everyone's 'canAttack' (except defending)
        // player as true since the move has been made..
        const defendingPlayer = this.getDefendingPlayerName();
        const attackingPlayer = this.getPlayerNameByOffset(defendingPlayer, -1);

        if (attackingPlayer === name) {
            this.players.forEach((player, name) => {
                if (name !== defendingPlayer) {
                    player.canAttack = true;
                }
            });
        }

    }


    /**
     * @version 1.0.0
     * This function is used to retrieve the current defending player from the
     * player list.
     *
     * @return {String} the 'id' of the defending player.
     * */
    getDefendingPlayerName() {
        return Array.from(this.players.keys()).find(name => this.players.get(name).isDefending);
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
    getPlayerNameByOffset(name, offset) {
        const playerNames = Array.from(this.players.keys());
        const playerIndex = playerNames.indexOf(name);

        if (playerIndex < 0) {
            throw new Error("Player doesn't exist within the lobby.");
        }

        return playerNames[Math.abs(playerIndex + offset) % this.players.size];
    }

    /**
     * @version 1.0.0
     * Method to retrieve the player who started the current round, this method
     * is used to determine how cards should be handed out(replenished) at the end
     * of a round if any player needs cards to fill their deck.
     *
     * @return {String} the name of the player who initiated the round.
     * */
    getRoundStarter() {
        return Array.from(this.players.keys()).find((name) => this.players.get(name).beganRound);
    }

    /**
     * @version 1.0.0
     * This function is used to return the contents of the table top in the form of
     * an array. The function does not return 'empty' slots if there are any present.
     *
     * @return {Array<String>} an array of cards.
     * */
    getTableTopDeck() {
        return Array.from(this.tableTop.entries()).flat().filter(item => item !== null);
    }

    /**
     * Method to get a bottom card of the table top by a position on the table.
     *
     * @param {number} pos - The position of the card to get from the table top,
     *
     * @return {?String} The card on the table top at the given position, if nothing
     * is at the given position the method will return 'undefined'.
     * */
    getCardOnTableTopAt(pos) {
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
    transferCardOntoTable(player, card) {
        if (!(this.tableTop.size < 6)) {
            throw new Error("Player deck already full.");
        }

        if (!player.deck.includes(card)) {
            throw new Error("Defending card is not present in the defending players deck.");
        }

        this.tableTop.set(card, null);
        player.deck = player.deck.filter((tableCard) => tableCard !== card);
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
    transferTableTop(to) {
        if (!this.players.has(to)) {
            throw new Error("Player doesn't exist.");
        }

        this.players.get(to).deck.push(...this.getTableTopDeck());
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
    voidTableTop() {
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
     * @param {String} name - The name of the player to generate state for
     * */
    getStateForPlayer(name) {
        const player = this.players.get(name);

        if (typeof player === 'undefined') {
            throw new Error("Player doesn't exist.");
        }

        return {
            deck: player.deck,
            isDefending: player.isDefending,
            canAttack: player.canAttack,
            turned: player.turned,

            // general info about the game state
            trumpCard: this.trumpCard,
            deckSize: this.deck.length,
            tableTop: Object.fromEntries(this.tableTop),

            // information about other players, including how many cards they
            // are holding, if they have turned, and if they are defending...
            players: Array.from(this.players.keys())
                .filter(name => name !== player.name)
                .map(name => {
                    const player = this.players.get(name);

                    return {
                        [name]: {
                            size: player.deck.length,
                            isDefending: player.isDefending,
                            turned: player.turned,
                        }
                    }
                }),
        }
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
    serialize() {
        return {
            players: this.players,
            history: this.history,
            trumpCard: this.trumpCard,
            deck: this.deck,
            tableTop: this.tableTop,
        }
    }
}
