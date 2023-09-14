import FormQuestion from "./model/formQuestion";

export default class Questions {
  private _questions: FormQuestion[];
  private _commonError: string = "commonError";
  private _commonLongStringError: string = "commonLongStringError";
  private _welcomeWords: string = "welcomeWords";
  private _finalWords: string = "finalWords"
  private _afterFinalWords: string = "afterFinalWords";
  private _typeError: string = "typeError";
  private _fileSuccess: string = "fileSuccess";
  private _imageSuccess: string = "imageSuccess";
  private _voiceSuccess: string = "voiceSuccess";
  private _phoneButton: string = "phoneButton";

  constructor() {
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

  get questions(): FormQuestion[] {
    return this._questions;
  }

  get welcomeWords(): string {
    return this._welcomeWords;
  }

  get finalWords(): string {
    return this._finalWords;
  }

  get afterFinalWords(): string {
    return this._afterFinalWords;
  }

  get typeError(): string {
    return this._typeError;
  }

  get fileSuccess(): string {
    return this._fileSuccess;
  }

  get phoneButton(): string {
    return this._phoneButton;
  }

  get imageSuccess(): string {
    return this._imageSuccess;
  }

  get voiceSuccess(): string {
    return this._voiceSuccess;
  }

  get commonError(): string {
    return this._commonError;
  }

  public getCurrentQuestion(curr: number): FormQuestion | undefined {
    let currFormQuestion: FormQuestion = {
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
