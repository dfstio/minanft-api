import { initBlockchain, MinaNetworkInstance, Devnet } from "minanft";

export function minaInit(): MinaNetworkInstance {
  return initBlockchain("devnet");
}

export function explorerAccount(): string {
  return Devnet.explorerAccountUrl!;
}

export function explorerTransaction(): string {
  return Devnet.explorerTransactionUrl!;
}

export function chainId(): string {
  return Devnet.chainId!;
}
