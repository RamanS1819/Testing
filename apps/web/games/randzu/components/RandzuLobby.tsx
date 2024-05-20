import GamePage from '@/components/framework/GamePage';
import { randzuConfig } from '@/games/randzu/config';
import RandzuCoverSVG from '@/games/randzu/assets/game-cover.svg';
import RandzuCoverMobileSVG from '@/games/randzu/assets/game-cover-mobile.svg';
import { useContext, useEffect, useState } from 'react';
import AppChainClientContext from '@/lib/contexts/AppChainClientContext';
import { ClientAppChain, ProtoUInt64 } from 'zknoid-chain-dev';
import { useNetworkStore } from '@/lib/stores/network';
import LobbyPage from '@/components/framework/Lobby/LobbyPage';

export default function RandzuLobby({
  params,
}: {
  params: { lobbyId: string };
}) {
  const networkStore = useNetworkStore();
  useState<boolean>(false);

  const client = useContext(AppChainClientContext) as ClientAppChain<
    typeof randzuConfig.runtimeModules,
    any,
    any,
    any
  >;

  if (!client) {
    throw Error('Context app chain client is not set');
  }

  return (
    <GamePage
      gameConfig={randzuConfig}
      image={RandzuCoverSVG}
      mobileImage={RandzuCoverMobileSVG}
      defaultPage={'Lobby list'}
    >
      <LobbyPage
        lobbyId={params.lobbyId}
        query={client.query.runtime.RandzuLogic}
        contractName={'RandzuLogic'}
        config={randzuConfig}
      />
    </GamePage>
  );
}
