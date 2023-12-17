import {
    RuntimeModule,
    runtimeModule,
    state,
    runtimeMethod,
} from '@proto-kit/module';
import { State, StateMap } from '@proto-kit/protocol';
import {
    Experimental,
    PublicKey,
    Field,
    UInt64,
    Struct,
    Provable,
    Int64,
    Bool,
} from 'o1js';
import {
    BRICK_HALF_WIDTH,
    DEFAULT_BALL_LOCATION_X,
    DEFAULT_BALL_LOCATION_Y,
    DEFAULT_BALL_SPEED_X,
    DEFAULT_BALL_SPEED_Y,
    DEFAULT_PLATFORM_SPEED,
    DEFAULT_PLATFORM_X,
    FIELD_PIXEL_HEIGHT,
    FIELD_PIXEL_WIDTH,
    FIELD_WIDTH,
    GAME_LENGTH,
    INITIAL_SCORE,
    MAX_BRICKS,
    PLATFORM_HALF_WIDTH,
    SCORE_PER_TICKS,
} from './constants';

export class GameRecordKey extends Struct({
    seed: UInt64,
    player: PublicKey,
}) {}

export class Point extends Struct({
    x: UInt64,
    y: UInt64,
}) {
    static from(_x: number, _y: number): Point {
        return new Point({
            x: new UInt64(_x),
            y: new UInt64(_y),
        });
    }

    add(p: Point): Point {
        return new Point({
            x: this.x.add(p.x),
            y: this.y.add(p.y),
        });
    }
}

export class Tick extends Struct({
    action: UInt64,
}) {}

export class GameInputs extends Struct({
    tiks: Provable.Array(Tick, GAME_LENGTH),
}) {}

class MapGenerationPublicOutput extends Struct({}) {}

export function checkMapGeneration(
    seed: Field,
    bricks: Bricks
): MapGenerationPublicOutput {
    return new MapGenerationPublicOutput({});
}

export class GameRecordPublicOutput extends Struct({
    score: UInt64,
}) {}

/////////////////////////////////// Game logic structs //////////////////////////////////

export class IntPoint extends Struct({
    x: Int64,
    y: Int64,
}) {
    static from(_x: number, _y: number): IntPoint {
        return new IntPoint({
            x: Int64.from(_x),
            y: Int64.from(_y),
        });
    }
}

export class Brick extends Struct({
    pos: IntPoint, //
    value: UInt64,
}) {}

export class Bricks extends Struct({
    bricks: Provable.Array(Brick, MAX_BRICKS),
}) {}

class Ball extends Struct({
    position: IntPoint,
    speed: IntPoint,
}) {
    move(): void {
        this.position.x = this.position.x.add(this.speed.x);
        this.position.y = this.position.y.add(this.speed.y);
    }
}

class Platform extends Struct({
    position: Int64,
}) {}

////////////////////////////////// Game logic structs end ////////////////////////////////

const getSign = (x: Int64): Int64 => {
    return Provable.if(x.isPositive(), Int64.from(1), Int64.from(-1));
};

const gr = (a: Int64, b: Int64): Bool => {
    return a.sub(b).isPositive();
};

const inRange = (
    x: Int64 | number,
    left: Int64 | number,
    right: Int64 | number
): Bool => {
    left = Int64.from(left);
    right = Int64.from(right);
    x = Int64.from(x);

    let order = gr(right, left);
    [left, right] = [
        Provable.if(order, left, right),
        Provable.if(order, right, left),
    ];
    let rightVal = right.sub(x);
    let leftVal = x.sub(left);
    return rightVal.isPositive().and(leftVal.isPositive());
};

