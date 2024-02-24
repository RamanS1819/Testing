import {
  RuntimeModulesRecord,
} from "@proto-kit/module";
import { ClientAppChain } from 'zknoid-chain-dev';
import { createStore } from "zustand";

export type ZkNoidGameConfig<RuntimeModules extends RuntimeModulesRecord = RuntimeModulesRecord
> = {
  id: string,
  name: string,
  description: string,
  image: string,
  runtimeModules: RuntimeModules,
  page: ({ params, }: { params: { competitionId: string; }; }) => React.ReactNode
  pageCompetitionsList?: () => React.ReactNode,
  pageNewCompetition?: () => React.ReactNode,
}

export function createZkNoidGameConfig<RuntimeModules extends RuntimeModulesRecord>(params: {
  id: string,
  name: string,
  description: string,
  image: string,
  runtimeModules: RuntimeModules,
  page: ({ params, }: { params: { competitionId: string; }; }) => React.ReactNode,
  pageCompetitionsList?: () => React.ReactNode,
  pageNewCompetition?: () => React.ReactNode,

}): ZkNoidGameConfig<RuntimeModules> {
  return params
}

export type Evaluate<type> = { [key in keyof type]: type[key] } & unknown;

export type ZkNoidConfig<
  games extends readonly [ZkNoidGameConfig, ...ZkNoidGameConfig[]] = readonly [ZkNoidGameConfig, ...ZkNoidGameConfig[]],
> = {
  readonly games: games;
  getClient(): ClientAppChain<games[number]['runtimeModules']>
}

export type CreateConfigParameters<games extends readonly [ZkNoidGameConfig, ...ZkNoidGameConfig[]]> = Evaluate<{
  games: games
}>;

export function createConfig<
  const games extends readonly [ZkNoidGameConfig, ...ZkNoidGameConfig[]]
>(parameters: CreateConfigParameters<games>): ZkNoidConfig<games> {
  const games = createStore(() => parameters.games);

  return {
    get games() {
      return games.getState();
    },
    getClient() {
      const gameModules = games.getState().map(x => x.runtimeModules);
      const modules = Object.assign({}, ...gameModules);

      console.log('Loaded modules', modules);

      const client = ClientAppChain.fromRuntime({
        modules,
      });

      client.configure({
        Runtime: {
          ArkanoidGameHub: {},
          Balances: {},
          RandzuLogic: {}
        }
      });

      client.configurePartial({
        GraphqlClient: {
          url: process.env.NEXT_PUBLIC_PROTOKIT_URL || "http://127.0.0.1:8080/graphql",
        },
      })

      return client;
    },
  }
}