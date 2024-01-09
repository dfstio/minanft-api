import { FileData } from "minanft";
import { Field, Encoding, MerkleTree } from "o1js";
import S3File from "./s3";
import IPFS from "./ipfs";

export function convertIPFSFileData(uri: any): FileData {
  console.log("convertIPFSFileData", uri);
  /*
  const file = new S3File(process.env.BUCKET!, filename);
  const metadata = await file.metadata();
  if (metadata === undefined)
    throw new Error(`S3 error getting metadata for ${filename}`);
  const { size, mimeType } = metadata;
  console.time("Calculated SHA-3 512 hash");
  const hash = await file.sha3_512();
  console.timeEnd("Calculated SHA-3 512 hash");

  console.time("Calculated Merkle tree root");
  // const stream = await file.getStream();
  const { root, height, leavesNumber } = {
    root: Field(0),
    height: 0,
    leavesNumber: 0,
  };
  // = await treeData(stream);
  console.timeEnd("Calculated Merkle tree root");
  const ipfs = new IPFS(process.env.PINATA_JWT!);
  let cidImage = await ipfs.addLink(filename);
  if (cidImage === undefined)
    throw new Error(`IPFS error uploading ${filename}`);
  */
  return new FileData({
    fileRoot: Field(0),
    height: 0,
    size: uri.properties.image.size,
    mimeType: uri.properties.image.filetype,
    sha3_512:
      "WWZNIa5rjFnJkfjvdJAUX8uAEtMxuEPVpm3wL6rFCP75/ZlWpuK+JBGJaT3d/Ts/mQliw8v4OA5RXrXwBKfjaA==",
    filename: uri.properties.image.filename.substring(0, 30),
    storage: "i:" + uri.properties.image.IPFShash,
  });
}

export async function getFileData(
  id: string,
  filename: string
): Promise<FileData> {
  const key = id + "/" + filename;
  const file = new S3File(process.env.BUCKET!, key);
  const metadata = await file.metadata();
  if (metadata === undefined)
    throw new Error(`S3 error getting metadata for ${key}`);
  const { size, mimeType } = metadata;
  console.time("Calculated SHA-3 512 hash");
  const hash = await file.sha3_512();
  console.timeEnd("Calculated SHA-3 512 hash");

  console.time("Calculated Merkle tree root");
  // const stream = await file.getStream();
  const { root, height, leavesNumber } = {
    root: Field(0),
    height: 0,
    leavesNumber: 0,
  };
  // = await treeData(stream);
  console.timeEnd("Calculated Merkle tree root");
  const ipfs = new IPFS(process.env.PINATA_JWT!);
  let cidImage = await ipfs.addLink(key);
  if (cidImage === undefined)
    throw new Error(`IPFS error uploading ${filename}`);
  return new FileData({
    fileRoot: root,
    height,
    size,
    mimeType,
    sha3_512: hash,
    filename: "image.jpg",
    storage: "i:" + cidImage,
  });
}

async function treeData(stream: any): Promise<{
  root: Field;
  height: number;
  leavesNumber: number;
}> {
  const fields: Field[] = [];
  let remainder: Uint8Array = new Uint8Array(0);

  for await (const chunk of stream) {
    const bytes: Uint8Array = new Uint8Array(remainder.length + chunk.length);
    if (remainder.length > 0) bytes.set(remainder);
    bytes.set(chunk as Buffer, remainder.length);
    const chunkSize = Math.floor(bytes.length / 31) * 31;
    fields.push(...Encoding.bytesToFields(bytes.slice(0, chunkSize)));
    remainder = bytes.slice(chunkSize);
  }
  if (remainder.length > 0) fields.push(...Encoding.bytesToFields(remainder));

  const height = Math.ceil(Math.log2(fields.length + 2)) + 1;
  const tree = new MerkleTree(height);
  if (fields.length > tree.leafCount)
    throw new Error(`File is too big for this Merkle tree`);
  // First field is the height, second number is the number of fields
  tree.fill([Field.from(height), Field.from(fields.length), ...fields]);
  return { root: tree.getRoot(), height, leavesNumber: fields.length };
}
