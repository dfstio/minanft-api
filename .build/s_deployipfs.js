
var serverlessSDK = require('./serverless_sdk/index.js');
serverlessSDK = new serverlessSDK({
  orgId: 'dfstio',
  applicationName: 'minanft-telegram-bot',
  appUid: 'yrtH5ZhjK5zbc3gkqP',
  orgUid: '833d4d09-96e9-4630-ba0f-3909a465e092',
  deploymentUid: '9805579c-588c-4d32-8f3e-b1a09a24caed',
  serviceName: 'minanft-telegram-bot',
  shouldLogMeta: true,
  shouldCompressLogs: true,
  disableAwsSpans: false,
  disableHttpSpans: false,
  stageName: 'dev',
  serverlessPlatformStage: 'prod',
  devModeEnabled: false,
  accessKey: null,
  pluginVersion: '7.1.0',
  disableFrameworksInstrumentation: false
});

const handlerWrapperArgs = { functionName: 'minanft-telegram-bot-dev-deployipfs', timeout: 900 };

try {
  const userHandler = require('./mina.js');
  module.exports.handler = serverlessSDK.handler(userHandler.deployipfs, handlerWrapperArgs);
} catch (error) {
  module.exports.handler = serverlessSDK.handler(() => { throw error }, handlerWrapperArgs);
}