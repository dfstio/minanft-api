import {
  Field,
  SmartContract,
  state,
  State,
  method,
  Signature,
  PublicKey,
  UInt64,
  DeployArgs,
  Permissions,
  Poseidon,
} from "o1js";

//const NFT_SALT = process.env.NFT_SALT!;
//const NFT_SECRET = process.env.NFT_SECRET!;

export class AvatarNFT extends SmartContract {
  @state(Field) username = State<Field>();
  @state(Field) publicMapRoot = State<Field>(); // Merkle root of public key-values Map
  @state(Field) publicFilesRoot = State<Field>(); // Merkle root of public Files Map
  @state(Field) privateMapRoot = State<Field>(); // Merkle root of private key-values Map
  @state(Field) privateFilesRoot = State<Field>(); // Merkle root of private Files Map
  //@state(Field) postsRoot = State<Field>(); // Merkle root of posts
  @state(Field) uri1 = State<Field>(); // First part of uri IPFS hash
  @state(Field) uri2 = State<Field>(); // Second part of uri IPFS hash
  @state(Field) pwdHash = State<Field>(); // Hash of password used to prove transactions
  //@state(Field) version = State<Field>(); // Version of state

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.setPermissions({
      ...Permissions.default(),
      setDelegate: Permissions.proof(),
      setPermissions: Permissions.proof(),
      setVerificationKey: Permissions.proof(),
      setZkappUri: Permissions.proof(),
      setTokenSymbol: Permissions.proof(),
      incrementNonce: Permissions.proof(),
      setVotingFor: Permissions.proof(),
      setTiming: Permissions.proof(),
    });
  }

  @method init() {
    this.account.provedState.assertEquals(this.account.provedState.get());
    this.account.provedState.get().assertFalse();

    super.init();
  }

  // Create NFT on the MINA blockchain

  @method createNFT(
    username: Field,
    publicMapRoot: Field,
    publicFilesRoot: Field,
    privateMapRoot: Field,
    privateFilesRoot: Field,
    uri1: Field,
    uri2: Field,
    salt: Field,
    secret: Field,
  ) {
    this.account.provedState.assertEquals(this.account.provedState.get());
    this.account.provedState.get().assertTrue();

    const usernameOld = this.username.get();
    this.username.assertEquals(usernameOld);
    this.username.assertEquals(Field(0));

    const pwdHash = this.pwdHash.get();
    this.pwdHash.assertEquals(pwdHash);
    this.pwdHash.assertEquals(Field(0));

    const publicMapRootOld = this.publicMapRoot.get();
    this.publicMapRoot.assertEquals(publicMapRootOld);
    this.publicMapRoot.assertEquals(Field(0));

    const publicFilesRootOld = this.publicFilesRoot.get();
    this.publicFilesRoot.assertEquals(publicFilesRootOld);
    this.publicFilesRoot.assertEquals(Field(0));

    const privateMapRootOld = this.privateMapRoot.get();
    this.privateMapRoot.assertEquals(privateMapRootOld);
    this.privateMapRoot.assertEquals(Field(0));

    const privateFilesRootOld = this.privateFilesRoot.get();
    this.privateFilesRoot.assertEquals(privateFilesRootOld);
    this.privateFilesRoot.assertEquals(Field(0));

    const uri1Old = this.uri1.get();
    this.uri1.assertEquals(uri1Old);
    this.uri1.assertEquals(Field(0));

    const uri2Old = this.uri2.get();
    this.uri2.assertEquals(uri2Old);
    this.uri2.assertEquals(Field(0));

    this.username.set(username);
    this.publicMapRoot.set(publicMapRoot);
    this.publicFilesRoot.set(publicFilesRoot);
    this.privateMapRoot.set(privateMapRoot);
    this.privateFilesRoot.set(privateFilesRoot);
    this.uri1.set(uri1);
    this.uri2.set(uri2);
    this.pwdHash.set(Poseidon.hash([salt, secret]));
  }

  // Make a post - TODO rewrite using new merkle roots structure
  /*
    @method post(salt: Field, secret: Field, postsRoot: Field) {
        this.account.provedState.assertEquals(this.account.provedState.get());
        this.account.provedState.get().assertTrue();

        const pwdHash = this.pwdHash.get();
        this.pwdHash.assertEquals(pwdHash);
        this.pwdHash.assertEquals(Poseidon.hash([salt, secret]));

        // TODO add checks and proofs
        this.postsRoot.set(postsRoot);
    }
    */

  // Change password
  @method changePassword(salt: Field, secret: Field, newsecret: Field) {
    this.account.provedState.assertEquals(this.account.provedState.get());
    this.account.provedState.get().assertTrue();

    const pwdHash = this.pwdHash.get();
    this.pwdHash.assertEquals(pwdHash);
    this.pwdHash.assertEquals(Poseidon.hash([salt, secret]));

    this.pwdHash.set(Poseidon.hash([salt, newsecret]));
  }

  // TODO: write using Merkle Map proof, root, key and value
  @method setPublicKeyValue() {
    this.account.provedState.assertEquals(this.account.provedState.get());
    this.account.provedState.get().assertTrue();
  }

  // TODO: write using Merkle Map proof, root, key and value
  @method setPublicFile() {
    this.account.provedState.assertEquals(this.account.provedState.get());
    this.account.provedState.get().assertTrue();
  }

  // TODO: write using Merkle Map proof, root, key and value
  @method setPrivateKeyValue() {
    this.account.provedState.assertEquals(this.account.provedState.get());
    this.account.provedState.get().assertTrue();
  }

  // TODO: write using Merkle Map proof, root, key and value
  @method setPrivateFile() {
    this.account.provedState.assertEquals(this.account.provedState.get());
    this.account.provedState.get().assertTrue();
  }

  // TODO: write using Merkle Map proof, root, key and value
  @method checkPublicKeyValue() {
    this.account.provedState.assertEquals(this.account.provedState.get());
    this.account.provedState.get().assertTrue();
  }

  // TODO: write using Merkle Map proof, root, key and value
  @method checkPrivateKeyValue() {
    this.account.provedState.assertEquals(this.account.provedState.get());
    this.account.provedState.get().assertTrue();
  }

  // TODO: write using Merkle Map proof, root, key and value
  @method checkPublicFile() {
    this.account.provedState.assertEquals(this.account.provedState.get());
    this.account.provedState.get().assertTrue();
  }

  // TODO: write using Merkle Map proof, root, key and value
  @method checkPrivateFile() {
    this.account.provedState.assertEquals(this.account.provedState.get());
    this.account.provedState.get().assertTrue();
  }

  /*
    // put NFT to escrow before the transfer in case NFT is sold for fiat money
    // TODO - rewrite using privateMapRoot
    @method toEscrow(secret: Field, escrowhash: Field) {
        this.account.provedState.assertEquals(this.account.provedState.get());
        this.account.provedState.get().assertTrue();

        const pwd = this.pwd.get();
        this.pwd.assertEquals(pwd);
        this.pwd.assertEquals(
            Poseidon.hash([Field.fromJSON(NFT_SALT), secret]),
        );

        const nonce = this.nonce.get();
        this.nonce.assertEquals(nonce);
        this.nonce.set(nonce.add(Field(1)));

        this.escrow.assertEquals(Field(0));
        this.escrow.set(escrowhash);
    }

    // get NFT from escrow in case NFT is sold for fiat money
    @method fromEscrow(newsecret: Field, escrowSecret: Field) {
        this.account.provedState.assertEquals(this.account.provedState.get());
        this.account.provedState.get().assertTrue();

        const escrow = this.escrow.get();
        this.escrow.assertEquals(escrow);
        this.escrow.assertEquals(
            Poseidon.hash([Field.fromJSON(NFT_SALT), escrowSecret]),
        );

        const nonce = this.nonce.get();
        this.nonce.assertEquals(nonce);
        this.nonce.set(nonce.add(Field(1)));

        this.pwd.set(Poseidon.hash([Field.fromJSON(NFT_SALT), newsecret]));
    }

    // Change username - TODO - rewrite using salt and secret
    @method changeUsername(secret: Field, username: Field) {
        this.account.provedState.assertEquals(this.account.provedState.get());
        this.account.provedState.get().assertTrue();

        const pwd = this.pwd.get();
        this.pwd.assertEquals(pwd);
        this.pwd.assertEquals(
            Poseidon.hash([Field.fromJSON(NFT_SALT), secret]),
        );

        const nonce = this.nonce.get();
        this.nonce.assertEquals(nonce);
        this.nonce.set(nonce.add(Field(1)));

        this.username.set(username);
    }
*/
}
