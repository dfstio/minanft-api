# MinaNFT
MinaNFT - NFT with AI-generated avatar art on MINA blockchain
telegram: @minanft_bot

# Description

MinaNFT is an innovative NFT project leveraging the Mina blockchain's unique privacy features and AI technology. Our platform allows users to create personalised avatar NFTs and use them as an identity symbol across various social media. By interacting with our Telegram bot, users can describe avatar idea by texting or sending voice message in any language, and our AI will generate a unique NFT. Additionally, our avatar NFTs are equipped to host verifiable proofs of authenticity. Users can securely attach and share public and private sensitive content such as art, contracts, medical records, or ownership proofs, transforming traditional NFTs into versatile digital identities. Individuals and businesses are welcome to join MinaNFT, a space where art meets privacy, and personalize their digital footprint.

The architecture of our project will encompass two distinct contracts on the Mina blockchain:

Avatar NFT Contract: This contract is responsible for storing information about the name, NFT URI, and public as well as private posts, using eight variables on the Mina blockchain and the history of Mina blockchain transactions.

Name Service Contract: This contract complements the Avatar NFT contract by handling the name services. Username will be linked with avatar NFT and can be added to profile description on twitter, linkedin or corporate site.

The user interface will be facilitated via a Telegram bot hosted on AWS. The bot will be constructed using the serverless and Telegram bot frameworks in conjunction with SnarkJS. Additionally, a frontend website developed with Algolia and Netlify will be available for user interaction.

As for the storage of NFT data, reliable services such as nft.storage or Infura will be employed, ensuring a secure and efficient infrastructure for our project.

# Bot commands

```new``` 		Create new NFT

```sell``` 		Sell NFT

```buy``` 		Buy NFT 		

```list``` 		List all NFTs

```secret``` 	Get secret key of your NFT 		

```support``` Buy support ticket 		
 		


# Used Technologies

- AWS lambda, S3 and DynamoDB
- Serverless
- ChatGPT
- SnarkyJS
- Telegram bot


## Setting api link AWS-telegram
curl \
  --request POST \
  --url https://api.telegram.org/bot botToken/setWebhook \
  --header 'content-type: application/json' \
  --data '{"url": "API gateway domain/function"}'
  
