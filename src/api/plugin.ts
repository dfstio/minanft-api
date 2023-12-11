import { BackendPlugin } from "minanft";
import { MinaNFTTreeVerifierPlugin } from "./steptree";
import { MinaNFTTreeVerifierPlugin20 } from "./steptree20";
import { RFCvoting } from "./rfc4";

export async function getBackupPlugin(params: {
  developer: string;
  name: string;
  task: string;
  args: string[];
}): Promise<BackendPlugin> {
  const { developer, name, task, args } = params;
  if (developer === "@dfst") {
    switch (name) {
      case "tree":
        return new MinaNFTTreeVerifierPlugin({ name, task, args });
      case "tree20":
        return new MinaNFTTreeVerifierPlugin20({ name, task, args });
      case "rfc-voting":
        return new RFCvoting({ name, task, args });
      default:
        throw new Error("unknown plugin name");
    }
  } else throw new Error("unknown developer");
}
