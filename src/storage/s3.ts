import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand
} from '@aws-sdk/client-s3'
import axios from 'axios'

export default class S3File {
  private readonly _client: S3Client
  private readonly bucket: string
  private readonly key: string

  constructor(bucket: string, key: string) {
    const options = {}
    this._client = new S3Client(options)
    this.bucket = bucket
    this.key = key
    console.log('S3File:', bucket, ':', key, 'region:', process.env.AWS_REGION)
  }

  get client(): S3Client {
    return this._client
  }

  public async put(buffer: Buffer): Promise<void> {
    try {
      const params = {
        Bucket: this.bucket,
        Key: this.key,
        Body: buffer
      }
      console.log('S3File: put', params)
      const command = new PutObjectCommand(params)
      const data = await this._client.send(command)
      console.log('Success: S3File: put', data)
    }
    catch (error: any) {
      console.error('Error: S3File: put', error)
    }
  }

  public async get(): Promise<any | undefined> {
    try {
      const params = {
        Bucket: this.bucket,
        Key: this.key
      }
      console.log('S3File: get', params)
      const command = new GetObjectCommand(params)
      const data = await this._client.send(command)
      console.log('Success: S3File: get', data)
      return data
    } catch (error: any) {
      console.error('Error: S3File: get', error)
      return undefined
    }
  }

  // get stream function
  public async getStream(): Promise<any | undefined> {
    try {
      const params = {
        Bucket: this.bucket,
        Key: this.key,
      }
      console.log('S3File: getStream', params)
      const command = new GetObjectCommand(params)
      const data = await this._client.send(command)
      console.log('Success: S3File: getStream', data)
      return data.Body
    } catch (error: any) {
      console.error('Error: S3File: getStream', error)
      return undefined
    }
  }

  public async head(): Promise<boolean> {
    try {
      const params = {
        Bucket: this.bucket,
        Key: this.key,
      }
      console.log('S3File: head', params)
      const command = new HeadObjectCommand(params)
      const data = await this._client.send(command)
      console.log('Success: S3File: head', data)
      return true
    }
    catch (error: any) {
      console.log('Error: S3File: head', error)
      return false
    }
  }

  // wait until file is ready with timeout if file is not ready after 10 seconds
  public async wait(timeoutSec: number = 10): Promise<void> {
    try {
      let finished = false
      const start = Date.now()
      while (!finished) {
        console.log('Waiting for file', this.key)
        const head = await this.head()
        if (head) finished = true
        else if (Date.now() - start > timeoutSec * 1000) throw new Error('Error: S3File: Timeout')
        else await sleep(500)
      }
    } catch (error: any) {
      console.error('Error: S3File: wait', error)
    }
  }

  public async remove(): Promise<void> {
    try {
      const params = {
        Bucket: this.bucket,
        Key: this.key
      }
      console.log('S3File: remove', params)
      const command = new DeleteObjectCommand(params)
      const data = await this._client.send(command)
      console.log('Success: S3File: remove', data)
    } catch (error: any) {
      console.error('Error: S3File: remove', error)
    }
  }

  public async copy(bucket: string, key: string): Promise<void> {
    try {
      const params = {
        Bucket: bucket,
        CopySource: `${this.bucket}/${this.key}`,
        Key: key
      }
      console.log('S3File: copy', params)
      const command = new CopyObjectCommand(params)
      const data = await this._client.send(command)
      console.log('Success: S3File: copy', data)
    } catch (error: any) {
      console.error('Error: S3File: copy', error)
    }
  }

  public async move(bucket: string, key: string): Promise<void> {
    try {
      await this.copy(bucket, key)
      await this.remove()
    } catch (error: any) {
      console.error('Error: S3File: move', error)
    }
  }

  public async upload(url: string): Promise<void> {
    try {
      const response = await axios.get(url, { responseType: 'arraybuffer' })
      const buffer = Buffer.from(response.data, 'binary')
      await this.put(buffer)
    } catch (error: any) {
      console.error('Error: S3File: upload', error)
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}