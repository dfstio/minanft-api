// import bip39 from 'bip39
import { Field } from "o1js";

function fieldToSeed(field: Field): string {
  // TODO - write code
  return "Pixels-Yellow-Panic-Portrait-Rogers-Assault-Dodge-Chips-Schemes-Suffer-Hundred-Talks";
}

function seedToField(seed: string): Field {
  // TODO - write code
  return Field(68637567654674355437857834);
}

export { fieldToSeed, seedToField };
