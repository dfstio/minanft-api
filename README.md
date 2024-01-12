# MinaNFT API and telegram bot

The MinaNFT project is an innovative Non-Fungible Token (NFT) platform that integrates the unique privacy features of the Mina blockchain with advanced AI technology. It's designed to redefine the NFT space by offering a range of functionalities that go beyond traditional NFT capabilities.

## Telegram bot

telegram: [@MinaNFT_bot](https://t.me/minanft_bot?start)

## Features

### API

- [NFT name reservation](https://docs.minanft.io/api/class/api/#reserveName)
- [NFT name lookup](https://docs.minanft.io/api/class/api/#lookupName)
- [NFT minting](https://docs.minanft.io/api/class/api/#mint)
- [Indexing NFT for frontend](https://docs.minanft.io/api/class/api/#indexName)
- [Creation of the post](https://docs.minanft.io/api/class/api/#post)
- [Creation and verification of the proofs, minting and sending transaction](https://docs.minanft.io/api/class/api/#proof)
- [Retrieving proof calculation results](https://docs.minanft.io/api/class/api/#waitForJobResult)
- [Getting billing reports](https://docs.minanft.io/api/class/api/#queryBilling)

### Telegram bot

- [Creates simple NFTs](https://t.me/minanft_bot?start) (name + image) in a lite mode. The bots always start in lite mode and automatically switch to the full mode after the user has minted the first NFT.
- In full mode:
  - Generates images using a DALL-E model
  - Explain to a user how to create NFTs, posts, and key-value pairs for NFTs
  - Accepts and stores any files uploaded by the user for adding to the NFT or post
  - List NFTs of the user
  - List files of the user
  - List keys of the NFTs
  - Adds private and public key-value pairs to the NFT
  - Prove private and public key-values pairs of the NFT
  - Verifies proofs of the private and public key-values pairs of the NFT
- Accepts text messages and voice messages
- In voice mode, send voice messages to the user. The communication can be fully in voice in voice mode.

### Supported languages

- Frontend: English, Turkish, Italian, Spanish, French
- Telegram bot:
  - Written system messages: English, Turkish, Italian, Spanish, French
  - Voice chat messages: English, Spanish, French, Italian, Turkish, Arabic, Dutch, Catalan, Chinese, Danish, German, Japanese, Korean, Norwegian, Polish, Portuguese, Romanian, Russian, Swedish, Welsh.
  - Voice comprehension: about [50 languages](https://github.com/openai/whisper)
  - Text chat messages: almost any language
  - Text comprehension: almost any language
- CLI tool: English

## Links

### Telegram bot

https://t.me/minanft_bot

### Documentation

https://docs.minanft.io

### Website

https://minanft.io

### Telegram bot, API, and serverless backend repo

https://github.com/dfstio/minanft-api

## Installation

## Setting api link AWS-telegram

curl \
 --request POST \
 --url https://api.telegram.org/bot botToken/setWebhook \
 --header 'content-type: application/json' \
 --data '{"url": "API gateway domain/function"}'

## Configuring AWS VPC

This repo uses EFS storage running in VPC to store the prover keys. To create VPC access for lambda functions:

- Add EFS
- Add DynamoDB VPC gateway
- Add S3 VPC gateway
- Add lambda VPC interface
- Add NAT to VPC
- Configure VPC in the functions setting in serverless.yml
  Use serverless.yml in this repo as an example, and this [guide](https://medium.com/@pra4mesh/internet-access-to-aws-lambda-in-a-vpc-6f7b65845f1d)
