"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Questions {
    constructor() {
        this._commonError = "commonError";
        this._commonLongStringError = "commonLongStringError";
        this._welcomeWords = "welcomeWords";
        this._finalWords = "finalWords";
        this._afterFinalWords = "afterFinalWords";
        this._typeError = "typeError";
        this._fileSuccess = "fileSuccess";
        this._imageSuccess = "imageSuccess";
        this._voiceSuccess = "voiceSuccess";
        this._phoneButton = "phoneButton";
        this._questions = [
            {
                shortName: ":n",
                name: "username",
                text: "username",
                type: "name",
                num: 0,
                error: "usernameError",
            },
            {
                shortName: ":d",
                name: "description",
                text: "description",
                type: "longString",
                num: 1,
                error: "descriptionError",
            },
        ];
    }
    get questions() {
        return this._questions;
    }
    get welcomeWords() {
        return this._welcomeWords;
    }
    get finalWords() {
        return this._finalWords;
    }
    get afterFinalWords() {
        return this._afterFinalWords;
    }
    get typeError() {
        return this._typeError;
    }
    get fileSuccess() {
        return this._fileSuccess;
    }
    get phoneButton() {
        return this._phoneButton;
    }
    get imageSuccess() {
        return this._imageSuccess;
    }
    get voiceSuccess() {
        return this._voiceSuccess;
    }
    get commonError() {
        return this._commonError;
    }
    getCurrentQuestion(curr) {
        let currFormQuestion = {
            name: "example",
            text: "example",
            type: "string",
            num: -1,
        };
        for (let i = 0; i < this._questions.length; i++) {
            if (this._questions[i].num === curr) {
                currFormQuestion = this._questions[i];
                break;
            }
        }
        return currFormQuestion ? currFormQuestion : undefined;
    }
}
exports.default = Questions;
//# sourceMappingURL=questions.js.map