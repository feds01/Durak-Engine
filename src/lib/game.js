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
    static DECK_SIZE = 6;

    /**
     * @version 1.0.0
     * Game constructor initialises the game deck, players and the
     * history object.
     *
     * @param {Array<String>} players An array of player names that are within the game.
     * @param {Array<{}>} history - An array of history nodes for the game to rebuild the previous
     * state from.
     * */
    constructor(players, history = []) {
        this.history = history;
        this.players = new Map();

        /**
         * This is the deck that's currently placed on the table. It's easier to work
         * with a Key-Value structure. The keys signify cards that are opposing the
         * defending player, and the values are the cards that the defending player
         * sets to defend against the card. */
        this.tableTop = new Map();

        // generate card deck and shuffle it for the game
        this.deck = generateCardDeck();
        shuffleArray(this.deck);

        // perform an 'id' check to see if there is a entry within MongoDB

        // Check if the players argument follows the specified constraints.
        if (!Number.isInteger(players) && players < 1) {
            throw new Error("Number of players must be a positive integer.");
        } else if (players > 8) {
            throw new Error("Number of players cannot be greater than eight.");
        } else {

            // check that all of the player names are unique
            if ((new Set(players)).size !== players.length) {
                throw new Error("Player names must be unique.")
            }
            // set the game up for the 'players' number.
            for (let index = 0; index < players.length; index++) {
                this.players.set(players[index], {
                    deck: [],
                    turned: false,
                    isDefending: false,
                });
            }
        }

        // distribute the cards between the players as if in a physical way
        for (let index = 0; index < Game.DECK_SIZE; index++) {
            this.players.forEach((value, key) => {
                this.players.get(key).deck.push(this.deck.shift());
            });
        }

        // select the attacking player randomly, the SDK can provide a method
        // for overriding the starting attacking player later on...
        this.players.get(getRandomKey(this.players)).isDefending = true;

        // Select the first remaining card and set the 'suit' of the game and then
        // shift the first element to the end of the stack.
        this.trumpSuit = parseCard(this.deck[0])[1];
        this.deck.push(this.deck.shift());
    }

    /**
     * @version 1.0.0
     * This function will setup the next round of the game. The method performs
     * several check and operations in order to prepare for the next round. Firstly,
     * we should determine who the the next defending player should be. This depends
     * on the fact if the current defending player managed to successfully defend
     * themselves or has decided to pickup the cards. Additionally, the method should
     * iterate over all the players to replenish the player card decks.
     * */
    finaliseRound() {
        const generator = this.tableTop.entries();
        let nextItem = generator.next();
        let forfeitRound = false;

        while (!nextItem.done || forfeitRound) {
            if (nextItem.value[1] === null) {
                forfeitRound = true
            }

            nextItem = generator.next();
        }

        // TODO: check that all players have declared that they finished the round.
        if (forfeitRound) {
            // Take the cards from the table top and move them into the players
            // personal deck
            const player = this.players.get(this.getDefendingPlayer());

            player.deck = [player.deck, ...this.getTableTopDeck()];

            this.setDefendingPlayer(this.getPlayerIdByOffset(1));
        } else {
            this.setDefendingPlayer(this.getPlayerIdByOffset(2));
        }

        this.voidTableTop();

        // Check if the 'spare' deck size is greater than zero and therefore we can
        // replenish the players' card decks.
        if (this.deck.length > 0) {

            // we need to transpose the player list to begin with the current
            // attacking player and the rest following in a clockwise manner.
            // TODO: Actually we need to record who the first attacking player was of this round
            //      since it's possible that the prime 'attacking' status can be transferred...
            const playerIds = Array.from(this.players.keys());
            const playerIdx = playerIds.indexOf(this.getDefendingPlayer());

            for (let id of [...playerIds.slice(0, playerIdx), ...playerIds.slice(playerIdx, playerIds.length)]) {
                const player = this.players.get(id);

                // update the deck and set the 'turned' value to false ready for next round
                if (player.deck.length < 6) {
                    player.deck = [...player.deck, this.deck.splice(0, 6 - player.deck.length)];
                }

                player.turned = false;
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
     * @param {String} from - The id of the player that's taking the card.
     * @param {String} card - The card that's being added to the table top.
     * */
    addCardToTableTop(from, card) {
        // check if the deck is already filled up.
        if (!(this.tableTop.size < 6)) {
            throw new Error("Player deck already full.");
        }

        const player = this.players.get(from);

        // check if the id is valid
        if (typeof player === 'undefined') {
            throw new Error("Player doesn't exist.");
        }

        // check that the defending play is able to cover the table top cards.
        const coveredCards = this.tableTop.values().filter((item) => item !== null);

        if (this.tableTop.size - coveredCards.length + 1 > player.deck.length) {
            throw new Error("Player doesn't have enough cards to cover attack.");
        }

        const [cardNumeric] = parseCard(card);

        // Now check the presence of the given card, in the players deck.
        if (!player.deck.includes(card)) {
            throw new Error("Player doesn't hold current card");
        }

        // Also check that the current card is allowed to be added to the deck. To determine this,
        // the cardLabel of the card to be added must be present on the tableTop.
        if (!this.getTableTopDeck().map(item => parseCard(item)[0]).includes(cardNumeric)) {
            throw new Error("Card numerical value isn't present on the table top.");
        }

        // TODO: add this transaction as a history node.
        // finally, if everything passes then add the card to the table top from the players
        // deck.
        this.tableTop.set(card, null);
        player.deck = player.deck.filter((item) => item !== card);
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
     * @param {String} card - The card that's going to be covered on the table.
     * @param {String} coveringCard - The card that's going to be used to cover the
     *        card on the table.
     * */
    coverCardOnTableTop(card, coveringCard) {
        // check that the 'card' is present on the table top...
        if (!Object.keys(this.tableTop).includes(card)) {
            throw new Error("Card is not present on the table top.");
        }

        const defendingPlayer = this.players.get(this.getDefendingPlayer());

        // check that the 'coveringCard' is present in the defending players deck.
        if (!defendingPlayer.deck.includes(coveringCard)) {
            throw new Error("Defending card is not present in the defending players deck.");
        }

        // Now let's determine if the player is trying to transfer the defensive position
        // to the left hand side player. This can be checked by the fact if the 'card' they
        // are trying to cover is equal to null.
        if (card === null) {
            const [cardNumeric] = parseCard(coveringCard);

            // we need to check if the player can transfer the defensive role to
            // the next player. For this to be true, all of the cards in the deck
            // must have the same card label, and, no card must be covered on the
            // deck. Additionally, the role can't be passed if the player to the
            // left has less cards than the length of the deck + 1.
            if (this.tableTop.keys().some((tableCard) => parseCard(tableCard)[0] !== cardNumeric)) {
                throw new Error("Improper card for the transfer of defense state to next player.");
            }

            // check that the next player can handle the defense round...
            let nextPlayer = this.players.get(this.getPlayerIdByOffset(1));

            if (nextPlayer.deck.length < this.tableTop.size + 1) {
                throw new Error("Cannot transfer defense state to next player since they don't have enough cards.");
            }

            // otherwise we now add the card to the table top and set the next player as the defending player.
            // TODO: add this transaction as a history node.
            this.transferCardOntoTable(defendingPlayer, coveringCard);
        } else {
            const [numeric, suit] = parseCard(card);
            const [coveringNumeric, coveringSuit] = parseCard(coveringCard);

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
                if (numeric >= coveringNumeric) {
                    throw new Error("Covering card must have a higher value.");
                }
            }

            if (suit !== this.trumpSuit) {
                throw new Error(`
                        Covering card suit must be the same suit as the 
                        table card and have a higher numerical value.
                    `);
            }

            // Transfer the player card from their deck to the the table top.
            this.tableTop.set(card, coveringCard);
            defendingPlayer.deck = defendingPlayer.deck.filter((playerCard) => playerCard !== coveringCard);
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
    setDefendingPlayer(name) {
        const player = this.players.get(name);

        // player doesn't exist.
        if (typeof player === 'undefined') {
            throw new Error("Player doesn't exist.")
        }

        // unset the current defending player status, and then set the status
        // of the given player id as defending.
        const defendingPlayer = this.getDefendingPlayer();

        // only unset if there even exists a defending player
        if (typeof defendingPlayer !== "undefined") {
            this.players.get(defendingPlayer).isDefending = false;
        }

        player.isDefending = true;
    }

    /**
     * @version 1.0.0
     * This method will transfer the status of defending player to the
     * specified player id.
     *
     * @param {String} name - The name of the player that the defending status
     *        is being transferred to.
     * */
    finalisePlayerTurn(name) {
        const player = this.players.get(name);

        // player doesn't exist.
        if (typeof player === 'undefined') {
            throw new Error("Player doesn't exist.")
        }

        player.turned = true;
    }


    /**
     * @version 1.0.0
     * This function is used to retrieve the current defending player from the
     * player list.
     *
     * @return {String} the 'id' of the defending player.
     * */
    getDefendingPlayer() {
        const generator = this.players.keys();
        let nextItem = generator.next();

        while (!(nextItem.done || this.players.get(nextItem.value).isDefending)) {
            nextItem = generator.next();
        }

        return nextItem.value;
    }

    /**
     * @version 1.0.0
     * This function is used to retrieve a player based by an index from the
     * current defending player. If the index is negative, it will index it from
     * the left hand side. If it's positive, then it will return the index from
     * the right hand side.
     *
     * @param {number} offset - The offset from the current defending player.
     *
     * @return {String} the 'id' of attacking player.
     * */
    getPlayerIdByOffset(offset) {
        const playerIds = Array.from(this.players.keys());
        const defendingPlayerIdx = playerIds.indexOf(this.getDefendingPlayer());

        return playerIds[Math.abs(defendingPlayerIdx + offset) % this.players.size];
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
     * @version 1.0.0
     * This method is used to move a card from a players deck onto the table top. If
     * the tableTop deck is already the size of six or if the card isn't present in
     * the players deck, the method will throw the error.
     *
     * @param {Object} player - The player object that holds player state.
     * @param {String} card - The card that's being transferred from the players deck
     *        to the tableTop deck.
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
     * */
    transferTableTop(to) {
        if (!this.players.has(to)) {
            throw new Error("Player doesn't exist.");
        }

        // TODO: add this transaction as a history node.
        this.players.get(to).deck.push(...this.getTableTopDeck());
        this.voidTableTop();
    }


    /**
     * @version 1.0.0
     * This function will void all the cards that are currently on the table top
     * because it is the end of the round, and the defending player successfully
     * defended themselves against the attackers.
     * */
    voidTableTop() {
        // TODO: add this transaction as a history node.
        this.tableTop.clear();
    }

    /**
     * This method is used to serialize the object so it can be written to the database
     * or send over a http transmission.
     *
     * @return {{players: Map, history: Object, trumpSuit: String, deck: Array, tableTop: Map}}
     * */
    serialize() {
        return {
            players: this.players,
            history: this.history,
            trumpSuit: this.trumpSuit,
            deck: this.deck,
            tableTop: this.tableTop,
        }
    }
}
