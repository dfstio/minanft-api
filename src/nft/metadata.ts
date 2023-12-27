import axios from "axios";

export async function getMetadata(url: string): Promise<any> {
  console.log("getMetadata", url);

  const metadata = (await axios.get(url)).data;
  console.log("getMetadata", metadata);
  return metadata;
}
