import GamePage from "@zknoid/sdk/components/framework/GamePage";
import { lotteryConfig } from "../config";
import { useNetworkStore } from "@zknoid/sdk/lib/stores/network";
import { useContext, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import BannerSection from "./BannerSection";
import TicketsSection from "./TicketsSection";
import { useChainStore } from "@zknoid/sdk/lib/stores/minaChain";
import { DateTime, Duration } from "luxon";
import { NetworkIds, NETWORKS } from "@zknoid/sdk/constants/networks";
import WrongNetworkModal from "./TicketsSection/ui/WrongNetworkModal";
import { fetchAccount } from "o1js";
import { LOTTERY_ADDRESS } from "../constants/addresses";
import { BLOCK_PER_ROUND } from "l1-lottery-contracts";
import StateManager from "./StateManager";
import ConnectWalletModal from "@zknoid/sdk/components/shared/ConnectWalletModal";
import TicketsStorage from "./TicketsStorage";
import {
  useRegisterWorkerClient,
  useWorkerClientStore,
} from "../workers/workerClientStore";
import { useRoundsStore } from "../lib/roundsStore";
import LotteryContext from "../lib/contexts/LotteryContext";

export enum Pages {
  Main,
  Storage,
}

export default function Lottery({}: { params: { competitionId: string } }) {
  const networkStore = useNetworkStore();
  const [roundEndsIn, setRoundEndsIn] = useState<DateTime>(
    DateTime.fromMillis(0),
  );
  const [page, setPage] = useState<Pages>(Pages.Main);

  const workerClientStore = useWorkerClientStore();
  const chainStore = useChainStore();
  // const events = api.lotteryBackend.getMinaEvents.useQuery({});
  const { minaEvents } = useContext(LotteryContext);

  useRegisterWorkerClient();
  const roundsStore = useRoundsStore();
  const lotteryStore = useWorkerClientStore();

  useEffect(() => {
    roundsStore.setRoundToShowId(lotteryStore.lotteryRoundId);
  }, [lotteryStore.lotteryRoundId]);

  useEffect(() => {
    if (!networkStore.minaNetwork?.networkID) return;

    const lotteryPublicKey58 =
      LOTTERY_ADDRESS[networkStore.minaNetwork?.networkID!];

    (async () => {
      const account = await fetchAccount({ publicKey: lotteryPublicKey58 });

      const onchainState = {
        ticketRoot: account.account?.zkapp?.appState[0]!,
        ticketNullifier: account.account?.zkapp?.appState[1]!,
        bankRoot: account.account?.zkapp?.appState[2]!,
        roundResultRoot: account.account?.zkapp?.appState[3]!,
        startBlock: account.account?.zkapp?.appState[4].toBigInt()!,
      };

      console.log("Onchain state", onchainState);

      await workerClientStore.setOnchainState(onchainState);

      if (chainStore.block?.height) {
        const roundId = Math.floor(
          Number(chainStore.block!.slotSinceGenesis - onchainState.startBlock) /
            BLOCK_PER_ROUND,
        );

        workerClientStore.setRoundId(roundId);
      }
    })();
  }, [networkStore.minaNetwork?.networkID, chainStore.block?.height]);

  useEffect(() => {
    console.log(
      "Lottery hook context",
      workerClientStore.client,
      networkStore.minaNetwork?.networkID,
      chainStore.block?.slotSinceGenesis,
      minaEvents?.events,
      !workerClientStore.lotteryGame,
    );
    if (
      workerClientStore.client &&
      networkStore.minaNetwork?.networkID &&
      chainStore.block?.slotSinceGenesis &&
      minaEvents?.events &&
      !workerClientStore.lotteryGame &&
      workerClientStore.onchainState
    ) {
      console.log("Starting lottery");
      workerClientStore.startLottery(
        networkStore.minaNetwork?.networkID!,
        Number(chainStore.block?.slotSinceGenesis),
        minaEvents?.events as unknown as object[],
      );
    }
  }, [
    workerClientStore.client,
    networkStore.minaNetwork?.networkID,
    chainStore.block?.slotSinceGenesis,
    minaEvents,
    workerClientStore.onchainState,
    workerClientStore.lotteryGame,
  ]);

  useEffect(() => {
    // Initialy onchain state initialized in startlottery.
    // Then we only update it with new blocks coming
    if (workerClientStore.lotteryCompiled)
      workerClientStore.updateOnchainState();
  }, [chainStore.block?.height, workerClientStore.lotteryCompiled]);

  // When onchain state is ready
  useEffect(() => {
    if (typeof workerClientStore.lotteryRoundId == undefined) return;

    const startBlock = workerClientStore.onchainState?.startBlock;
    const blockNum = chainStore.block?.slotSinceGenesis;

    // console.log('Lottery state', workerClientStore.onchainState);
    // console.log('Round id', workerClientStore.lotteryRoundId);

    blockNum && startBlock
      ? setRoundEndsIn(
          DateTime.now().plus(
            Duration.fromObject({
              second:
                (BLOCK_PER_ROUND -
                  (Number(blockNum - startBlock) % BLOCK_PER_ROUND)) *
                3 *
                60,
            }),
          ),
        )
      : 0;
  }, [workerClientStore.onchainState, workerClientStore.lotteryRoundId]);

  return (
    <GamePage
      gameConfig={lotteryConfig}
      useTabs={false}
      useTitle={false}
      useLayout={false}
    >
      <StateManager />

      <AnimatePresence mode={"wait"}>
        {page == Pages.Main && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <BannerSection roundEndsIn={roundEndsIn} setPage={setPage} />
            <TicketsSection />
          </motion.div>
        )}
        {page == Pages.Storage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <TicketsStorage setPage={setPage} />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className={
          "flex grid-cols-4 flex-col-reverse gap-4 pt-10 lg:grid lg:pt-0"
        }
        animate={"windowed"}
      ></motion.div>

      {networkStore.address && networkStore.walletConnected ? (
        networkStore.minaNetwork?.networkID !=
          NETWORKS[NetworkIds.MINA_DEVNET].networkID && <WrongNetworkModal />
      ) : (
        <ConnectWalletModal />
      )}
    </GamePage>
  );
}
