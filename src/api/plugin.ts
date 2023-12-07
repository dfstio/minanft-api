import { BackendPlugin } from "minanft";
import { MinaNFTTreeVerifierPlugin } from "./steptree";

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
      default:
        throw new Error("unknown plugin name");
    }
  } else throw new Error("unknown developer");
}
