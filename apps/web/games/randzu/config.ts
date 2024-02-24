import { createZkNoidGameConfig } from "@/lib/createConfig";
import { RandzuLogic } from "zknoid-chain-dev";
import RandzuPage from "./components/RandzuPage";

export const randzuConfig =
    createZkNoidGameConfig({
        id: 'randzu',
        name: 'Randzu game',
        description: 'Two players take turns placing pieces on the board attempting to create lines of 5 of their own color',
        image: '/image/games/randzu.svg',
        runtimeModules: {
            RandzuLogic
        },
        page: RandzuPage,
    });