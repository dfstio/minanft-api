import { BackendPlugin } from "minanft";
import { Cache, VerificationKey } from "o1js";
import { Mac } from "./Mac";

export class MacPlugin extends BackendPlugin {
  static verificationKey: VerificationKey | undefined = undefined;

  constructor(params: { name: string; task: string; args: string[] }) {
    super(params);
  }
  public async compile(cache: Cache): Promise<void> {
    if (MacPlugin.verificationKey === undefined)
      MacPlugin.verificationKey = (
        await Mac.compile({ cache })
      ).verificationKey;
    else console.log("verificationKey already exists");
  }

  public async create(transaction: string): Promise<string | undefined> {
    return MacPlugin.verificationKey?.hash.toJSON();
  }

  public async merge(
    proof1: string,
    proof2: string
  ): Promise<string | undefined> {
    throw new Error("not implemented");
  }

  public async verify(proof: string): Promise<string | undefined> {
    throw new Error("not implemented");
  }

  public async send(transaction: string): Promise<string | undefined> {
    throw new Error("not implemented");
  }

  public async mint(transaction: string): Promise<string | undefined> {
    throw new Error("not implemented");
  }
}
