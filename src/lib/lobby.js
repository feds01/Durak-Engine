import {CardSuits} from "./game";
import {shuffleArray} from "./utils";


/**
 * @deprecated
 * */
export function createGamePassphrase() {
    const cardSuites = Object.values(CardSuits);
    shuffleArray(cardSuites);

    return cardSuites;
}
