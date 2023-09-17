import fs from "fs";
//import axios from "axios";
import FormData from "form-data";
import { INFURA_IPFS_API_KEY, INFURA_IPFS_API_KEYSECRET } from "../env.json";

const auth =
  "Basic " +
  Buffer.from(INFURA_IPFS_API_KEY + ":" + INFURA_IPFS_API_KEYSECRET).toString(
    "base64",
  );

/*
async function add(file: any): Promise<string> {
  const client = new NFTStorage({ token: NFT_STORAGE_TOKEN });

  const someData = new Blob([JSON.stringify(file)]);
  const cid = await client.storeBlob(someData);
  return cid;
}

async function addFile(file: any) {
  const storage = new NFTStorage({ token: NFT_STORAGE_TOKEN });
  const data = await fs.promises.readFile("./a.png");
  const { cid, car } = await NFTStorage.encodeBlob(new Blob([data]));
  console.log(`File CID: ${cid}`);
  console.log("Sending file...");
  await storage.storeCar(car, {
    onStoredChunk: (size) => console.log(`Stored a chunk of ${size} bytes`),
  });

  console.log("✅ Done");
}

async function addLink(file: any): Promise<string> {
  const storage = new NFTStorage({ token: NFT_STORAGE_TOKEN });
  let responce = await axios.get(file, {
    responseType: "arraybuffer",
  });

  const data = Buffer.from(responce.data, "binary");
  const { cid, car } = await NFTStorage.encodeBlob(new Blob([data]));
  console.log(`File CID: https://ipfs.io/ipfs/${cid}`);
  console.log("Sending file...");

  await storage.storeCar(car, {
    onStoredChunk: (size) => console.log(`Stored a chunk of ${size} bytes`),
  });
  return `https://ipfs.io/ipfs/${cid}`;
}
*/

async function addLink(file: any) {
  const bodyObj = {
    app_id: "**********",
    included_segments: ["All"],
    data: { foo: "bar" },
    contents: { en: "Hi good morning" },
  };

  fetch("https://ipfs.infura.io:5001/api/v0/add", {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(bodyObj),
  })
    .then((response) => response.blob())
    .then((response) => response.text())
    .then((response) => {
      console.log("success api call", response);
    })
    .catch((error) => {
      console.error(error);
    });

  /*
     //const formData = new FormData();
     let body = new FormData();
     form.append('image', imageUrl);
     
       body.append('file', { hello: 'world1' }, {
    contentType: 'application/json', // or photo.type
    filename: "a.jpg",
  });
  
        // append stream with a file
      formData.append("file", new Blob([data]), {
        contentType: 'image/jpeg', //voiceData.mime_type, 'audio/mp3'
        //knownLength: data.ContentLength, //voiceData.file_size, 149187,
        filename: "a.jpg",
      });
  

const response = await fetch(file, {
      method: 'GET'
    });
    
    
let response = await axios.get(file, {
        responseType: "arraybuffer",
      });
      console.log("addLink data:", response.data ? "yes" : "no");
      //console.log("addLink response", response);
      //const data = Buffer.from(response.data, "binary");
      	const data = Buffer.from(response.data, "binary");
      const bl = new Blob([data]);
      
      */
  //const form = new FormData();
  //form.append('image', file);

  //form.append('aaa', "aa", "./sky.jpeg");
  /*
	{
        contentType: 'image/jpeg', //voiceData.mime_type, 'audio/mp3'
        //knownLength: data.ContentLength, //voiceData.file_size, 149187,
        filename: "sky.jpeg",
      });

     let response = await axios.get(file, {
        responseType: "arraybuffer",
      });
      console.log("addLink data:", response.data ? "yes" : "no");
      //console.log("addLink response", response);
      const data = Buffer.from(response.data, "binary");



      const bl = new Blob([data],{
  type: 'image/jpeg',
});


//console.log("form", form);

const response1 = await fetch(file, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/octet-stream'
      }
    });
    console.log("result", response1.body);
    const blob = await response1.blob();
 


const response = await fetch("https://ipfs.infura.io:5001/api/v0/add?pin=false", {
      method: 'POST',
      body: blob,
      headers: {
        Authorization: auth
      },
    });
    const res = await response.blob();
    console.log("result", res);
    const str = await res.text();
    console.log("result1", str);

/*

const bl = new Blob([response1.body],{
  type: 'image/jpeg',
})

	const result = axios.post(
       "https://ipfs.infura.io:5001/api/v0/add?pin=false",
      form,{

      headers: {
            Authorization: auth,
          },
    });
  /*  
 
      axios
        .post("https://ipfs.infura.io:5001/api/v0/add?pin=false", bl , {
          headers: {
            Authorization: auth,
            //...formData.getHeaders(),
          },
        })
        .then((response) => {
          if (response && response.data ) {
            console.log("ipfs:", response.data);
            return response.data;
          } else {
            console.error("error", response.data.error);
            return response.data.error;
          }
        })
        .catch((e) => console.log("catch error", e));
 

*/
  console.log("✅ Done");
}

async function main() {
  //const cid = await add({ hello: 'world1' })
  const cid = await addLink(
    "https://minanft-storage.s3.eu-west-1.amazonaws.com/sky.jpeg",
  );

  console.log("cid", cid);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
