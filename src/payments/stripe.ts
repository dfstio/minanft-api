import NFTPriceData from "../model/nftPriceData";
import { nftPrice } from "./pricing";

function mintInvoice(id: string, username: string, image: string) {
  const price: NFTPriceData = nftPrice(username);
  const invoice = {
    provider_token: process.env.STRIPE_KEY!,
    //start_parameter: 'time-machine-sku',
    title: "Mina NFT @" + username,
    description:
      "Reservation of the MINA Avatar NFT name on MINA blockchain for 1 year and deployment of Mina NFT",
    currency: "usd",
    photo_url: `https://res.cloudinary.com/minanft/image/fetch/h_300,q_100,f_auto/https://minanft-storage.s3.eu-west-1.amazonaws.com/${image}`,
    //is_flexible: true,
    prices: [
      { label: price.description, amount: price.price * 100 },
      { label: "NFT token deployment", amount: 9 * 100 },
    ],
    payload: JSON.stringify({ username, id }),
  };

  console.log("Invoice", invoice);
  return invoice;
}

function postInvoice(
  id: string,
  postId: string,
  username: string,
  image: string,
) {
  const invoice = {
    provider_token: process.env.STRIPE_KEY!,
    //start_parameter: 'time-machine-sku',
    title: "Mina NFT post @" + username,
    description: "Deployment of Mina NFT post to MINA blockchain",
    currency: "usd",
    photo_url: `https://res.cloudinary.com/minanft/image/fetch/h_300,q_100,f_auto/https://minanft-storage.s3.eu-west-1.amazonaws.com/${image}`,
    //is_flexible: true,
    prices: [{ label: "NFT post - deployment", amount: 5 * 100 }],
    payload: JSON.stringify({ username, id, postId }),
  };

  console.log("Invoice post", invoice);
  return invoice;
}

function supportInvoice(id: string) {
  const invoice = {
    provider_token: process.env.STRIPE_KEY!,
    //start_parameter: 'time-machine-sku',
    title: "Mina NFT 1 hour support",
    description:
      "Support - one hour of the support by MinaNFT team thru zoom or telegram call or chat",
    currency: "usd",
    photo_url: `https://res.cloudinary.com/minanft/image/fetch/h_300,q_100,f_auto/https://minanft-storage.s3.eu-west-1.amazonaws.com/minanft_profile_photo.jpg`,
    //is_flexible: true,
    prices: [
      { label: "Support - 1 hour", amount: 100 * 100 },
    ],
    payload: JSON.stringify({ id }),
  };

  console.log("Invoice support", invoice);
  return invoice;
}

export { mintInvoice, postInvoice, supportInvoice };
