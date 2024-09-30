// import { api } from "@zknoid/sdk/trpc/react";
import { getEnvContext } from "@zknoid/sdk/lib/envContext";
import { PublicKey, UInt64 } from "o1js";
import { useStore } from "zustand";
import { useSessionKeyStore } from "@zknoid/sdk/lib/stores/sessionKeyStorage";
import { client } from "zknoid-chain-dev";
import { useNetworkStore } from "@zknoid/sdk/lib/stores/network";
import { GameState } from "../lib/gameState";

export const useStartGame = (setGameState: (state: GameState) => void) => {
  // const gameStartedMutation = api.logging.logGameStarted.useMutation();
  const sessionPublicKey = useStore(useSessionKeyStore, (state) =>
    state.getSessionKey()
  ).toPublicKey();
  const networkStore = useNetworkStore();
  return async () => {
    // gameStartedMutation.mutate({
    //   gameId: "checkers",
    //   userAddress: networkStore.address ?? "",
    //   envContext: getEnvContext(),
    // });

    const randzuLogic = client.runtime.resolve("CheckersLogic");

    const tx = await client.transaction(
      PublicKey.fromBase58(networkStore.address!),
      async () => {
        randzuLogic.register(
          sessionPublicKey,
          UInt64.from(Math.round(Date.now() / 1000))
        );
      }
    );

    await tx.sign();
    await tx.send();

    setGameState(GameState.MatchRegistration);
  };
};
