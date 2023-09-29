"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Validator {
    validate(type, value) {
        if (value) {
            if (type === "email") {
                return this.validateEmail(value);
            }
            else if (type === "name") {
                return this.validateName(value);
            }
            else if (type === "shortString") {
                return this.validateShortString(value);
            }
            else if (type === "longString") {
                return this.validateLongString(value);
            }
            else if (type === "phone") {
                return this.validatePhone(value);
            }
        }
        return false;
    }
    validateWrittenDocument(documentData) {
        const mimeType = documentData.mime_type;
        const isAllowedSize = documentData.file_size <= 15000000;
        if (documentData.mime_type.indexOf("image") > -1) {
            return false;
        }
        return (isAllowedSize &&
            (mimeType === "application/pdf" ||
                mimeType === "application/msword" ||
                mimeType ===
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
                mimeType === "application/vnd.oasis.opendocument.text" ||
                mimeType === "text/plain"));
    }
    hasEventBodyDocument(eventBody) {
        return eventBody.message.document ? true : false;
    }
    hasEventBodyMessage(eventBody) {
        return eventBody.message.text ? true : false;
    }
    validateEmail(value) {
        const regExp = /^\S+@\S+$/g;
        return regExp.test(value);
    }
    validateName(value) {
        if (value.length > 30)
            return false;
        const regExp = /^[a-zA-Z]\w+$/g;
        return regExp.test(value[0] == "@" ? value.substr(1, 30) : value);
    }
    validateShortString(value) {
        return value.length <= 30;
    }
    validateLongString(value) {
        return value.length <= 1000;
    }
    validatePhone(value) {
        const regExp = /^(?=.*[0-9])[- +()0-9]+$/g;
        return regExp.test(value);
    }
}
exports.default = Validator;
//# sourceMappingURL=validator.js.map