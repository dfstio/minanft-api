import OpenAI from 'openai'
import type ImageGPT from '../model/imageGPT'
import type AIUsage from '../model/aiusage'
import Users from '../table/users'
import History from '../table/history'
import { handleFunctionCall } from './functions'
import { archetypes, midjourney, dalle } from './archetypes'
const HISTORY_TABLE = process.env.HISTORY_TABLE!

export default class ChatGPTMessage {
  api: OpenAI
  context: string
  functions: any[]
  language: string

  constructor(
    token: string,
    language: string,
    context: string = '',
    functions: any[] = []
  ) {
    this.api = new OpenAI({ apiKey: token })
    this.context = context
    this.functions = functions
    this.language = language
  }

  public async message(params: any): Promise<ImageGPT> {
    const { message, id, image, username } = params

    const users = new Users(process.env.DYNAMODB_TABLE!)
    const history: History = new History(HISTORY_TABLE, id)
    let isImage: boolean = false

    let prompt = message
    const errorMsg = 'ChatGPT error. Please try again in few minutes'
    let answer: ImageGPT = {
      image: '',
      answerType: 'text',
      text: errorMsg,
    } as ImageGPT
    if (image !== '') isImage = true
    if (message.length > 6 && message.substr(0, 5).toLowerCase() === 'image') {
      isImage = true
      prompt = message.substr(6)
    }
    if (
      message.length > 9 &&
      message.substr(0, 8).toLowerCase() === 'immagine'
    ) {
      isImage = true
      prompt = message.substr(9)
    }

    if (isImage) {
      console.log('Image prompt:', prompt)
      let imageUrl = ''

      try {
        const imageParams = {
          n: 1,
          prompt,
          user: id
        }

        const image = await this.api.images.generate(imageParams)
        if (image?.data[0]?.url !== undefined) imageUrl = image.data[0].url
        await users.updateImageUsage(id)
        console.log('Image result', imageUrl, image.data)
      } catch (error: any) {
        console.error('createImage error')
        if (error?.response?.data?.error?.message !== undefined) {
          console.error(error.response.data.error)
          answer.text =
            errorMsg + ' : ' + error.response.data.error.message.toString()
        }
        return answer
      }

      return {
        image: imageUrl,
        answerType: 'image',
        text: prompt
      } as ImageGPT
    }

    const chatcontext = [
      {
        role: 'system',
        content: this.context
      }
    ]

    try {
      const messages = await history.build(chatcontext)
      console.log('Request chatGptMessages', messages)

      const completion = await this.api.chat.completions.create({
        model: 'gpt-4',
        messages,
        functions: this.functions,
        function_call: 'auto', // auto is default, but we'll be explicit
        user: id
      })
      console.log('ChatGPT full log', completion)

      if (completion.usage !== undefined && completion.usage !== null)
        await users.updateUsage(id, completion.usage as AIUsage)
      const message = completion.choices[0].message
      if (message) {
        console.log('ChatGPT', message)
        await history.addAnswer(message)
        if (message.function_call) {
          await handleFunctionCall(id, message.function_call, username, this.language)
          answer.answerType = 'function'
          answer.text = ''
        }
        if (message.content !== undefined && message.content !== null) answer.text = message.content
      }

      return answer
    } catch (error: any) {
      if (error?.response?.data?.error?.message !== undefined) {
        console.error('ChatGPT error', error.response.data.error.message)
        answer.text =
          answer.text + ' : ' + error.response.data.error.message.toString()
      } else console.error('ChatGPT error', error)
      return answer
    }
  }

  public async image(
    msg: string,
    id: string,
    username: string,
    isArchetype: boolean = false,
  ): Promise<ImageGPT> {
    const users = new Users(process.env.DYNAMODB_TABLE!)
    const errorMsg = 'ChatGPT error. Please try again in few minutes'
    let answer: ImageGPT = <ImageGPT>{
      image: '',
      answerType: 'text',
      text: errorMsg,
    }
    let prompt: string = msg.substring(0, 999)
    let fullPrompt: string = msg

    const art: string = isArchetype ? dalle : archetypes
    const messages: any[] =
      [
        {
          role: 'system',
          content: isArchetype ? art : art + username
        },
        {
          role: 'user',
          content: msg
        }
      ]

    try {
      const completion = await this.api.chat.completions.create({
        model: 'gpt-4', // "gpt-3.5-turbo"
        messages,
        user: id
      })
      console.log('ChatGPT', completion.choices[0].message?.content)
      if (completion?.choices[0]?.message?.content !== undefined && completion?.choices[0]?.message?.content !== null) {
        fullPrompt = completion.choices[0].message.content
        prompt = completion.choices[0].message.content.substring(0, 999)
      }
      await users.updateUsage(id, completion.usage as AIUsage)
      if (isArchetype && fullPrompt.length > 999) {
        const completion = await this.api.chat.completions.create({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content:
                'Maximum size of description should be strictly 1000 characters. Do not provide description with the size more than 1000 characters. Please shorten the user input so it would be not more than 1000 characters',
            },
            {
              role: 'user',
              content: fullPrompt
            },
          ],
          user: id
        })
        if (completion?.choices[0]?.message?.content !== undefined &&
          completion?.choices[0]?.message?.content !== null &&
          completion?.usage !== undefined) {
          prompt = completion.choices[0].message.content.substring(0, 999)
          await users.updateUsage(id, completion.usage as AIUsage)
        }
      }
    } catch (err) {
      console.error(err)
    }

    console.log('Image prompt:', prompt)
    console.log('Image full prompt:', fullPrompt)
    let imageUrl = ''

    try {
      const imageParams = {
        n: 1,
        prompt,
        user: id
      }

      const image = await this.api.images.generate(imageParams)
      if (image?.data[0]?.url !== undefined) imageUrl = image.data[0].url
      await users.updateImageUsage(id)
      console.log('Image result', imageUrl, image.data)
    } catch (error: any) {
      console.error('createImage error')
      if (error?.response?.data?.error?.message !== undefined &&
        error?.response?.data?.error?.message !== null) {
        console.error(error.response.data.error)
        answer.text =
          errorMsg + ' : ' + error.response.data.error.message.toString()
      }
      return answer
    }

    return <ImageGPT>{
      image: imageUrl,
      answerType: 'image',
      text: isArchetype ? midjourney + fullPrompt : prompt,
    }
  }
}
