"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AvatarNFT = void 0;
const o1js_1 = require("o1js");
class AvatarNFT extends o1js_1.SmartContract {
    constructor() {
        super(...arguments);
        this.username = (0, o1js_1.State)();
        this.publicMapRoot = (0, o1js_1.State)();
        this.publicFilesRoot = (0, o1js_1.State)();
        this.privateMapRoot = (0, o1js_1.State)();
        this.privateFilesRoot = (0, o1js_1.State)();
        this.uri1 = (0, o1js_1.State)();
        this.uri2 = (0, o1js_1.State)();
        this.pwdHash = (0, o1js_1.State)();
    }
    deploy(args) {
        super.deploy(args);
        this.setPermissions({
            ...o1js_1.Permissions.default(),
            setDelegate: o1js_1.Permissions.proof(),
            setPermissions: o1js_1.Permissions.proof(),
            setVerificationKey: o1js_1.Permissions.proof(),
            setZkappUri: o1js_1.Permissions.proof(),
            setTokenSymbol: o1js_1.Permissions.proof(),
            incrementNonce: o1js_1.Permissions.proof(),
            setVotingFor: o1js_1.Permissions.proof(),
            setTiming: o1js_1.Permissions.proof(),
        });
    }
    init() {
        this.account.provedState.assertEquals(this.account.provedState.get());
        this.account.provedState.get().assertFalse();
        super.init();
    }
    createNFT(username, publicMapRoot, publicFilesRoot, privateMapRoot, privateFilesRoot, uri1, uri2, salt, secret) {
        this.account.provedState.assertEquals(this.account.provedState.get());
        this.account.provedState.get().assertTrue();
        const usernameOld = this.username.get();
        this.username.assertEquals(usernameOld);
        this.username.assertEquals((0, o1js_1.Field)(0));
        const pwdHash = this.pwdHash.get();
        this.pwdHash.assertEquals(pwdHash);
        this.pwdHash.assertEquals((0, o1js_1.Field)(0));
        const publicMapRootOld = this.publicMapRoot.get();
        this.publicMapRoot.assertEquals(publicMapRootOld);
        this.publicMapRoot.assertEquals((0, o1js_1.Field)(0));
        const publicFilesRootOld = this.publicFilesRoot.get();
        this.publicFilesRoot.assertEquals(publicFilesRootOld);
        this.publicFilesRoot.assertEquals((0, o1js_1.Field)(0));
        const privateMapRootOld = this.privateMapRoot.get();
        this.privateMapRoot.assertEquals(privateMapRootOld);
        this.privateMapRoot.assertEquals((0, o1js_1.Field)(0));
        const privateFilesRootOld = this.privateFilesRoot.get();
        this.privateFilesRoot.assertEquals(privateFilesRootOld);
        this.privateFilesRoot.assertEquals((0, o1js_1.Field)(0));
        const uri1Old = this.uri1.get();
        this.uri1.assertEquals(uri1Old);
        this.uri1.assertEquals((0, o1js_1.Field)(0));
        const uri2Old = this.uri2.get();
        this.uri2.assertEquals(uri2Old);
        this.uri2.assertEquals((0, o1js_1.Field)(0));
        this.username.set(username);
        this.publicMapRoot.set(publicMapRoot);
        this.publicFilesRoot.set(publicFilesRoot);
        this.privateMapRoot.set(privateMapRoot);
        this.privateFilesRoot.set(privateFilesRoot);
        this.uri1.set(uri1);
        this.uri2.set(uri2);
        this.pwdHash.set(o1js_1.Poseidon.hash([salt, secret]));
    }
    changePassword(salt, secret, newsecret) {
        this.account.provedState.assertEquals(this.account.provedState.get());
        this.account.provedState.get().assertTrue();
        const pwdHash = this.pwdHash.get();
        this.pwdHash.assertEquals(pwdHash);
        this.pwdHash.assertEquals(o1js_1.Poseidon.hash([salt, secret]));
        this.pwdHash.set(o1js_1.Poseidon.hash([salt, newsecret]));
    }
    setPublicKeyValue() {
        this.account.provedState.assertEquals(this.account.provedState.get());
        this.account.provedState.get().assertTrue();
    }
    setPublicFile() {
        this.account.provedState.assertEquals(this.account.provedState.get());
        this.account.provedState.get().assertTrue();
    }
    setPrivateKeyValue() {
        this.account.provedState.assertEquals(this.account.provedState.get());
        this.account.provedState.get().assertTrue();
    }
    setPrivateFile() {
        this.account.provedState.assertEquals(this.account.provedState.get());
        this.account.provedState.get().assertTrue();
    }
    checkPublicKeyValue() {
        this.account.provedState.assertEquals(this.account.provedState.get());
        this.account.provedState.get().assertTrue();
    }
    checkPrivateKeyValue() {
        this.account.provedState.assertEquals(this.account.provedState.get());
        this.account.provedState.get().assertTrue();
    }
    checkPublicFile() {
        this.account.provedState.assertEquals(this.account.provedState.get());
        this.account.provedState.get().assertTrue();
    }
    checkPrivateFile() {
        this.account.provedState.assertEquals(this.account.provedState.get());
        this.account.provedState.get().assertTrue();
    }
}
exports.AvatarNFT = AvatarNFT;
__decorate([
    (0, o1js_1.state)(o1js_1.Field),
    __metadata("design:type", Object)
], AvatarNFT.prototype, "username", void 0);
__decorate([
    (0, o1js_1.state)(o1js_1.Field),
    __metadata("design:type", Object)
], AvatarNFT.prototype, "publicMapRoot", void 0);
__decorate([
    (0, o1js_1.state)(o1js_1.Field),
    __metadata("design:type", Object)
], AvatarNFT.prototype, "publicFilesRoot", void 0);
__decorate([
    (0, o1js_1.state)(o1js_1.Field),
    __metadata("design:type", Object)
], AvatarNFT.prototype, "privateMapRoot", void 0);
__decorate([
    (0, o1js_1.state)(o1js_1.Field),
    __metadata("design:type", Object)
], AvatarNFT.prototype, "privateFilesRoot", void 0);
__decorate([
    (0, o1js_1.state)(o1js_1.Field),
    __metadata("design:type", Object)
], AvatarNFT.prototype, "uri1", void 0);
__decorate([
    (0, o1js_1.state)(o1js_1.Field),
    __metadata("design:type", Object)
], AvatarNFT.prototype, "uri2", void 0);
__decorate([
    (0, o1js_1.state)(o1js_1.Field),
    __metadata("design:type", Object)
], AvatarNFT.prototype, "pwdHash", void 0);
__decorate([
    o1js_1.method,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AvatarNFT.prototype, "init", null);
__decorate([
    o1js_1.method,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [o1js_1.Field,
        o1js_1.Field,
        o1js_1.Field,
        o1js_1.Field,
        o1js_1.Field,
        o1js_1.Field,
        o1js_1.Field,
        o1js_1.Field,
        o1js_1.Field]),
    __metadata("design:returntype", void 0)
], AvatarNFT.prototype, "createNFT", null);
__decorate([
    o1js_1.method,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [o1js_1.Field, o1js_1.Field, o1js_1.Field]),
    __metadata("design:returntype", void 0)
], AvatarNFT.prototype, "changePassword", null);
__decorate([
    o1js_1.method,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AvatarNFT.prototype, "setPublicKeyValue", null);
__decorate([
    o1js_1.method,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AvatarNFT.prototype, "setPublicFile", null);
__decorate([
    o1js_1.method,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AvatarNFT.prototype, "setPrivateKeyValue", null);
__decorate([
    o1js_1.method,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AvatarNFT.prototype, "setPrivateFile", null);
__decorate([
    o1js_1.method,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AvatarNFT.prototype, "checkPublicKeyValue", null);
__decorate([
    o1js_1.method,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AvatarNFT.prototype, "checkPrivateKeyValue", null);
__decorate([
    o1js_1.method,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AvatarNFT.prototype, "checkPublicFile", null);
__decorate([
    o1js_1.method,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AvatarNFT.prototype, "checkPrivateFile", null);
//# sourceMappingURL=avatarnft.js.map