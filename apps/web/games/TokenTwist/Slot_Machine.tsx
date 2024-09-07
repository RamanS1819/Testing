import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Field, PublicKey } from 'o1js';
import { UInt64 } from '@proto-kit/library';
import { useNetworkStore } from '@/lib/stores/network';
import { ClientAppChain, SlotMachine } from 'zknoid-chain-dev';
import GamePage from '@/components/framework/GamePage';
import { tokenTwistConfig } from './config';
import ZkNoidGameContext from '@/lib/contexts/ZkNoidGameContext';
import { useProtokitChainStore } from '@/lib/stores/protokitChain';
import CoverSVG from './assets/game-cover.svg';
import { DEFAULT_PARTICIPATION_FEE } from 'zknoid-chain-dev/dist/src/engine/LobbyManager';
import { motion } from 'framer-motion';
import Button from '@/components/shared/Button';
import { useNotificationStore } from '@/components/shared/Notification/lib/notificationStore';
import Rules from './components/Rules';
import HowToPlay from './components/HowToPlay';
import BetControl from './components/BetControl';
import { useMinaBalancesStore } from '@/lib/stores/minaBalances';
import { useProtokitBalancesStore } from '@/lib/stores/protokitBalances';

const SYMBOLS = ['💲', '₿', '💰'];
const ICON_HEIGHT = 100;
const NUM_ICONS = SYMBOLS.length;
const TIME_PER_ICON = 100;

interface ReelProps {
  spinning: boolean;
  finalSymbol?: string;
  onSpinComplete: () => void;
}

