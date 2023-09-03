import { Handler, Context, Callback } from "aws-lambda";
import TasksData from "./src/model/tasksData";
import Tasks from "./src/connector/tasks";
const TASKS_TABLE = process.env.TASKS_TABLE!;

const tasks: Handler = async (
  event: any,
  context: Context,
  callback: Callback,
) => {
  try {
    console.log("event", event);

    const table = new Tasks(TASKS_TABLE);
    const TEN_MIN_IN_MS = 10 * 60 * 1000;
    const items: TasksData[] = [
      <TasksData>{ id: "1", task: "status1", startTime: Date.now() },
      <TasksData>{ id: "9", task: "status9", startTime: Date.now() },
      <TasksData>{
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
    const count: number = scan.length;
    const data: TasksData[] = scan;
    console.log("count", count, "items:", data);

    let i: number;
    const time = Date.now();
    for (i = 0; i < count; i++) {
      console.log("item", i, ":", data[i]);
      if (time > data[i].startTime) {
        console.log("Executing");
      } else {
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
  } catch (error) {
    console.error("catch", (<any>error).toString());
    callback(null, {
      statusCode: 200,
      body: "error",
    });
  }
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { tasks };
