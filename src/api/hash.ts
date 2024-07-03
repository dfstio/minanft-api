import crypto from "crypto";
import { makeString } from "minanft";

export function generateId(params: {
  username: string;
  timeCreated: number;
}): string {
  const { username, timeCreated } = params;
  return (
    "zkNFT" +
    stringHash(
      JSON.stringify({
        username,
        timeCreated,
        salt: makeString(32),
      })
    )
  );
}
function stringHash(jsonString: string): string {
  if (typeof jsonString !== "string")
    throw new Error("stringHash: input must be a string");
  return bigintToBase56(
    BigInt("0x" + crypto.createHash("sha256").update(jsonString).digest("hex"))
  );
}

const TABLE =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function bigintToBase56(value: bigint): string {
  const digits = toBase(value, 56n);
  //console.log("digits:", digits);
  const str = digits.map((x) => TABLE[Number(x)]).join("");
  //console.log("str:", str);
  return str;
}

function toBase(x: bigint, base: bigint) {
  if (base <= 0n) throw Error("toBase: base must be positive");
  // compute powers base, base^2, base^4, ..., base^(2^k)
  // with largest k s.t. base^(2^k) < x
  let basePowers = [];
  for (let power = base; power <= x; power **= 2n) {
    basePowers.push(power);
  }
  let digits = [x]; // single digit w.r.t base^(2^(k+1))
  // successively split digits w.r.t. base^(2^j) into digits w.r.t. base^(2^(j-1))
  // until we arrive at digits w.r.t. base
  let k = basePowers.length;
  for (let i = 0; i < k; i++) {
    let newDigits = Array(2 * digits.length);
    let basePower = basePowers[k - 1 - i];
    for (let j = 0; j < digits.length; j++) {
      let x = digits[j];
      let high = x / basePower;
      newDigits[2 * j + 1] = high;
      newDigits[2 * j] = x - high * basePower;
    }
    digits = newDigits;
  }
  // pop "leading" zero digits
  while (digits[digits.length - 1] === 0n) {
    digits.pop();
  }
  return digits;
}
