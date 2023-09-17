import axios from "axios";
import { Readable } from "stream";
import FormData from "form-data";

/*
API Key: 36bbbf4f2805511b320b
 API Secret: 82175359d3423c389305e00b353df843751aeecce7bd85e7c7ce99cf62e74f6b
 JWT: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJjYTg4YTdmOS02ZDViLTRmYjAtYmQ0YS0wYzI5MTNmNDJiNjgiLCJlbWFpbCI6Im1pY2hhZWwua29yb3RraWhAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siaWQiOiJOWUMxIiwiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjF9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6IjM2YmJiZjRmMjgwNTUxMWIzMjBiIiwic2NvcGVkS2V5U2VjcmV0IjoiODIxNzUzNTlkMzQyM2MzODkzMDVlMDBiMzUzZGY4NDM3NTFhZWVjY2U3YmQ4NWU3YzdjZTk5Y2Y2MmU3NGY2YiIsImlhdCI6MTY4OTg5NzA0Mn0.rdx9UafvQM9nCs3HKxoV5JwckzHvg9moD5lz7monc6c
*/

async function add(params: any) {
  var data = JSON.stringify(params);

  var config = {
    headers: {
      "Content-Type": "application/json",
      Authorization:
        "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJjYTg4YTdmOS02ZDViLTRmYjAtYmQ0YS0wYzI5MTNmNDJiNjgiLCJlbWFpbCI6Im1pY2hhZWwua29yb3RraWhAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siaWQiOiJOWUMxIiwiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjF9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6IjM2YmJiZjRmMjgwNTUxMWIzMjBiIiwic2NvcGVkS2V5U2VjcmV0IjoiODIxNzUzNTlkMzQyM2MzODkzMDVlMDBiMzUzZGY4NDM3NTFhZWVjY2U3YmQ4NWU3YzdjZTk5Y2Y2MmU3NGY2YiIsImlhdCI6MTY4OTg5NzA0Mn0.rdx9UafvQM9nCs3HKxoV5JwckzHvg9moD5lz7monc6c",
    },
  };

  const res = await axios.post(
    "https://api.pinata.cloud/pinning/pinJSONToIPFS",
    data,
    config,
  );

  console.log(res.data);
  console.log("✅ Done");
  return res.data.IpfsHash;
}

async function addLink(sourceUrl: string) {
  try {
    const response = await fetch(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      {
        method: "POST",
        body: sourceUrl,
        headers: {
          Authorization:
            "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJjYTg4YTdmOS02ZDViLTRmYjAtYmQ0YS0wYzI5MTNmNDJiNjgiLCJlbWFpbCI6Im1pY2hhZWwua29yb3RraWhAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siaWQiOiJOWUMxIiwiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjF9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6IjM2YmJiZjRmMjgwNTUxMWIzMjBiIiwic2NvcGVkS2V5U2VjcmV0IjoiODIxNzUzNTlkMzQyM2MzODkzMDVlMDBiMzUzZGY4NDM3NTFhZWVjY2U3YmQ4NWU3YzdjZTk5Y2Y2MmU3NGY2YiIsImlhdCI6MTY4OTg5NzA0Mn0.rdx9UafvQM9nCs3HKxoV5JwckzHvg9moD5lz7monc6c",
        },
      },
    );
    const res = await response.json();
    console.log("result", res);

    console.log("✅ Done");
    return res.data;
  } catch (error) {
    console.log(error);
  }
  console.log("✅ Done");
}

async function main() {
  const cid = await add({ hello: "world1" });
  //const cid = await addLink("https://minanft-storage.s3.eu-west-1.amazonaws.com/sky.jpeg");

  console.log("cid", cid);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
