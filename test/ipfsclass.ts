import IPFS from "../src/nft/ipfs";
import { NFT_STORAGE_TOKEN } from "../env.json";

async function main() {
  const ipfs = new IPFS(NFT_STORAGE_TOKEN);

  //const cid1 = await ipfs.add({ hello: "world2" });
  //console.log("cid1", cid1);
  const cid2 = await ipfs.addLink(
    "https://minanft-storage.s3.eu-west-1.amazonaws.com/sky.jpeg",
  );

  console.log("cid2", cid2);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
