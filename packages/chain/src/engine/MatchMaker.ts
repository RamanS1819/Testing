import {
  RuntimeModule,
  runtimeModule,
  state,
  runtimeMethod,
} from '@proto-kit/module';
import { UInt64 as ProtoUInt64 } from '@proto-kit/library';
import { State, StateMap, assert } from '@proto-kit/protocol';
import { PublicKey, Struct, UInt64, Provable, Bool } from 'o1js';
import { Lobby, LobbyManager } from './LobbyManager';

interface MatchMakerConfig {}

export const PENDING_BLOCKS_NUM_CONST = 20;

const BLOCK_PRODUCTION_SECONDS = 5;
export const MOVE_TIMEOUT_IN_BLOCKS = 60 / BLOCK_PRODUCTION_SECONDS;

const PENDING_BLOCKS_NUM = UInt64.from(PENDING_BLOCKS_NUM_CONST);

export class RoundIdxUser extends Struct({
  roundId: UInt64,
  userAddress: PublicKey,
}) {}

export class RoundIdxIndex extends Struct({
  roundId: UInt64,
  index: UInt64,
}) {}

export class AddressxAddress extends Struct({
  user1: PublicKey,
  user2: PublicKey,
}) {}

export class QueueListItem extends Struct({
  userAddress: PublicKey,
  registrationTimestamp: UInt64,
}) {}

export class PendingLobbyIndex extends Struct({
  roundId: UInt64,
  type: UInt64,
}) {}

// abstract class

@runtimeModule()
export class MatchMaker extends LobbyManager {
  // Round => pending lobby
  @state() public pendingLobby = StateMap.from<PendingLobbyIndex, Lobby>(
    PendingLobbyIndex,
    Lobby,
  );

  // mapping(roundId => mapping(registered user address => bool))
  @state() public queueRegisteredRoundUsers = StateMap.from<RoundIdxUser, Bool>(
    RoundIdxUser,
    Bool,
  );
  // mapping(roundId => SessionKey[])
  @state() public queueRoundUsersList = StateMap.from<
    RoundIdxIndex,
    QueueListItem
  >(RoundIdxIndex, QueueListItem);
  @state() public queueLength = StateMap.from<UInt64, UInt64>(UInt64, UInt64);

  // Game ids start from 1
  // abstract games: StateMap<UInt64, any>;
  @state() public games = StateMap.from<UInt64, any>(UInt64, UInt64);

  @state() public gamesNum = State.from<UInt64>(UInt64);

  @state() public defaultLobbies = StateMap.from<UInt64, Lobby>(UInt64, Lobby);
  @state() public lastDefaultLobby = State.from<UInt64>(UInt64);

  @runtimeMethod()
  public addDefaultLobby(participationFee: ProtoUInt64): void {
    let lobby = Lobby.default(UInt64.zero);
    lobby.participationFee = participationFee;
    this.defaultLobbies.set(this.lastDefaultLobby.get().value, lobby);
    this.lastDefaultLobby.set(this.lastDefaultLobby.get().value.add(1));
  }

  @runtimeMethod()
  public register(
    sessionKey: PublicKey,
    type: UInt64,
    timestamp: UInt64,
  ): void {
    const sender = this.transaction.sender.value;
    // If player in game – revert

    Provable.asProver(() => {
      const gameId = this.activeGameId.get(sender).orElse(UInt64.from(0));
      if (gameId.equals(UInt64.from(0)).not().toBoolean()) {
        console.log(
          `Register failed. Player already in game ${gameId.toString()}`,
        );
      }
    });

    assert(
      this.activeGameId
        .get(sender)
        .orElse(UInt64.from(0))
        .equals(UInt64.from(0)),
      'Player already in game',
    );

    this.sessions.set(sessionKey, sender);
    const roundId = this.network.block.height.div(PENDING_BLOCKS_NUM);
    const pendingLobbyIndex = new PendingLobbyIndex({
      roundId,
      type,
    });

    // Join lobby
    let lobby = this.joinPendingLobby(pendingLobbyIndex);

    // If lobby is full - run game
    const lobbyReady = lobby.isFull();

    lobby = this.flushPendingLobby(pendingLobbyIndex, lobbyReady);

    const gameId = this.initGame(lobby, lobbyReady);
  }

