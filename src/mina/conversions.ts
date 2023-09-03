import { Mina, Field, Encoding } from "snarkyjs";

function ipfsToFields(ipfs: string): Field[] | undefined {
  try {
    const fields: Field[] = Encoding.stringToFields(ipfs);
    if (fields.length !== 2)
      console.error(
        "ipfsToFields error, length is",
        fields.length,
        ipfs,
        fields,
      );
    console.log("ipfsToFields length", fields.length, ipfs);
    const restored = fieldsToIPFS(fields);
    console.log("Restored: ", restored);
    if (ipfs !== restored) {
      console.error(
        "ipfsToFields restore error, length is",
        fields.length,
        ipfs,
        fields,
      );
      return undefined;
    }
    return fields;
  } catch (error: any) {
    console.error("ipfsToFields error", error);
    return undefined;
  }
}

function fieldsToIPFS(fields: Field[]): string | undefined {
  try {
    if (fields.length !== 2)
      console.error("fieldsToIPFS error, length is", fields.length);
    return Encoding.stringFromFields(fields);
  } catch (error: any) {
    console.error("fieldsToIPFS error", error);
    return undefined;
  }
}

export { ipfsToFields, fieldsToIPFS };
