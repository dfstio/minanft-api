"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.check = void 0;
const lambda_1 = __importDefault(require("./src/lambda/lambda"));
const tasks_1 = __importDefault(require("./src/table/tasks"));
const TASKS_TABLE = process.env.TASKS_TABLE;
const check = async () => {
    try {
        const table = new tasks_1.default(TASKS_TABLE);
        const data = await table.scan();
        const count = data.length;
        if (count > 0) {
            console.log("count", count, "items:", data);
            let i;
            const time = Date.now();
            for (i = 0; i < count; i++) {
                console.log("item", i, ":", data[i]);
                if (time > data[i].startTime) {
                    if (data[i].startTime + 24 * 60 * 60 * 1000 < time) {
                        console.error("Removing stuck task", data[i]);
                        await table.remove(data[i].id);
                    }
                    console.log("Executing");
                    await (0, lambda_1.default)(data[i].task, data[i].taskdata
                        ? JSON.stringify({
                            id: data[i].id,
                            data: data[i].taskdata,
                        })
                        : JSON.stringify({ id: data[i].id }));
                }
                else {
                    console.log("Waiting");
                }
            }
        }
        return 200;
    }
    catch (error) {
        console.error("catch", error.toString());
        return 200;
    }
};
exports.check = check;
//# sourceMappingURL=tasks.js.map