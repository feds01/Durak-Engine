import {Game} from "./game";


describe("Game tests", () => {
    test("should create a new game without crashing", () =>
        expect(() => new Game(["player1", "player2"], null)).not.toThrow()
    )

    test("Game.fromState should produce the same object", () => {
        const game = new Game(["player1", "player2"], null, {randomisePlayerOrder: false});
        const save = game.serialize();

       expect(Game.fromState(save.game, save.history, {randomisePlayerOrder: false})).toStrictEqual(game);
    });

    test("Game.fromState re-creates correct state after move", () => {
        const game = new Game(["player1", "player2"], null);
        const attacker = game.getAttackingPlayerName();

        // Adds the attackers first card onto table top
        game.addCardToTableTop(attacker, game.getPlayer(attacker).deck[0]);

        const save = game.serialize();
        expect(Game.fromState(save.game, save.history, {randomisePlayerOrder: false})).toStrictEqual(game);
    });
});
