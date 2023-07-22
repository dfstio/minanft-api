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
} from "snarkyjs";

const NFT_SALT = process.env.NFT_SALT!;
const NFT_SECRET = process.env.NFT_SECRET!;

export class AvatarNFT extends SmartContract {
    @state(Field) username = State<Field>();
    @state(Field) uri1 = State<Field>();
    @state(Field) uri2 = State<Field>();
    @state(Field) posturi1 = State<Field>();
    @state(Field) posturi2 = State<Field>();
    @state(Field) pwd = State<Field>();
    @state(Field) escrow = State<Field>();
    @state(Field) nonce = State<Field>();

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

        this.pwd.set(
            Poseidon.hash([
                Field.fromJSON(NFT_SALT),
                Field.fromJSON(NFT_SECRET),
            ]),
        );
    }

    // Create NFT on the MINA blockchain

    @method createNFT(
        secret: Field,
        newsecret: Field,
        username: Field,
        uri1: Field,
        uri2: Field,
    ) {
        this.account.provedState.assertEquals(this.account.provedState.get());
        this.account.provedState.get().assertTrue();

        const pwd = this.pwd.get();
        this.pwd.assertEquals(pwd);
        this.pwd.assertEquals(
            Poseidon.hash([Field.fromJSON(NFT_SALT), secret]),
        );

        const nonce = this.nonce.get();
        this.nonce.assertEquals(nonce);
        this.nonce.assertEquals(Field(0));
        this.nonce.set(nonce.add(Field(1)));

        this.pwd.set(Poseidon.hash([Field.fromJSON(NFT_SALT), newsecret]));
        this.username.set(username);
        this.uri1.set(uri1);
        this.uri2.set(uri2);
        this.posturi1.set(Field(0));
        this.posturi2.set(Field(0));
    }

    // Make a post
    @method post(secret: Field, posturi1: Field, posturi2: Field) {
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

        this.posturi1.set(posturi1);
        this.posturi2.set(posturi2);
    }

    // Change password
    @method changePassword(secret: Field, newsecret: Field) {
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

        this.pwd.set(Poseidon.hash([Field.fromJSON(NFT_SALT), newsecret]));
    }

		// put NFT to escrow before the transfer in case NFT is sold for fiat money
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



    // Change username
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
}
