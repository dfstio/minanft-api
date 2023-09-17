import { Field, Poseidon, MerkleMap, PublicKey } from "o1js";
import { createHash } from "node:crypto";

export default class Merkle {
  map: MerkleMap;
  salt: Field;

  constructor(salt: Field) {
    this.map = new MerkleMap();
    this.salt = salt;
  }

  public addString(name: string, value: string) {
    this.map.set(this.toHash(name), this.toHash(value));
  }

  public addNumber(name: string, value: number) {
    this.map.set(this.toHash(name), this.numberHash(value));
  }

  public addPublicKey(name: string, value: PublicKey) {
    const fields = value.toFields();
    let i: number;
    for (i = 0; i < fields.length; i++)
      this.map.set(
        this.toHash(name + i.toString()),
        Poseidon.hash([this.salt, fields[i]]),
      );
  }

  public root(): Field {
    return this.map.getRoot();
  }

  public numberHash(value: number): Field {
    return Poseidon.hash([this.salt, Field(value)]);
  }

  private toHash(str: string): Field {
    const sha256 = createHash("sha256");
    sha256.update(str);
    const data: Field = Field(sha256.digest().readBigUInt64BE()); //TODO: check readBigUInt64BE or LE
    const hash: Field = Poseidon.hash([this.salt, data]);
    console.log(`${str} hash: ${hash.toString()}`);
    return hash;
  }
}