export class GameContext extends Struct({
    bricks: Bricks,
    totalLeft: UInt64,
    ball: Ball,
    platform: Platform,
    score: UInt64,
    winable: Bool,
    alreadyWon: Bool,
    debug: Bool,
}) {
    processTick(tick: Tick): void {
        // 1) Update score
        this.score = Provable.if(
            this.alreadyWon,
            this.score,
            this.score.sub(SCORE_PER_TICKS)
        );

        const cartAtStop = this.platform.position.sub(Int64.from(FIELD_WIDTH).sub(Int64.from(PLATFORM_HALF_WIDTH))).isPositive();

        /// 2) Update platform position
        this.platform.position = Provable.if(
            cartAtStop,
            Int64.from(FIELD_WIDTH).sub(Int64.from(PLATFORM_HALF_WIDTH)),
            this.platform.position
        ); 
        
        this.platform.position.add(1).sub(tick.action).mul(DEFAULT_PLATFORM_SPEED);

        /// 3) Update ball position
        const prevBallPos = new IntPoint({
            x: this.ball.position.x,
            y: this.ball.position.y,
        });

        this.ball.move();

        /// 4) Check for edge bumps

        const leftBump = this.ball.position.x.isPositive().not();
        const rightBump = this.ball.position.x
            .sub(FIELD_PIXEL_WIDTH)
            .isPositive();
        const topBump = this.ball.position.y
            .sub(FIELD_PIXEL_HEIGHT)
            .isPositive();
        const bottomBump = this.ball.position.y.isPositive().not();

        /// Add come constrains just in case

        // If bumf - just return it and change speed
        this.ball.position.x = Provable.if(
            leftBump,
            this.ball.position.x.neg(),
            this.ball.position.x
        );

        this.ball.position.x = Provable.if(
            rightBump,
            Int64.from(FIELD_PIXEL_WIDTH).sub(
                this.ball.position.x.sub(Int64.from(FIELD_PIXEL_WIDTH))
            ),
            this.ball.position.x
        );

        this.ball.speed.x = Provable.if(
            leftBump.or(rightBump),
            this.ball.speed.x.neg(),
            this.ball.speed.x
        );

        this.ball.position.y = Provable.if(
            topBump,
            Int64.from(FIELD_PIXEL_HEIGHT).sub(
                this.ball.position.y.sub(Int64.from(FIELD_PIXEL_HEIGHT))
            ),
            this.ball.position.y
        );
        this.ball.position.y = Provable.if(
            bottomBump,
            this.ball.position.y.neg(),
            this.ball.position.y
        );

        this.ball.speed.y = Provable.if(
            topBump.or(bottomBump),
            this.ball.speed.y.neg(),
            this.ball.speed.y
        );

        /// 5) Check platform bump
        let isFail = bottomBump.and(
            /// Too left from the platform
            this.ball.position.x
                .sub(this.platform.position.sub(PLATFORM_HALF_WIDTH))
                .isPositive()
                .not()
                .or(
                    // Too right from the platform
                    this.ball.position.x
                        .sub(this.platform.position.add(PLATFORM_HALF_WIDTH))
                        .isPositive()
                )
        );

        this.winable = this.winable.and(isFail.not());

        //6) Check bricks bump

        for (let j = 0; j < MAX_BRICKS; j++) {
            const currentBrick = this.bricks.bricks[j];
            let isAlive = currentBrick.value.greaterThan(UInt64.from(1)); // 1 just so UInt64.sub do not underflow

            let leftBorder = currentBrick.pos.x;
            let rightBorder = currentBrick.pos.x.add(BRICK_HALF_WIDTH * 2);
            let topBorder = currentBrick.pos.y.add(BRICK_HALF_WIDTH * 2);
            let bottomBorder = currentBrick.pos.y;

            /*
            Collision
                ball.pos.x \inc [leftBorder, rightBorder]
                ball.pos.y \inc [bottomBorder, topBorder]

            */

            const hasRightPass = inRange(
                rightBorder,
                prevBallPos.x,
                this.ball.position.x
            );
            const hasLeftPass = inRange(
                leftBorder,
                prevBallPos.x,
                this.ball.position.x
            );
            const hasTopPass = inRange(
                topBorder,
                prevBallPos.y,
                this.ball.position.y
            );
            const hasBottomPass = inRange(
                bottomBorder,
                prevBallPos.y,
                this.ball.position.y
            );

            /*
                Detect where collision ocured
                /////////////// vertical part of a brick //////////////////////////
                y = d
                ay = bx + c;
                c = ay1 - bx1
                    a - ball.speed.x
                    b - ball.speed.y
                bx = ay - c
                bx = ad - c;

                x \incl [ brick.pos.x, brick.pos.x + 2 * BRICK_HALF_WIDTH ]
                bx \incl [b(brics.pos.x, b(brick.pos.x + 2 * BRICK_HALF_WIDTH))]
                ad - c \incl [b(brics.pos.x), b(brick.pos.x + 2 * BRICK_HALF_WIDTH))]
                


                /////////////// horizontal part of a brick ////////////////////////////
                x = d
                ay = bx + c
                c = ay1 - bx1
                    a - ball.speed.x
                    b - ball.speed.y
                ay = bd + c

                y \incl [ brick.pos.y, brick.pos.y + 2 * BRICK_HALF_WIDTH]
                ay \incl [ a(brick.pos.y), a(brick.pos.y + 2 * BRICK_HALF_WIDTH)]
                bd + c \incl [ a(brick.pos.y), a(brick.pos.y + 2 * BRICK_HALF_WIDTH)]
            */

            let moveRight = this.ball.speed.x.isPositive();
            let moveTop = this.ball.speed.y.isPositive();

            let a = this.ball.speed.x;
            let b = this.ball.speed.y;
            let c = a
                .mul(this.ball.position.y)
                .sub(b.mul(this.ball.position.x));

            let leftEnd = b.mul(currentBrick.pos.x);
            let rightEnd = b.mul(currentBrick.pos.x.add(2 * BRICK_HALF_WIDTH));

            // Top horizontal
            let d1 = topBorder;
            let adc1 = a.mul(d1).sub(c);
            let crossBrickTop = inRange(adc1, leftEnd, rightEnd);
            let hasTopBump = crossBrickTop.and(
                prevBallPos.y.sub(topBorder).isPositive()
            );

            // Bottom horisontal
            let d2 = bottomBorder;
            let adc2 = a.mul(d2).sub(c);
            let crossBrickBottom = inRange(adc2, leftEnd, rightEnd);
            let hasBottomBump = crossBrickBottom.and(
                bottomBorder.sub(prevBallPos.y).isPositive()
            );

            let topEnd = a.mul(currentBrick.pos.y.add(2 * BRICK_HALF_WIDTH));
            let bottomEnd = a.mul(currentBrick.pos.y);

            // Left vertical
            let d3 = leftBorder;
            let bdc1 = b.mul(d3).add(c);
            let crossBrickLeft = inRange(bdc1, bottomEnd, topEnd);
            let hasLeftBump = crossBrickLeft.and(
                leftBorder.sub(prevBallPos.x).isPositive()
            );

            // Right vertical
            let d4 = rightBorder;
            let bdc2 = b.mul(d4).add(c);
            let crossBrickRight = inRange(bdc2, bottomEnd, topEnd);
            let hasRightBump = crossBrickRight.and(
                prevBallPos.x.sub(rightBorder).isPositive()
            );

            /// Exclude double collision
            hasRightBump = Provable.if(
                moveRight,
                hasRightBump.and(hasTopBump.not()).and(hasBottomBump.not()),
                hasRightBump
            );
            hasLeftBump = Provable.if(
                moveRight,
                hasLeftBump,
                hasLeftBump.and(hasTopBump.not()).and(hasBottomBump.not())
            );
            hasTopBump = Provable.if(
                moveTop,
                hasTopBump.and(hasRightBump.not()).and(hasLeftBump.not()),
                hasTopBump
            );
            hasBottomBump = Provable.if(
                moveTop,
                hasBottomBump,
                hasBottomBump.and(hasRightBump.not()).and(hasLeftBump.not())
            );

            const collisionHappen = isAlive.and(
                hasRightPass
                    .and(hasRightBump)
                    .or(hasLeftPass.and(hasRightBump))
                    .or(hasTopPass.and(hasTopBump))
                    .or(hasBottomPass.and(hasBottomBump))
            );

            // Reduce health if coliision happend and brick is not dead

            currentBrick.value = Provable.if(
                collisionHappen,
                currentBrick.value.sub(1),
                currentBrick.value
            );

            this.totalLeft = Provable.if(
                collisionHappen,
                this.totalLeft.sub(1),
                this.totalLeft
            );

            this.alreadyWon = Provable.if(
                this.totalLeft.equals(UInt64.from(1)),
                Bool(true),
                this.alreadyWon
            );

            this.ball.speed.x = Provable.if(
                collisionHappen.and(hasLeftBump.or(hasRightBump)),
                this.ball.speed.x.neg(),
                this.ball.speed.x
            );

            /*
                dx = x - leftBorder
                newX = leftBorder - (x - leftBorder) = 2leftBorder - x

                dx = rightBorder - x
                nexX = rightBorder + (rightBorder - x) = 2 rightBorder - x
            */

            // Update position on bump
            this.ball.position.x = Provable.if(
                collisionHappen.and(hasLeftBump),
                leftBorder.mul(2).sub(this.ball.position.x),
                this.ball.position.x
            );

            this.ball.position.x = Provable.if(
                collisionHappen.and(hasRightBump),
                rightBorder.mul(2).sub(this.ball.position.x),
                this.ball.position.x
            );

            this.ball.speed.y = Provable.if(
                collisionHappen.and(hasBottomBump.or(hasTopBump)),
                this.ball.speed.y.neg(),
                this.ball.speed.y
            );

            this.ball.position.y = Provable.if(
                collisionHappen.and(hasTopBump),
                topBorder.mul(2).sub(this.ball.position.y),
                this.ball.position.y
            );

            this.ball.position.y = Provable.if(
                collisionHappen.and(hasBottomBump),
                bottomBorder.mul(2).sub(this.ball.position.y),
                this.ball.position.y
            );
        }

        if (this.debug.toBoolean()) {
            console.log(
                `Ball position: <${this.ball.position.x} : ${this.ball.position.y}>`
            );
            console.log(
                `Ball speed: ${this.ball.speed.x} : ${this.ball.speed.y}`
            );
        }
    }
}

