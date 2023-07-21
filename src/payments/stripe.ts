function stripeInvoice(id: string, username: string, image: string) {
  const invoice = {
    provider_token: process.env.STRIPE_KEY!,
    //start_parameter: 'time-machine-sku',
    title: "Mina NFT @" + username,
    description:
      "Reservation of the MINA Avatar NFT name on MINA blockchain and deployment of Mina NFT",
    currency: "usd",
    photo_url: `https://res.cloudinary.com/minanft/image/fetch/h_300,q_100,f_auto/https://minanft-storage.s3.eu-west-1.amazonaws.com/${image}`,
    //is_flexible: true,
    prices: [
      { label: "Reservation of name for 1 year", amount: 19 * 100 },
      { label: "NFT token deployment", amount: 9 * 100 },
    ],
    payload: JSON.stringify({ username, id }),
  };

  console.log("Invoice", invoice);
  return invoice;
}

export { stripeInvoice };
