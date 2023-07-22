import { KMS } from "aws-sdk";
import crypto from 'crypto';

// TODO : encrypt all private keys and secrets and fine-tune AWS permissions

async function getKey(context: any)
{
   try {     
     var params = {
            KeyId: process.env.AWS_KMS_ENCRYPTION_KEY_ID!, /* required */
            KeyPairSpec:  'RSA_4096', /* required */
            EncryptionContext: context
          };
          
          
      const kms = new KMS();    
      console.log("getKey params", params);
      let result = await kms.generateDataKeyPairWithoutPlaintext(params).promise();
      
      console.log("getKey", result);
      return result;
           
    } catch (error) {
       console.error("catch", {error});
       return error;
    }
   
}

async function getPrivateKey(encryptedKey: any, context : any)
{

   try {     
     var params = {            
            CiphertextBlob: encryptedKey,
            EncryptionContext: context,
            KeyId: process.env.AWS_KMS_ENCRYPTION_KEY_ID!
          };
      
      const kms = new KMS();    
      //if(DEBUG) console.log("getPrivateKey params:", params);
      let result = await kms.decrypt(params).promise();
      
      //if(DEBUG) console.log("getPrivateKey result:", result);
      return result.Plaintext;
           
    } catch (error) {
       console.error("catch", {error});
       return error;
    }
   
}

/*
function encrypt(toEncrypt : any, publicKey : any)
{
       const buffer = Buffer.from(toEncrypt, 'utf8')
       const publicKeyInput = {
            key: Buffer.from(publicKey),
            format: 'der',
            type: 'spki'
        };
       const publicKeyObject = crypto.createPublicKey(publicKeyInput)
       const encrypted = crypto.publicEncrypt(publicKeyObject, buffer)
       return encrypted.toString('base64')
}

function decrypt(toDecrypt : any, privateKey : any)
{
       const buffer = Buffer.from(toDecrypt, 'base64')
       const privateKeyInput = {
            key: Buffer.from(privateKey),
            format: 'der',
            type: 'pkcs8'
        };

       const privateKeyObject = crypto.createPrivateKey(privateKeyInput);
       const decrypted = crypto.privateDecrypt(privateKeyObject, buffer);
       return decrypted.toString('utf8')
}
*/

export {
    getKey,
    //encrypt,
    //decrypt,
    getPrivateKey
}