  private joinPendingLobby(lobbyIndex: PendingLobbyIndex): Lobby {
    const sender = this.transaction.sender.value;
    const lobby = this.pendingLobby
      .get(lobbyIndex)
      .orElse(this.getDefaultLobby(lobbyIndex.type));

    assert(
      this.queueRegisteredRoundUsers
        .get(
          new RoundIdxUser({
            roundId: lobby.id,
            userAddress: sender,
          }),
        )
        .value.not(),
      'User already in queue',
    );

    this.queueRegisteredRoundUsers.set(
      new RoundIdxUser({
        roundId: lobby.id,
        userAddress: sender,
      }),
      Bool(true),
    );

    this._joinLobby(lobby);
    this.pendingLobby.set(lobbyIndex, lobby);
    return lobby;
  }

  // Transform pending lobby to active lobby
  // Returns activeLobby
  private flushPendingLobby(
    pendingLobyIndex: PendingLobbyIndex,
    shouldFlush: Bool,
  ): Lobby {
    let lobby = this.pendingLobby.get(pendingLobyIndex).value;

    lobby.players.forEach((player) => {
      this.queueRegisteredRoundUsers.set(
        new RoundIdxUser({
          roundId: lobby.id,
          userAddress: player,
        }),
        shouldFlush.not(),
      );
    });

    this.pendingLobby.set(
      pendingLobyIndex,
      Provable.if(
        shouldFlush,
        Lobby,
        this.getDefaultLobby(pendingLobyIndex.type),
        lobby,
      ) as Lobby,
    );

    let activeLobby = this._addLobby(lobby, shouldFlush);

    return activeLobby;
  }

  private getDefaultLobby(type: UInt64): Lobby {
    return this.defaultLobbies.get(type).value;
  }

  protected proveOpponentTimeout(gameId: UInt64, passTurn: boolean): void {
    const sessionSender = this.sessions.get(this.transaction.sender.value);
    const sender = Provable.if(
      sessionSender.isSome,
      sessionSender.value,
      this.transaction.sender.value,
    );
    const game = this.games.get(gameId);
    const nextUser = Provable.if(
      game.value.currentMoveUser.equals(game.value.player1),
      game.value.player2,
      game.value.player1,
    );
    assert(game.isSome, 'Invalid game id');
    assert(nextUser.equals(sender), `Not your move`);
    assert(game.value.winner.equals(PublicKey.empty()), `Game finished`);

    const isTimeout = this.network.block.height
      .sub(game.value.lastMoveBlockHeight)
      .greaterThan(UInt64.from(MOVE_TIMEOUT_IN_BLOCKS));

    assert(isTimeout, 'Timeout not reached');

    if (passTurn) {
      game.value.currentMoveUser = Provable.if(
        game.value.currentMoveUser.equals(game.value.player1),
        game.value.player2,
        game.value.player1,
      );
      game.value.lastMoveBlockHeight = this.network.block.height;
    } else {
      game.value.winner = sender;
      game.value.lastMoveBlockHeight = this.network.block.height;
      // Removing active game for players if game ended
      this.activeGameId.set(game.value.player1, UInt64.from(0));
      this.activeGameId.set(game.value.player2, UInt64.from(0));
    }

    this.games.set(gameId, game.value);
  }

  protected acquireFunds(
    gameId: UInt64,
    player1: PublicKey,
    player2: PublicKey,
    player1Share: ProtoUInt64,
    player2Share: ProtoUInt64,
    totalShares: ProtoUInt64,
  ) {
    const player1PendingBalance = this.pendingBalances.get(player1);
    const player2PendingBalance = this.pendingBalances.get(player2);
    // Provable.log(player1, player2, player1Share, player2Share, totalShares);
    // Provable.log(
    //   ProtoUInt64.from(this.gameFund.get(gameId).value)
    //     .mul(player1Share)
    //     .div(totalShares),
    //   ProtoUInt64.from(this.gameFund.get(gameId).value)
    //     .mul(player2Share)
    //     .div(totalShares),
    // );
    this.pendingBalances.set(
      player1,
      ProtoUInt64.from(player1PendingBalance.value).add(
        ProtoUInt64.from(this.gameFund.get(gameId).value)
          .mul(player1Share)
          .div(totalShares),
      ),
    );

    this.pendingBalances.set(
      player2,
      ProtoUInt64.from(player2PendingBalance.value).add(
        ProtoUInt64.from(this.gameFund.get(gameId).value)
          .mul(player2Share)
          .div(totalShares),
      ),
    );
  }
}
