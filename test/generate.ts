import {
  Mina,
  PrivateKey,
  PublicKey,
  isReady,
  Field,
  fetchAccount,
  fetchTransactionStatus,
  TransactionStatus,
  shutdown,
  AccountUpdate,
  SmartContract,
  state,
  State,
  method,
  Signature,
  UInt64,
  DeployArgs,
  Permissions,
  Poseidon,
  Proof,
  MerkleTree,
  MerkleMapWitness,
  Encoding,
  MerkleWitness,
  SelfProof,
  Experimental,
  verify,
  MerkleMap,
} from "o1js";
import {
  MINAURL,
  MINAEXPLORER,
  MINAFEE,
  NFT_SALT,
  NFT_SECRET,
} from "../env.json";

async function minaInit() {
  await isReady;
  const Network = Mina.Network(MINAURL);
  await Mina.setActiveInstance(Network);
}

function calculateMerkleTreeHeight(n: number): number {
  // We'll use the Math.log2 function to calculate the log base 2 of n,
  // and Math.ceil to round up to the nearest integer
  const result: number = Math.ceil(Math.log2(n)) + 1;
  return result < 2 ? 2 : result;
}

const text = `You are a highly advanced AI model, DALL·E, capable of generating unique images from text descriptions. Based on the user's request, please generate a detailed and creative description that will inspire you to create a compelling and imaginative image. Utilize your understanding of Carl Jung's theory of archetypes to craft an image description that will profoundly connect with the user's emotions and intellect. The maximum size of the description should be strictly 1000 characters. Do not provide a description exceeding 1000 characters. The image will be used as the user's NFT.`;
const sanitizedText = `You are a highly advanced AI model, XXXXXX, capable of generating unique images from text descriptions. Based on the user's request, please generate a detailed and creative description that will inspire you to create a compelling and imaginative image. Utilize your understanding of Carl Jung's theory of archetypes to craft an image description that will profoundly connect with the user's emotions and intellect. The maximum size of the description should be strictly 1000 characters. Do not provide a description exceeding 1000 characters. The image will be used as the user's NFT.`;
const filename = "test.txt";

async function main() {
  await minaInit();

  const height: number = calculateMerkleTreeHeight(text.length);
  if (height > 32) {
    console.error("File is too big");
    return;
  }
  const tree: MerkleTree = new MerkleTree(height);
  let i: number;
  let textFields: Field[] = [];

  console.error("Preparing proof...", text.length, "height", height);
  const startTime = Date.now();

  for (i = 0; i < text.length; i++)
    textFields.push(Encoding.stringToFields(text.substr(i, 1))[0]);
  await tree.fill(textFields);
  const root: Field = tree.getRoot();

  const map: MerkleMap = new MerkleMap();
  const fieldFilename: Field = Encoding.stringToFields(filename)[0];
  const fieldHeight: Field = Encoding.stringToFields(`H/${filename}`)[0];
  map.set(fieldFilename, root);
  map.set(fieldHeight, Field(height));
  const mapWitnessFlename: MerkleMapWitness = map.getWitness(fieldFilename);
  const mapWitnessHeight: MerkleMapWitness = map.getWitness(fieldHeight);

  let wa = [];
  for (i = 0; i < text.length; i++) {
    let wt: any;
    if (sanitizedText.substr(i, 1) !== "X")
      wt = await tree.getWitness(BigInt(i));
    else wt = [{ isLeft: false, sibling: "" }];
    wa.push(wt);
  }
  const endTime = Date.now();
  const delay = formatWinstonTime(endTime - startTime);
  console.error(
    "Took",
    delay,
    "or ",
    formatWinstonTime((endTime - startTime) / text.length),
    "per char",
  );

  const proof: any = {
    name: "@john",
    filename,
    map: {
      root: map.getRoot(),
      witnessFlename: mapWitnessFlename.toJSON(),
      witnessHeight: mapWitnessHeight.toJSON(),
    },
    height,
    root: Field.toJSON(root),
    sanitizedText,
    witnesses: wa,
  };

  const writeData = JSON.stringify(proof, (_, v) =>
    typeof v === "bigint" ? v.toString() : v,
  )
    .replaceAll("},", "},\n")
    .replaceAll("[", "[\n")
    .replaceAll("]", "\n]");
  console.log(writeData);

  await shutdown();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatWinstonTime(ms: number): string {
  if (ms === undefined) return "";
  if (ms < 1000) return ms.toString() + " ms";
  if (ms < 60 * 1000)
    return parseInt((ms / 1000).toString()).toString() + " sec";
  if (ms < 60 * 60 * 1000)
    return parseInt((ms / 1000 / 60).toString()).toString() + " min";
  return parseInt((ms / 1000 / 60 / 60).toString()).toString() + " h";
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

//zkAppPrivateKey EKEuXCfveWYbu1feMMUzuNyuxsyki22TEySgzzD4tPdxMkevGaSC
//zkAppAddress B62qrgQizVm4k8YTyQgoTfLKBJ2MYcUo3RyZ7xVkq1tEi7w1rSF3H39
// B62qrgQizVm4k8YTyQgoTfLKBJ2MYcUo3RyZ7xVkq1tEi7w1rSF3H39

// privateKey: 'EKEjdi6KegtBmsJxv8fhu4Jj3aTwER6n3nZpfpqWubMrNEPq1dsr',
//  publicKey: 'B62qrFqrkQKzjyJheobKqYCZULAhWwx58NPDgT5yBjfofdAJQiFNWn2',
//  explorer: 'https://berkeley.minaexplorer.com/wallet/B62qrFqrkQKzjyJheobKqYCZULAhWwx58NPDgT5yBjfofdAJQiFNWn2'