export function loadGameContext(bricks: Bricks, debug: Bool) {
    let score = UInt64.from(INITIAL_SCORE);
    let ball = new Ball({
        position: IntPoint.from(
            DEFAULT_BALL_LOCATION_X,
            DEFAULT_BALL_LOCATION_Y
        ),
        speed: IntPoint.from(DEFAULT_BALL_SPEED_X, DEFAULT_BALL_SPEED_Y),
    });
    let platform = new Platform({
        position: Int64.from(DEFAULT_PLATFORM_X),
    });

    let totalLeft = UInt64.from(1); // Again 1 == 0

    for (let i = 0; i < bricks.bricks.length; i++) {
        totalLeft = totalLeft.add(bricks.bricks[i].value.sub(1)); // Sub(1), because 1 = 0. (Workaround UInt64.sub(1))
    }

    return new GameContext({
        bricks,
        totalLeft,
        ball,
        platform,
        score,
        winable: new Bool(true),
        alreadyWon: new Bool(false),
        debug,
    });
}

export function checkGameRecord(
    // publicInput: Bricks
    bricks: Bricks,
    gameInputs: GameInputs,
    debug: Bool
): GameRecordPublicOutput {
    const gameContext = loadGameContext(bricks, debug);

    for (let i = 0; i < gameInputs.tiks.length; i++) {
        gameContext.processTick(gameInputs.tiks[i]);
    }

    gameContext.winable.assertTrue();

    for (let i = 0; i < gameContext.bricks.bricks.length; i++) {
        /// Check that all bricks is destroyed
        gameContext.bricks.bricks[i].value.assertEquals(UInt64.from(1));
    }

    return new GameRecordPublicOutput({ score: gameContext.score });
}