const Reel: React.FC<ReelProps> = ({ 
  spinning, 
  finalSymbol, 
  onSpinComplete 
}) => {
  const reelRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (spinning) {
      const delta = 2 * NUM_ICONS + Math.round(Math.random() * NUM_ICONS);
      const duration = (8 + delta) * TIME_PER_ICON;

      setOffset((prev) => prev + delta * ICON_HEIGHT);

      setTimeout(() => {
        if (reelRef.current) {
          reelRef.current.style.transition = `transform ${duration}ms cubic-bezier(.41,-0.01,.63,1.09)`;
          reelRef.current.style.transform = `translateY(${-(offset + delta * ICON_HEIGHT)}px)`;
        }
      }, 0);

      setTimeout(() => {
        if (reelRef.current) {
          reelRef.current.style.transition = 'none';
          reelRef.current.style.transform = `translateY(${-((offset + delta * ICON_HEIGHT) % (NUM_ICONS * ICON_HEIGHT))}px)`;
        }
        onSpinComplete();
      }, duration);
    }
  }, [spinning]);

  return (
    <div className="reel relative h-[300px] w-[100px] overflow-hidden rounded-md border border-black/30 bg-gray-800">
      <div 
        ref={reelRef}
        className="absolute left-0 top-0 w-full"
        style={{ transform: `translateY(${-offset}px)` }}
      >
        {[...SYMBOLS, ...SYMBOLS, ...SYMBOLS].map((symbol, index) => (
          <div 
            key={index} 
            className="h-[100px] flex items-center justify-center text-6xl"
          >
            {symbol}
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/40 "></div>
    </div>
  );
};

const competition = {
  id: 'global',
  name: 'Global competition',
  enteringPrice: BigInt(+DEFAULT_PARTICIPATION_FEE.toString()),
  prizeFund: 0n,
};

export default function Slot_Machine({
  params,
}: {
  params: { competitionId: string };
}) {
  const minaBalancesStore = useMinaBalancesStore();
  const protokitBalancesStore = useProtokitBalancesStore();

  const [gameBalance, setGameBalance] = useState('0');
  const [bet, setBet] = useState<bigint>(1n * 10n ** 9n);
  const [jackpot, setJackpot] = useState('0');
  const [spinning, setSpinning] = useState(false);
  const [reels, setReels] = useState([0, 0, 0]);
  const [slotMachine, setSlotMachine] = useState<SlotMachine | null>(null);
  const [spinCompleteCount, setSpinCompleteCount] = useState(0);
  const [gameResult, setGameResult] = useState<string | null>(null);
  const [pendingSpin, setPendingSpin] = useState(false);
  const [spinTransactionId, setSpinTransactionId] = useState<string | null>(null);
  const [betPlaced, setBetPlaced] = useState(false);
  const [betTransactionId, setBetTransactionId] = useState<string | null>(null);

  const { client } = useContext(ZkNoidGameContext);

  if (!client) {
    throw Error('Context app chain client is not set');
  }

  const networkStore = useNetworkStore();
  const protokitChain = useProtokitChainStore();
  const notificationStore = useNotificationStore();

  const clientAppChain = client as ClientAppChain<
    typeof tokenTwistConfig.runtimeModules,
    any,
    any,
    any
  >;

  const query = networkStore.protokitClientStarted
    ? clientAppChain.query.runtime.SlotMachine
    : undefined;

  useEffect(() => {
    if (!networkStore.protokitClientStarted) return;

    const slotMachine_ = client.runtime.resolve('SlotMachine');
    setSlotMachine(slotMachine_);
  }, [networkStore.protokitClientStarted]);
    
  const fetchGameBalance = async () => {
    if (!query || !networkStore.address) return;
    try {
      const balance =
        await protokitBalancesStore.balances[networkStore.address!];
        if (balance) setGameBalance(balance.toString());
        console.log('Game balance:', balance);
    } catch (error) {
      console.error('Error fetching game balance:', error);
      notificationStore.create({
        type: 'error',
        message: 'Failed to fetch game balance. Please try again.',
      });
    }
  };

  const fetchJackpot = async () => {
    if (!slotMachine) return;
    try {
      const jackpot = await query?.jackpot.get();
      if (jackpot) setJackpot(jackpot.toString());
    } catch (error) {
      console.error('Error fetching jackpot:', error);
      notificationStore.create({
        type: 'error',
        message: 'Failed to fetch jackpot. Please try again.',
      });
    }
  };

  const handlePlaceBet = async () => {
    if (!slotMachine || !client) {
      notificationStore.create({
        type: 'error',
        message: 'Slot Machine not initialized. Please refresh and try again.',
      });
      return;
    }
    
    const currentBalance = BigInt(gameBalance);
    const currentBet = BigInt(bet);

    if (currentBalance < currentBet) {
      notificationStore.create({
        type: 'error',
        message: 'Insufficient balance for this bet.',
      });
      return;
    }

    try {
      const tx = await client.transaction(
        PublicKey.fromBase58(networkStore.address!),
        async () => {
          await slotMachine.spin(UInt64.from(BigInt(bet)));
        }
      );
  
      await tx.sign();
      await tx.send();

      // Call the spin method
      // const { transactionId } = await slotMachine.spin(UInt64.from(bet));
      // console.log('Bet Transaction ID:', transactionId.toString());

      setBetPlaced(true);
      // setBetTransactionId();

      // Update game balance and jackpot immediately after placing bet
      // await fetchGameBalance();
      // await fetchJackpot();

      notificationStore.create({
        type: 'success',
        message: 'Bet placed successfully!',
      });
    } catch (error) {
      console.error('Error placing bet:', error);
      notificationStore.create({
        type: 'error',
        message: 'Error placing bet! Please try again.',
      });
    }
  };

  const handleSpin = async () => {
    if (!betPlaced) {
      notificationStore.create({
        type: 'error',
        message: 'Please place a bet before spinning.',
      });
      return;
    }

    setSpinning(true);
    setSpinCompleteCount(0);
    setGameResult(null);

    try {
      // Start the visual spinning animation with random symbols
      // setReels([
      //   Math.floor(Math.random() * 3),
      //   Math.floor(Math.random() * 3),
      //   Math.floor(Math.random() * 3)
      // ]);

      const reelResult = await slotMachine!.spin(UInt64.from(bet));
      // console.log('Reel Result:', reelResult.toString());
      console.log('Reel 1', reelResult.reel1);
      console.log('Reel 2', reelResult.reel2);
      console.log('Reel 3', reelResult.reel3);

      // Simulate waiting for on-chain result
      setTimeout(async () => {
        if (!slotMachine || !networkStore.address) return;

        try {
          // Fetch the last spin result from the chain
          const lastSpin = await query?.lastSpins.get(
            PublicKey.fromBase58(networkStore.address)
          );

          if (lastSpin) {
            console.log('Raw spin result:', lastSpin.toString());
            const spinResult = lastSpin.toBigInt();
    
            const reel1 = Number(spinResult / 90n);
            const reel2 = Number((spinResult / 3n) % 3n);
            const reel3 = Number(spinResult % 3n);
            
            console.log('Processed spin result:', { reel1, reel2, reel3 });
            setReels([reel1, reel2, reel3]);
    
            // Check for win condition
            const isWin = reel1 === reel2 && reel2 === reel3;
            
            if (isWin) {
              setGameResult('Congratulations! You won!');
            } else {
              setGameResult('You lost. Try again!');
            }
    
            // fetchGameBalance();
            // fetchJackpot();
          } else {
            throw new Error('Failed to fetch spin result');
          }
        } catch (error) {
          console.error('Error fetching spin result:', error);
          notificationStore.create({
            type: 'error',
            message: 'Error fetching spin result. Please try again.',
          });
        } finally {
          setSpinning(false);
          setBetPlaced(false);
          setBetTransactionId(null);
        }
      }, 3000); // Adjust this delay as needed
    } catch (error) {
      console.error('Error spinning:', error);
      notificationStore.create({
        type: 'error',
        message: 'Error spinning the slot machine! Please try again.',
      });
      setSpinning(false);
    }
  };


  const handleSpinComplete = () => {
    setSpinCompleteCount((prev) => prev + 1);
  };

  useEffect(() => {
    fetchGameBalance();
    fetchJackpot();
  }, [protokitChain.block, slotMachine, betTransactionId]);

  return (
    <GamePage
      gameConfig={tokenTwistConfig}
      image={CoverSVG}
      mobileImage={CoverSVG}
      defaultPage={'Game'}
    >
      <div className="item-center mb-4 flex justify-between">
        <div className="flex gap-4">
          <p className="text-2xl text-left-accent">
            Auro Balance: $
            {(
              Number(minaBalancesStore.balances[networkStore.address!] ?? 0) /
              10 ** 9
            ).toFixed(2)}{' '}
          </p>
          <p className="text-2xl text-left-accent">
          Game Balance: ${(Number(gameBalance) / 10 ** 9).toFixed(2)} Znakes
          </p>
          <p className="text-2xl text-left-accent">
            Jackpot: ${(Number(jackpot) / 10 ** 9).toFixed(2)} Znakes
          </p>
        </div>
        <div className="flex gap-2">
          <Rules />
          <HowToPlay />
        </div>
      </div>

      <div className="mt-0 flex gap-8 ">
        {/* Left Column */}
        <motion.div
          className="flex w-2/3 flex-col items-center justify-center gap-2 rounded-lg border border-left-accent p-4 pt-6"
          animate={'windowed'}
        >
          <div className="flex gap-4 rounded-lg bg-gradient-to-b from-gray-700 to-gray-900 p-4  shadow-inner">
            {[0, 1, 2].map((index) => (
              <Reel 
                key={index} 
                spinning={spinning} 
                finalSymbol={SYMBOLS[reels[index]]} 
                onSpinComplete={handleSpinComplete}
              />
            ))}
          </div>
          
          <div className='flex gap-6'>
            <span className='mt-4'>
              <BetControl bet={bet} setBet={setBet} spinning={spinning} />
            </span> 

            <Button
              label={betPlaced ? 'Bet Placed' : 'Place Bet'}
              onClick={handlePlaceBet}
              disabled={spinning || betPlaced}
              className="mt-4 rounded-full p-4 px-6 text-2xl text-black"
            />

            <Button
              label={spinning ? 'Spinning...' : 'Spin'}
              onClick={handleSpin}
              disabled={spinning || !betPlaced}
              className="mt-4 rounded-full p-4 px-6 text-2xl text-black"
            />
          </div>

          {gameResult && (
            <div 
              className={`mt-4 text-2xl ${gameResult.includes('won') ? 'text-green-500' : 'text-red-500'}`}
            >
              {gameResult}
            </div>
          )}
        </motion.div>

        {/* Right Column */}
        <div className="w-1/3 rounded-lg border border-left-accent p-4 ">  
          <h2 className="text-xl text-left-accent ">Additional Content</h2>
          <p className="text-left-accent">
            Here you can display additional information or features related to 
            your game or slot machine.
          </p>
        </div>
      </div>
    </GamePage>
  );
};

