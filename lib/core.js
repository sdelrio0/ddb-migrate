import { DynamoDB } from 'aws-sdk';

export const argv = require('minimist')(process.argv.slice(2));

export const options = {
  accessKeyId:     argv.i || argv.key    || "XXXXXXXXXXXXXXXXXX",
  secretAccessKey: argv.t || argv.secret || "YYYYYYYYYYYYYYYYYYYYYYYYYYYY",
  region:   argv.r || argv.region   || 'us-east1',
  protocol: argv.o || argv.protocol || 'http',
  endpoint: argv.e || argv.endpoint || 'localhost',
  port:     argv.p || argv.port     || '8000',
  dir:      argv.d || argv.dir      || 'migrations',
  seed:     argv.s || argv.seed     || 'seed.js',
  schema:   argv.c || argv.schema   || 'schema.json',
};

export const awsConfig = {
  region:   options.region,
  endpoint: options.protocol + '://' + options.endpoint + ':' + options.port,
  accessKeyId: options.accessKeyId,
  secretAccessKey: options.secretAccessKey
};

const _ddb = new DynamoDB(awsConfig);
const _ddbClient = new DynamoDB.DocumentClient(awsConfig);

export const ddb = (method, params) => new Promise((resolve, reject) => {
  try {
    _ddb[method](params, (err, data) => {
      if (err) {
        reject(`ddb(): ${err}`);
      } else {
        resolve(data);
      }
    })
  } catch(err) {
    reject(`ddb(): ${err}`);
  }
});

export const ddbClient = (method, params) => new Promise((resolve, reject) => {
  try {
    _ddbClient[method](params, (err, data) => {
      if (err) {
        reject(`ddbClient(): ${err}`);
      } else {
        resolve(data);
      }
    })
  } catch(err) {
    reject(`ddbClient(): ${err}`);
  }
});