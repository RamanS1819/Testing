import { ClientAppChain } from "@proto-kit/sdk";
import { createContext } from "react";

const AppChainClientContext = createContext<ClientAppChain<any> | undefined>(
    undefined
  );
  

export default AppChainClientContext;