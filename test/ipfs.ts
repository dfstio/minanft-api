/*
import { NFTStorage, Blob } from "nft.storage";
import { NFT_STORAGE_TOKEN } from "../env.json";
import fs from "fs";
import axios from "axios";

async function add(file: any): Promise<string> {
  const client = new NFTStorage({ token: NFT_STORAGE_TOKEN });

  const someData = new Blob([JSON.stringify(file)]);
  const cid = await client.storeBlob(someData);
  return cid;
}

async function addFile(file: any) {
  const storage = new NFTStorage({ token: NFT_STORAGE_TOKEN });
  const data = await fs.promises.readFile("./a.png");
  const { cid, car } = await NFTStorage.encodeBlob(new Blob([data]));
  console.log(`File CID: ${cid}`);
  console.log("Sending file...");
  await storage.storeCar(car, {
    onStoredChunk: (size) => console.log(`Stored a chunk of ${size} bytes`),
  });

  console.log("✅ Done");
}

async function addLink(file: any): Promise<string> {
  const storage = new NFTStorage({ token: NFT_STORAGE_TOKEN });
  let responce = await axios.get(file, {
    responseType: "arraybuffer",
  });

  const data = Buffer.from(responce.data, "binary");
  const { cid, car } = await NFTStorage.encodeBlob(new Blob([data]));
  console.log(`File CID: https://ipfs.io/ipfs/${cid}`);
  console.log("Sending file...");

  await storage.storeCar(car, {
    onStoredChunk: (size) => console.log(`Stored a chunk of ${size} bytes`),
  });
  return `https://ipfs.io/ipfs/${cid}`;
}

async function main() {
  //const cid = await add({ hello: 'world1' })
  const cid = await addLink(
    "https://minanft-storage.s3.eu-west-1.amazonaws.com/sky.jpeg",
  );

  console.log("cid", cid, "\nurl:\n", "https://ipfs.io/ipfs/" + cid);
}



// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

*/
