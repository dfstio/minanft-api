import axios from "axios";

export async function createRollupNFT(params: any) {
  let args = JSON.stringify({
    contractAddress: params.contractAddress,
  });

  let answer = await zkCloudWorkerRequest({
    command: "execute",
    transactions: [JSON.stringify(params.transaction, null, 2)],
    task: "rollupNFT",
    args,
    metadata: `telegram bot`,
    mode: "sync",
  });

  console.log(`zkCloudWorker answer:`, answer);
  return answer?.result;
}

async function zkCloudWorkerRequest(params: any) {
  const { command, task, transactions, args, metadata, mode, jobId } = params;
  const apiData = {
    auth: process.env.ZKCW_AUTH,
    command: command,
    jwtToken: process.env.ZKCW_JWT,
    data: {
      task,
      transactions: transactions ?? [],
      args,
      repo: "minanft-rollup",
      developer: "DFST",
      metadata,
      mode: mode ?? "sync",
      jobId,
    },
    chain: `zeko`,
  };
  const endpoint = process.env.ZKCW_ENDPOINT!;

  const response = await axios.post(endpoint, apiData);
  return response.data;
}
