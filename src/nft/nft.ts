import callLambda from "../mina/lambda";
import BotMessage from "../mina/message";

async function startDeployment(
    id: string,
    timeNow: number,
    filename: string,
    username: string,
): Promise<void> {
    console.log("startDeployment", id, username, timeNow, filename);
    const bot = new BotMessage(id);

    let uri = {
        name: username,
        description: "",
        type: "object",
        image: filename,
        external_url: "minanft.io",
        time: timeNow,
    };

    let nft = {
        username: username,
        id: id,
        timeCreated: timeNow,
        uri: uri,
    };
    await bot.image(
        `https://minanft-storage.s3.eu-west-1.amazonaws.com/${filename}`,
        { caption: "@" + username },
    );
    await bot.invoice(username, filename);
    await callLambda("deploy", JSON.stringify(nft));
}

function generateFilename(timeNow: number): string {
    let outString: string = "";
    let inOptions: string = "abcdefghijklmnopqrstuvwxyz0123456789_";

    for (let i = 0; i < 30; i++) {
        outString += inOptions.charAt(
            Math.floor(Math.random() * inOptions.length),
        );
    }
    return timeNow.toString() + "-" + outString;
}

export { startDeployment, generateFilename };
