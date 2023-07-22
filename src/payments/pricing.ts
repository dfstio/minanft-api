import NFTPriceData from "../model/nftPriceData";
import { vipnames } from "../nft/vipnames";

function nftPrice(username: string): NFTPriceData {
  let category = 3;
  if (username.length <= 5) category = 2;
  if (username.length <= 3) category = 1;
  if (vipnames.includes(username)) category = 0;

  let price: NFTPriceData = <NFTPriceData>{
    username: username,
    price: prices[category].price,
    currency: "usd",
    description: prices[category].description,
  };

  return price;
}

const prices = [
  {
    price: 10000,
    description:
      "Exclusive Mina NFT name - simple, elegant, and very sought-after, consisting of common words or phrases that are easy to remember or brand name",
  },
  {
    price: 1000,
    description:
      "Short Mina NFT Name with less than 3 characters: short, sweet, and highly memorable, this username is the digital equivalent of prime real estate",
  },
  {
    price: 49,
    description:
      "Short Mina NFT name 5 characters or less: the backbone of the digital world, offering a blend of personalization",
  },
  {
    price: 19,
    description: "Reservation of Mina NFT Avatar name for 1 year",
  },
];

export { nftPrice };
