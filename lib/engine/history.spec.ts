import {History} from "./history";
import {Game} from "./game";


describe("History sub-system tests", () => {
    test("should create a new game without crashing", () => {
        const game = new Game(["player1", "player2"], null);

        expect(() => new History(game.serialize().game, null)).not.toThrow()
    });
});
