const reservedNames: string[] = [
  "minanft",
  "mike",
  "dfst",
  "dfstio",
  "mina",
  "minaprotocol",
  /*
  'escrow',
  'badge_twitter',
  'badge_github',
  'badge_discord',
  'badge_telegram',
  'badge_youtube',
  'badge_facebook',
  'badge_instagram',
  'badge_twitch',
  'badge_linkedin',
  'badge_reddit',
  'badge_medium',
  'badge_tiktok',
  'badge_snapchat',
  'badge_pinterest',
  'badge_whatsapp',
  'badge_wechat',
  'badge_weibo',
  'badge_line',
  'badge_kakaotalk',
  'badge_viber',
  'badge_vkontakte',
  'badge_ok',
  'badge_qq',
  'badge_qzone',
  'badge_tumblr',
  'badge_flickr',
  'badge_dribbble',
  'badge_behance',
  'badge_slack',
  'badge_stackoverflow',
  */
  "talha",
  "talhaB62",
  "b62.io",
  "elonmusk",
  "billgates",
  "jeffbezos",
  "apple",
  "google",
  "facebook",
  "microsoft",
  "amazon",
  "netflix",
  "disney",
  "cristiano",
  "kyliejenner",
  "kimkardashian",
  "barackobama",
  "lebronjames",
  "taylorswift",
  "beyonce",
  "ladygaga",
  "rihanna",
  "oprah",
  "dwaynejohnson",
  "realdonaldtrump",
  "justinbieber",
  "katyperry",
  "arianagrande",
  "selenagomez",
  "drake",
  "therock",
  "kevinhart",
  "ellendegeneres",
  "nike",
  "tesla",
  "spacex",
  "starbucks",
  "cocacola",
  "mcdonalds",
  "kfc",
  "burgerking",
  "adidas",
  "pepsi",
  "pizzahut",
  "gucci",
  "prada",
  "versace",
  "dior",
  "chanel",
  "louisvuitton",
  "ferrari",
  "lamborghini",
  "mercedesbenz",
  "bmw",
  "audi",
  "rollsroyce",
  "porsche",
];

function isReservedName(userInput: string): boolean {
  const name = userInput[0] === "@" ? userInput.substring(1) : userInput;
  return reservedNames.includes(userInput.toLowerCase().substring(1, 30));
}

export { reservedNames, isReservedName };
