import callLambda from "../mina/lambda";
import BotMessage from "../mina/message";
import axios from "axios";

async function startDeployment(
    id: string,
    timeNow: number,
    filename: string,
    username: string,
    creator: string,
): Promise<void> {
    console.log("startDeployment", id, username, timeNow, filename);
    const bot = new BotMessage(id);

    let uri = {
        name: username[0] == "@" ? username : "@" + username,
        description: "",
        url: "",
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
        creator: creator == "" ? "@MinaNFT_bot" : "@" + creator,
    };
    await bot.image(
        `https://minanft-storage.s3.eu-west-1.amazonaws.com/${filename}`,
        { caption: uri.name },
    );
    await bot.invoice(
        uri.name,
        `https://minanft-storage.s3.eu-west-1.amazonaws.com/${filename}`,
    );
    await callLambda("deploy", JSON.stringify(nft));
}

async function startDeploymentIpfs(
    id: string,
    command: string,
    creator: string,
): Promise<void> {
    console.log("startDeploymentIpfs", id, command, creator);
    const bot = new BotMessage(id);

    try {
        const response: any = await axios.get(
            `https://ipfs.io/ipfs/${command}`,
        );
        console.log("startDeploymentIpfs axios", response.data);
        const uri = response.data;
        console.log("uri", uri);

        if (uri.name && uri.image) {
            let nft = {
                username: uri.name,
                id: id,
                timeCreated: Date.now(),
                uri: uri,
                creator: creator == "" ? "@MinaNFT_bot" : "@" + creator,
                ipfs: command,
            };
            await bot.image(
                `https://res.cloudinary.com/minanft/image/fetch/h_300,q_100,f_auto/${uri.image}`,
                { caption: uri.name },
            );
            await bot.invoice(uri.name, `${uri.image}`);
            await callLambda("deploy", JSON.stringify(nft));
        } else console.error("startDeploymentIpfs - wrong uri", uri);
    } catch (error: any) {
        console.error(
            "startDeploymentIpfs",
            error,
            error.data,
            error.response.data,
        );
    }
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

export { startDeployment, startDeploymentIpfs, generateFilename };