export const gameRecord = Experimental.ZkProgram({
    publicOutput: GameRecordPublicOutput,
    methods: {
        checkGameRecord: {
            // privateInputs: [],
            privateInputs: [Bricks, GameInputs, Bool],
            method: checkGameRecord,
        },
    },
});

export class GameRecordProof extends Experimental.ZkProgram.Proof(gameRecord) {}

@runtimeModule()
export class GameHub extends RuntimeModule<unknown> {
    /// Seed + User => Record
    @state() public gameRecords = StateMap.from<GameRecordKey, UInt64>(
        GameRecordKey,
        UInt64
    );
    @state() public seeds = StateMap.from<UInt64, UInt64>(UInt64, UInt64);
    @state() public lastSeed = State.from<UInt64>(UInt64);
    @state() public lastUpdate = State.from<UInt64>(UInt64);

    @runtimeMethod()
    public updateSeed(seed: UInt64): void {
        const lastSeedIndex = this.lastSeed.get().orElse(UInt64.from(0));
        this.seeds.set(lastSeedIndex, seed);
        this.lastSeed.set(lastSeedIndex.add(1));
    }

    @runtimeMethod()
    public addGameResult(gameRecordProof: GameRecordProof): void {
        gameRecordProof.verify();

        const gameKey = new GameRecordKey({
            seed: this.seeds.get(this.lastSeed.get().value).value,
            player: this.transaction.sender,
        });

        const currentScore = this.gameRecords.get(gameKey).value;
        const newScore = gameRecordProof.publicOutput.score;

        if (currentScore < newScore) {
            this.gameRecords.set(gameKey, newScore);
        }
    }
}
