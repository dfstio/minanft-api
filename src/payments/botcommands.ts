import BotMessage from "../mina/message";

/*
new - Create new NFT
sell - Sell NFT
buy - Buy NFT 		
list - List all NFTs
secret - Get secret key of your NFT 		
support - Buy support ticket 
*/

async function supportTicket(id: string): Promise<void> {
  const bot = new BotMessage(id);
  await bot.support();
}

export { supportTicket };
