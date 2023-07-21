import FormQuestion from "./model/formQuestion";
import Translation from "./model/translation";

export default class Questions {
  private _questions: FormQuestion[];
  private _commonError: Translation = {
    en: "Unfortunately, error occured.",
    it: "Purtroppo si è verificato un errore.",
  };
  private commonLongStringError: Translation = {
    en: `${this._commonError.en} Field should have no more than 300 characters`,
    it: `${this._commonError.it} Il campo non dovrebbe avere più di 300 concorrenti`,
  };
  private _welcomeWords: Translation = {
    en: "Welcome to the MinaNFT. I will help you to create Avatar NFT on the MINA blockchain",
    it: "Benvenuto a MinaNFT. Ti aiuterò a creare Avatar NFT sulla blockchain di MINA",
  };
  private _finalWords: Translation = {
    en: "Thank you! Your NFT is created and will be deployed to the MINA blockchain. Meantime you can ask me the questions about Mina NFT, and I will answer with the help of AI and founder of the project",
    it: "Grazie! Il tuo NFT è stato creato e verrà implementato sulla blockchain di MINA. Nel frattempo puoi farmi delle domande riguardo gli NFT di Mina, e risponderò con l'aiuto dell'IA e del fondatore del progetto",
  };
  private _afterFinalWords = {
    en: "Thank you for additional information!",
    it: "Grazie per l'informazione aggiuntiva!",
  };
  private _typeError = {
    en: "Sorry, but I am not supporting this file type. I am accepting: pdf, doc, docx, odt, and txt. Also, the file should be no more than 15 Mb",
    it: "Siamo spiacenti, ma questo tipo di file non è supportato. Sono accettati: pdf, doc, docx, odt e txt. Inoltre, il file non deve superare i 15 Mb.",
  };

  private _fileSuccess: Translation = {
    en: "File accepted",
    it: "File accettato",
  };

  private _imageSuccess: Translation = {
    en: "Image accepted",
    it: "Immagine accettata",
  };

  private _voiceSuccess: Translation = {
    en: "Voice accepted",
    it: "Voce accettata",
  };

  private _phoneButton: Translation = {
    en: "Share phone number",
    it: "Condividere il numero di telefono",
  };

  constructor() {
    this._questions = [
      {
        shortName: ":n",
        name: "username",
        text: {
          en: "Please choose your Mina NFT avatar name",
          it: "Per favore scegli il nome del tuo avatar Mina NFT",
        },
        type: "name",
        num: 0,
        error: {
          en: `${this._commonError.en} Name should contain no more than 30 characters. should start with letter and it should have only letters, digits and underline`,
          it: `${this._commonError.it} Il nome non dovrebbe contenere più di 30 caratteri. Dovrebbe iniziare con una lettera e dovrebbe contenere solo lettere, cifre e sottolineature`,
        },
      },
      {
        shortName: ":d",
        name: "description",
        text: {
          en: "Please describe your NFT by texting me or sending me voice message and I will generate the picture for it or just send me picture",
          it: "Per favore descrivi il tuo NFT inviandomi un messaggio di testo o un messaggio vocale e genererò l'immagine per esso, oppure inviami direttamente l'immagine",
        },
        type: "longString",
        num: 1,
        error: {
          en: `${this._commonError.en} Description should contain no more than 1000 characters`,
          it: `${this._commonError.it} La descrizione non dovrebbe contenere più di 1000 caratteri`,
        },
      },
    ];
  }

  get questions(): FormQuestion[] {
    return this._questions;
  }

  get welcomeWords(): Translation {
    return this._welcomeWords;
  }

  get finalWords(): Translation {
    return this._finalWords;
  }

  get afterFinalWords(): Translation {
    return this._afterFinalWords;
  }

  get typeError(): Translation {
    return this._typeError;
  }

  get fileSuccess(): Translation {
    return this._fileSuccess;
  }

  get phoneButton(): Translation {
    return this._phoneButton;
  }

  get imageSuccess(): Translation {
    return this._imageSuccess;
  }

  get voiceSuccess(): Translation {
    return this._voiceSuccess;
  }

  get commonError(): Translation {
    return this._commonError;
  }

  public getCurrentQuestion(curr: number): FormQuestion | undefined {
    let currFormQuestion: FormQuestion = {
      name: "example",
      text: {
        en: "exampleText",
      },
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
