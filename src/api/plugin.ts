type ContractType = "ZkProgram" | "SmartContract";
import type { Cache, VerificationKey } from "o1js";

abstract class BackendPlugin {
  name: string;
  contractType: ContractType;

  constructor(params: { name: string; contractType: ContractType }) {
    const { name, contractType } = params;
    this.name = name;
    this.contractType = contractType;
  }

  abstract compile(
    cache: Cache,
    task: string,
    args: string[]
  ): Promise<VerificationKey[] | undefined>;
  abstract create(
    transaction: string,
    task: string,
    args: string[]
  ): Promise<string | undefined>;
  abstract merge(
    proof1: string,
    proof2: string,
    task: string,
    args: string[]
  ): Promise<string | undefined>;
}
