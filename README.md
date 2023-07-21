# MinasNFT
A telegram bot for creating NFTs on MINA network: @minanft_bot

# Used Technologies

- AWS lambda, S3 and DynamoDB
- Serverless
- ChatGPT
- SnarkyJS
- Telegram bot

# Description


## Setting api link AWS-telegram
curl \
  --request POST \
  --url https://api.telegram.org/bot botToken/setWebhook \
  --header 'content-type: application/json' \
  --data '{"url": "API gateway domain/function"}'
  
