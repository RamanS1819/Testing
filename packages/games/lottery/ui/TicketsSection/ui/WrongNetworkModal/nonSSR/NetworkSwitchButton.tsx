import { useNetworkStore } from '@zknoid/sdk/lib/stores/network';
import {
  ALL_NETWORKS,
  Network,
  NetworkIds,
  NETWORKS,
} from '@zknoid/sdk/constants/networks';
import { requestAccounts, walletInstalled } from '@zknoid/sdk/lib/helpers';
import { useEffect } from 'react';

export default function NetworkSwitchButton() {
  const networkStore = useNetworkStore();

  const switchNetwork = async (network: Network) => {
    console.log('Switching to', network);
    if ((window as any).mina?.isPallad) {
      await (window as any).mina.request({
        method: 'mina_switchChain',
        params: {
          chainId: network.palladNetworkID,
        },
      });
    } else {
      try {
        await (window as any).mina.switchChain({
          networkID: network.networkID,
        });
        networkStore.setNetwork(network);
      } catch (e: any) {
        if (e?.code == 1001) {
          await requestAccounts();
          await switchNetwork(network);
        }
        throw e;
      }
    }
  };

  useEffect(() => {
    if (!walletInstalled()) return;

    (async () => {
      const listener = ({
        networkID,
        name,
      }: {
        networkID: string;
        name: string;
      }) => {
        const minaNetwork = ALL_NETWORKS.find((x) =>
          networkID != 'unknown' ? x.networkID == networkID : x.name == name
        );
        networkStore.setNetwork(minaNetwork);
      };

      ((window as any).mina as any).on('chainChanged', listener);

      return () => {
        ((window as any).mina as any).removeListener(listener);
      };
    })();
  }, [networkStore.walletConnected]);

  useEffect(() => {
    if (!walletInstalled()) return;

    (async () => {
      const listener = (accounts: string[]) => {
        console.log('Accounts changed', accounts);
        const [account] = accounts;
        if (networkStore.minaNetwork?.networkID)
          networkStore.setNetwork(networkStore.minaNetwork);
        networkStore.onWalletConnected(account);
      };

      ((window as any).mina as any).on('accountsChanged', listener);

      return () => {
        ((window as any).mina as any).removeListener(listener);
      };
    })();
  }, []);
  return (
    <button
      onClick={() => switchNetwork(NETWORKS[NetworkIds.MINA_DEVNET])}
      className={
        'w-full rounded-[0.26vw] bg-left-accent p-[0.5vw] text-center font-museo text-[0.833vw] font-medium text-bg-dark hover:opacity-80'
      }
    >
      Switch to Devnet
    </button>
  );
}
