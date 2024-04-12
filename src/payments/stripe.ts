import NFTPriceData from "../model/nftPriceData";
import { nftPrice } from "./pricing";

function mintInvoice(id: string, T: any, username: string, image: string) {
  const price: NFTPriceData = nftPrice(username);
  const invoice = {
    provider_token: process.env.STRIPE_KEY!,
    //start_parameter: 'time-machine-sku',
    title: "Mina NFT " + username,
    description:
      // "ReservationNFTname": "Reservation of the MINA Avatar NFT name on MINA blockchain for 1 year and deployment of Mina NFT"
      T("ReservationNFTname"),
    currency: "usd",
    photo_url: image,
    //is_flexible: true,
    prices: [
      { label: price.description, amount: price.price * 100 },
      //{ label: T("NFTtokendeployment"), amount: 9 * 100 }, // "NFTtokendeployment": "NFT token deployment",
    ],
    payload: JSON.stringify({ username, id }),
  };

  console.log("Invoice", invoice);
  return invoice;
}

function buyInvoice(token: any, T: any) {
  const invoice = {
    provider_token: process.env.STRIPE_KEY!,
    //start_parameter: 'time-machine-sku',
    title: "Mina NFT " + token.name,
    // "PurchaseofAvatarNFT": "Purchase of the MINA Avatar NFT name on MINA blockchain"
    description: T("PurchaseofAvatarNFT"),
    currency: token.currency.toLowerCase(),
    photo_url: `https://res.cloudinary.com/minanft/image/fetch/h_300,q_100,f_auto/${token.image}`,
    //is_flexible: true,
    prices: [{ label: "Mina NFT " + token.name, amount: token.price * 100 }],
    payload: JSON.stringify({ name: token.name }),
  };

  console.log("Invoice", invoice);
  return invoice;
}

function postInvoice(
  id: string,
  T: any,
  postId: string,
  username: string,
  image: string
) {
  const invoice = {
    provider_token: process.env.STRIPE_KEY!,
    //start_parameter: 'time-machine-sku',
    title: "Mina NFT post " + username,
    description: T("DeploymentofMinaNFTpost"), // "DeploymentofMinaNFTpost": "Deployment of Mina NFT post to MINA blockchain"
    currency: "usd",
    photo_url: `https://res.cloudinary.com/minanft/image/fetch/h_300,q_100,f_auto/https://minanft-storage.s3.eu-west-1.amazonaws.com/${image}`,
    //is_flexible: true,
    prices: [{ label: T("NFTpostdeployment"), amount: 5 * 100 }], // "NFTpostdeployment": "NFT post - deployment"
    payload: JSON.stringify({ username, id, postId }),
  };

  console.log("Invoice post", invoice);
  return invoice;
}

function supportInvoice(id: string, T: any) {
  const invoice = {
    provider_token: process.env.STRIPE_KEY!,
    //start_parameter: 'time-machine-sku',
    title: T("MinaNFT1hoursupport"), // "MinaNFT1hoursupport": "Mina NFT 1 hour support"
    description:
      // "SupportbyMinaNFTteam": "Support - one hour of the support by MinaNFT team thru zoom or telegram call or chat"
      T("SupportbyMinaNFTteam"),
    currency: "usd",
    photo_url: `https://res.cloudinary.com/minanft/image/fetch/h_300,q_100,f_auto/https://minanft-storage.s3.eu-west-1.amazonaws.com/minanft_profile_photo.jpg`,
    //is_flexible: true,
    prices: [{ label: T("Support1hour"), amount: 100 * 100 }], // "Support1hour": "Support - 1 hour"
    payload: JSON.stringify({ id }),
  };

  console.log("Invoice support", invoice);
  return invoice;
}

export { mintInvoice, postInvoice, supportInvoice, buyInvoice };
