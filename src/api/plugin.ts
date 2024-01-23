import { BackendPlugin } from "minanft";
import { MinaNFTTreeVerifierPlugin } from "./steptree";
import { MinaNFTTreeVerifierPlugin20 } from "./steptree20";
import { RFCvoting } from "./rfc4";
import { MapProofPlugin } from "./map_proof";
import { MacPlugin } from "../external/Mac/plugin";

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
      case "map-proof":
        return new MapProofPlugin({ name, task, args });
      default:
        throw new Error("unknown plugin name");
    }
  } else if (developer === "@marek") {
    return new MacPlugin({ name, task, args });
  } else throw new Error("unknown developer");
}
