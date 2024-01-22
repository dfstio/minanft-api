import { initBlockchain, MinaNetwork, Berkeley } from "minanft";

export function minaInit(): MinaNetwork {
  return initBlockchain("berkeley");
}

export function explorerAccount(): string {
  return Berkeley.explorerAccountUrl!;
}

export function explorerTransaction(): string {
  return Berkeley.explorerTransactionUrl!;
}

export function chainId(): string {
  return Berkeley.chainId!;
}
