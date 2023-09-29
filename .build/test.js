"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tasks = void 0;
const tasks_1 = __importDefault(require("./src/table/tasks"));
const TASKS_TABLE = process.env.TASKS_TABLE;
const tasks = async (event, context, callback) => {
    try {
        console.log("event", event);
        const table = new tasks_1.default(TASKS_TABLE);
        const TEN_MIN_IN_MS = 10 * 60 * 1000;
        const items = [
            { id: "1", task: "status1", startTime: Date.now() },
            { id: "9", task: "status9", startTime: Date.now() },
            {
                id: "1",
                task: "status7",
                startTime: Date.now() + TEN_MIN_IN_MS,
            },
        ];
        let scan = await table.scan();
        console.log("items:", scan);
        table.create(items[0]);
        await sleep(1000);
        scan = await table.scan();
        console.log("items:", scan);
        table.create(items[1]);
        await sleep(1000);
        scan = await table.scan();
        console.log("items:", scan);
        console.log("UPDATE", items[2]);
        await table.update(items[2]);
        await sleep(1000);
        scan = await table.scan();
        console.log("items:", scan);
        const count = scan.length;
        const data = scan;
        console.log("count", count, "items:", data);
        let i;
        const time = Date.now();
        for (i = 0; i < count; i++) {
            console.log("item", i, ":", data[i]);
            if (time > data[i].startTime) {
                console.log("Executing");
            }
            else {
                console.log("Waiting");
            }
        }
        await table.remove("1");
        await sleep(1000);
        scan = await table.scan();
        console.log("items:", scan);
        await table.remove("9");
        await sleep(1000);
        scan = await table.scan();
        console.log("items:", scan);
        console.log("end");
        callback(null, {
            statusCode: 200,
            body: "ok",
        });
    }
    catch (error) {
        console.error("catch", error.toString());
        callback(null, {
            statusCode: 200,
            body: "error",
        });
    }
};
exports.tasks = tasks;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=test.js.map