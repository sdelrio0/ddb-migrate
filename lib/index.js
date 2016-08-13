#!/usr/bin/env node

/*
 * Commands:
 *
 * [x] ddb migrate # runs all migrations *up* sequentially
 * [x] ddb migrate:up # same as above
 * [x] ddb clear # deletes all tables
 * [x] ddb seed # executes seeds
 * [x] ddb setup # migrate -> seed
 * [x] ddb reset # clear -> setup
 * [x] ddb migrate VERSION=YYYYMMDDHHMMSS # migrates only this version *up*
 * [x] ddb migrate:up VERSION=YYYYMMDDHHMMSS # same as above
 * [x] ddb migrate:down VERSION=YYYYMMDDHHMMSS # migrates only this version *down*
 * [x] ddb migrate:down # migrates all versions backwards and *down*
 * [x] ddb rollback # last migration *down*
 * [] ddb rollback STEP=X # last X migrations *down*
 * [x] ddb migrate NODE_ENV=test
 * [x] ddb create tableName
 * [x] ddb update tableName
 * [x] ddb describe tableName
 * [x] ddb list
 * [x] ddb scan tableName
 *
 * TODO:
 * [] Handle stages
 * [] Load config from .env or .dynamo file
 * [] Make functional so methods can be exported
 * [] Handle environments. Append the current NODE_ENV to the migration number in schema.js
 */

export const fn = (x) => {return x+1};

const DynamoDB = require('aws-sdk').DynamoDB;
const Promise = require('bluebird');
const path = require('path');
const fs = Promise.promisifyAll(require('fs'));
const argv = require('minimist')(process.argv.slice(2));
const isArray = require('underscore').isArray;
const isObject = require('underscore').isObject;
const isBoolean = require('underscore').isBoolean;
const isString = require('underscore').isString;
const has = require('underscore').has;
const filter = require('underscore').filter;
const template = require('underscore').template;

var schema = {};

const options = {
  region:   argv.r || argv.region   || 'us-east1',
  protocol: argv.o || argv.protocol || 'http',
  endpoint: argv.e || argv.endpoint || 'localhost',
  port:     argv.p || argv.port     || '8000',
  dir:      argv.d || argv.dir      || 'migrations',
  seed:     argv.s || argv.seed     || 'seed.js',
  schema:   argv.c || argv.schema   || 'schema.json',
};

const awsConfig = {
  region:   options.region,
  endpoint: options.protocol + '://' + options.endpoint + ':' + options.port
};

const _ddb = new DynamoDB(awsConfig);
const _ddbClient = new DynamoDB.DocumentClient(awsConfig);

export const ddb = (method, params) => {
  return new Promise((resolve, reject) => {
      _ddb[method](params, (err, data) => {
        if (err) {reject(err)} else {resolve(data)}
      })
});
};
export const ddbClient = (method, params) => {
  return new Promise((resolve, reject) => {
      _ddbClient[method](params, (err, data) => {
        if (err) {reject(err)} else {resolve(data)}
      })
});
};

const migration = {
  command: argv._[0],
  path: options.dir ? path.join(process.cwd(), options.dir) : process.cwd()
  // type: argv._[1] || 'up', // up | down
  // file: path.join(process.cwd(), argv._[0]) + '.js', // JS is the default file format
  // contents: undefined
};

const reverseKeys = (object) => {
  const keys = Object.keys(object).reverse();
  var newObject = {};
  
  keys.forEach(k => newObject[k] = object[k]);
  
  return newObject;
};

const listTables = () => ddb('listTables', {});

const scanTable = (tableName) => ddbClient('scan', {TableName: tableName});

const describeTable = (tableName) => ddb('describeTable', {TableName: tableName});

const clearDatabase = () => {
  return new Promise((resolve, reject) => {
      listTables()
      .then(res => {
      const tables = res.TableNames;
  
  if(!tables.length) return resolve('No tables to clear.');
  
  // console.log('Tables to delete: ', tables);
  
  deleteTablesRecursive(tables)
    .then(() => {
    schema = {};
  
  saveSchema(path.join(process.cwd(), options.schema))
    .then(() => resolve('Done deleting tables.'))
.catch(err => reject(`Error in saveSchema() > ${err}`));
})
.catch(err => reject(`Error in deleteTablesRecursive() > ${err}`));
})
.catch(err => reject(`Error in listTables() > ${err}`));
});
};

const deleteTable = (tableName) => ddb('deleteTable', {TableName: tableName});

const deleteTablesRecursive = (tableArray) => {
  return new Promise((resolve, reject) => {
      if(!tableArray.length) return resolve('No tables to clear.');
  
  const table = tableArray.pop();
  
  process.stdout.write(`Deleting table '${table}' ... `);
  
  deleteTable(table)
    .then(() => {
    console.log(`success.`);
  deleteTablesRecursive(tableArray)
    .then(() => resolve('Done deleting tables.'))
.catch(err => reject(`Error in deleteTablesRecursive() > ${err}`));
})
.catch(err => reject(`Error in deleteTable() > ${err}`));
});
};


// TODO: Extract functionality to load the contents from one file and use it with migrateVersion()
const buildMigrationList = (dir) => {
  return new Promise((resolve, reject) => {
      var result = {};
  
  fs.readdirAsync(dir)
    .then(files => {
    if(!files.length) return resolve('No files to migrate.');
  
  files.forEach(f => {
    const migrationNumber = f.split('_')[0];
  
  if(!migrationNumber.length) return reject(`Wrong file name for migration '${f}'`);
  if(!Number(migrationNumber)) return reject(`Migration identifier '${migrationNumber}' is not a number.`);
  
  // console.log(`Processing migration file '${f}'`);
  
  var migrationContents;
  
  try {
    migrationContents = require(path.join(dir, f)).default;
  } catch(err) {
    return reject(err);
  }
  
  if(!isObject(migrationContents)) return reject(`Could not find an object in 'default' export in migration '${f}'`);
  
  // if(!isArray(migrationList)) migrationList = [migrationList];
  
  // migrationList.forEach(migration => {
  result[migrationNumber] = migrationContents;
  // });
});
  
  resolve(result);
})
.catch(err => reject(`Could not find path '${dir}'`));
});
};

const migrateVersion = (dir, version, direction) => {
  return new Promise((resolve, reject) => {
      var list = {};
  
  fs.readdirAsync(dir)
    .then(files => {
    const versionFilename = filter(files, key => key.split('_')[0] === version)[0];
  
  if(!versionFilename) return reject(`Could not find migration file for '${version}'`)
  
  var migrationContents;
  
  try {
    migrationContents = require(path.join(dir, versionFilename)).default;
  } catch(err) {
    return reject(err);
  }
  
  if(!isObject(migrationContents)) return reject(`Could not find an object in 'default' export in migration '${versionFilename}'`);
  
  // if(!isArray(migrationList)) migrationList = [migrationList];
  
  // migrationList.forEach(migration => {
  list[version] = migrationContents;
  // });
  
  doMigrationRecursive(list, direction)
    .then(() => {
    saveSchema(path.join(process.cwd(), options.schema))
.then(() => resolve('Done executing migrations.'))
.catch(err => reject(`Error in saveSchema() > ${err}`));
})
.catch(err => reject(`Error in doMigrationRecursive() > ${err}`));
})
.catch(err => reject(`Could not find path '${dir}' ${err}`));
});
};

const migrateDatabase = (dir, direction) => {
  return new Promise((resolve, reject) => {
      buildMigrationList(dir)
      .then(migrationList => {
      if(!(Object.keys(migrationList).length)) return resolve('No migrations to execute.');
  if(direction === 'down') migrationList = reverseKeys(migrationList);
  
  // console.log(`Migrations to execute: `, Object.keys(migrationList)); // REMOVE ME
  
  doMigrationRecursive(migrationList, direction)
    .then(() => {
    saveSchema(path.join(process.cwd(), options.schema))
.then(() => resolve('Done executing migrations.'))
.catch(err => reject(`Error in saveSchema() > ${err}`));
})
.catch(err => reject(`Error in doMigrationRecursive() > ${err}`));
})
.catch(err => reject(`Error in buildMigrationList() > ${err}`));
});
};

const doMigration = (contents, key, direction) => {
  return new Promise((resolve, reject) => {
      if(!contents.method) return reject(`Did not find 'method' Key in migration '${key}'`);
  if(!contents.params) return reject(`Did not find 'params' Key in migration '${key}'`);
  if(!isString(contents.method)) return reject(`'method' Key in migration '${key}' is not a string`);
  if(!isObject(contents.params)) return reject(`'params' Key in migration '${key}' is not an object`);
  if(contents.documentClient && !isBoolean(contents.documentClient)) return reject(`'documentClient' value in migration '${key}' is not a boolean`);
  
  const method = contents.method;
  const params = contents.params;
  
  if(contents.documentClient) {
    ddbClient(method, params)
      .then(response => {
      if(direction === 'up') {
      addToSchema(key, response);
    } else {
      removeFromSchema(key);
    }
    
    resolve(response);
  })
  .catch(err => reject(err));
  } else {
    ddb(method, params)
      .then(response => {
      if(direction === 'up') {
      addToSchema(key, response);
    } else {
      removeFromSchema(key);
    }
    
    resolve(response);
  })
  .catch(err => reject(err));
  }
});
};

const doMigrationRecursive = (migrationList, direction) => {
  return new Promise((resolve, reject) => {
      const migrationKeys = Object.keys(migrationList);
  
  if(!(migrationKeys.length)) return resolve('No migrations to execute.');
  
  const migrationKey = migrationKeys[0];
  const migrationContents = Object.assign({}, (migrationList[migrationKey][direction] ? migrationList[migrationKey][direction] : migrationList[migrationKey]));
  
  delete(migrationList[migrationKey]);
  
  if(has(schema, migrationKey) && direction === 'up') {
    console.log(`Migration '${migrationKey}' already exists, skipping...`);
    
    doMigrationRecursive(migrationList, direction)
      .then(() => resolve('Done executing migrations.'))
  .catch(err => reject(`Error in doMigrationRecursive() > ${err}`));
  } else {
    process.stdout.write(`Migrating '${migrationKey}' ${direction} ... `);
    
    doMigration(migrationContents, migrationKey, direction)
      .then(() => {
      console.log(`success.`);
    
    doMigrationRecursive(migrationList, direction)
      .then(() => resolve('Done executing migrations.'))
  .catch(err => reject(`Error in doMigrationRecursive() > ${err}`));
  })
  .catch(err => reject(`Error in doMigration() > ${err}`));
  }
});
};

const buildSeedList = (seedPath) => {
  return new Promise((resolve, reject) => {
      var seedList;
  var index = 0;
  var result = {};
  
  try {
    seedList = require(seedPath).default;
  } catch(err) {
    reject(`Seed file '${seedPath}' not found. \n${err}`);
  }
  
  if(!isObject(seedList)) return reject(`Could not find an object in 'default' export in seed file '${seedPath}'`);
  
  if(!isArray(seedList)) seedList = [seedList];
  
  seedList.forEach(seed => {
    result[index++] = seed;
});
  
  resolve(result);
});
};

const seedDatabase = (dir, fileName) => {
  return new Promise((resolve, reject) => {
      const seedPath = path.join(dir, fileName);
  
  buildSeedList(seedPath)
    .then(seedList => {
    if(!(Object.keys(seedList).length)) return resolve('No seeds to execute.');
  
  doMigrationRecursive(seedList, 'up')
    .then(() => resolve('Done seeding the database.'))
.catch(err => reject(`Error in doMigrationRecursive() > ${err}`));
})
.catch(err => reject(`Error in buildSeedList() > ${err}`));
});
};

const setupDatabase = () => {
  return new Promise((resolve, reject) => {
      console.log('Migrating up the database...');
  
  migrateDatabase(migration.path, 'up')
    .then(() => {
    console.log('Seeding the database...');
  
  seedDatabase(process.cwd(), options.seed)
    .then(res => resolve(`Done setting up the database.`))
.catch(err => reject(`Error in seedDatabase() > ${err}`));
})
.catch(err => reject(`Error in migrateDatabase() > ${err}`));
});
};

const resetDatabase = () => {
  return new Promise((resolve, reject) => {
      console.log('Clearing the database...');
  
  clearDatabase()
    .then(() => {
    setupDatabase()
    .then(res => resolve(`Done resetting the database.`))
.catch(err => reject(`Error in setupDatabase() > ${err}`));
})
.catch(err => reject(`Error in clearDatabase() > ${err}`));
})
};

const addToSchema = (key, obj) => {
  schema[key] = obj;
};

const removeFromSchema = (key) => {
  if(schema[key]) delete schema[key];
};

const saveSchema = (dir) => {
  return new Promise((resolve, reject) => {
      fs.writeFileAsync(dir, JSON.stringify(schema, null, 2))
      .then(() => resolve())
.catch(err => reject(err))
})
};

const loadSchema = (dir) => {
  return new Promise((resolve, reject) => {
      fs.statAsync(dir)
      .then(() => {
      try {
        resolve(JSON.parse(fs.readFileSync(dir)));
} catch(err) {
    reject(err);
  }
})
.catch(err => resolve({}));
});
};

const getTimeHash = () => {
  const d = new Date();
  const methods = ['getFullYear', 'getMonth', 'getDate', 'getHours', 'getMinutes', 'getSeconds'];
  
  var result = '';
  
  methods.forEach(m => {
    var str = d[m]();
  
  if(m === 'getMonth') str += 1;
  
  str = String(str);
  
  if(str.length === 1) str = "0" + str;
  
  result = result + str;
});
  
  return result;
};

const createTable = (tableName, dir) => {
  return new Promise((resolve, reject) => {
      fs.readFileAsync(path.join(process.cwd(), 'templates', 'create.js'), 'utf8')
      .then((data) => {
      const fileName =
        `${getTimeHash()}_create_${tableName}.js`;
  
  fs.writeFileAsync(path.join(dir, fileName), template(data)({tableName}))
    .then(() => resolve(`Migration '${fileName}' created.`))
.catch(err => reject(`Error writing migration. \n${err}`));
})
.catch(err => reject(`Error reading template file. \n${err}`));
});
};

const createUpdate = (tableName, dir) => {
  return new Promise((resolve, reject) => {
      fs.readFileAsync(path.join(process.cwd(), 'templates', 'update.js'), 'utf8')
      .then((data) => {
      const fileName =
        `${getTimeHash()}_update_${tableName}.js`;
  
  fs.writeFileAsync(path.join(dir, fileName), template(data)({tableName}))
    .then(() => resolve(`Update '${fileName}' created.`))
.catch(err => reject(`Error writing update. \n${err}`));
})
.catch(err => reject(`Error reading template file. \n${err}`));
});
};

const handleCommands = () => {
  var migrationVersion;
  var tableName;
  
  switch (migration.command) {
    case 'clear':
      console.log('Clearing database...');
      
      clearDatabase()
        .then(res => {
        console.log(res);
      process.exit(0);
  })
.catch(err => {
    console.log('Error in clearDatabase() > ', err);
  process.exit(1);
});
  break;

case 'migrate:up':
case 'migrate':
  if(argv._[1] && argv._[1].split('=')[0] === 'version') {
    migrationVersion = argv._[1].split('=')[1];
    
    console.log(`Running migration '${migrationVersion}'`);
    
    migrateVersion(migration.path, migrationVersion, 'up')
      .then(res => {
      console.log(res);
    process.exit(0);
  })
  .catch(err => {
      console.log('Error in migrateDatabase() > ', err);
    process.exit(1);
  });
    
  } else {
    console.log('Running migrations...');
    
    migrateDatabase(migration.path, 'up')
      .then(res => {
      console.log(res);
    process.exit(0);
  })
  .catch(err => {
      console.log('Error in migrateDatabase() > ', err);
    process.exit(1);
  });
  }
  
  break;

case 'migrate:down':
  if(argv._[1] && argv._[1].split('=')[0] === 'version') {
    migrationVersion = argv._[1].split('=')[1];
    
    console.log(`Running migration '${migrationVersion}'`);
    
    migrateVersion(migration.path, migrationVersion, 'down')
      .then(res => {
      console.log(res);
    process.exit(0);
  })
  .catch(err => {
      console.log('Error in migrateDatabase() > ', err);
    process.exit(1);
  });
    
  } else {
    console.log('Running down migrations...');
    
    migrateDatabase(migration.path, 'down')
      .then(res => {
      console.log(res);
    process.exit(0);
  })
  .catch(err => {
      console.log('Error in migrateDatabase() > ', err);
    process.exit(1);
  });
  }
  
  break;

case 'seed':
  console.log('Seeding the database...');
  
  seedDatabase(process.cwd(), options.seed)
    .then(res => {
    console.log(res);
  process.exit(0);
})
.catch(err => {
    console.log('Error in seedDatabase() > ', err);
  process.exit(1);
});
  break;

case 'setup':
  console.log('Setting up the database (migrate -> seed)...');
  
  setupDatabase()
    .then(res => {
    console.log(res);
  process.exit(0);
})
.catch(err => {
    console.log('Error in setupDatabase() > ', err);
  process.exit(1);
});
  
  break;

case 'reset':
  console.log('Resetting the database (clear -> migrate -> seed)...');
  
  resetDatabase()
    .then(res => {
    console.log(res);
  process.exit(0);
})
.catch(err => {
    console.log('Error in resetDatabase() > ', err);
  process.exit(1);
});
  break;

case 'scan':
  scanTable(argv._[1])
    .then(res => {
    console.log(JSON.stringify(res, null, 2));
  process.exit(0);
})
.catch(err => {
    console.log('Error in scanTable() > ', err);
  process.exit(1);
});
  
  break;

case 'list':
  listTables()
    .then(res => {
    console.log(JSON.stringify(res, null, 2));
  process.exit(0);
})
.catch(err => {
    console.log('Error in listTables() > ', err);
  process.exit(1);
});
  
  break;

case 'describe':
  describeTable(argv._[1])
    .then(res => {
    console.log(JSON.stringify(res, null, 2));
  process.exit(0);
})
.catch(err => {
    console.log('Error in describeTable() > ', err);
  process.exit(1);
});
  
  break;

case 'create':
  tableName = argv._[1];
  
  if(!tableName) {console.log(`Please specify a table name.`);process.exit(0);}
  
  console.log(`Creating migration for table '${tableName}'`);
  
  createTable(tableName, migration.path)
    .then(res => {
    console.log(res);
  process.exit(0);
})
.catch(err => {
    console.log('Error in createTable() > ', err);
  process.exit(1);
});
  
  break;

case 'update':
  tableName = argv._[1];
  
  if(!tableName) {console.log(`Please specify a table name.`);process.exit(0);}
  
  console.log(`Creating update for table '${tableName}'`);
  
  createUpdate(tableName, migration.path)
    .then(res => {
    console.log(res);
  process.exit(0);
})
.catch(err => {
    console.log('Error in createUpdate() > ', err);
  process.exit(1);
});
  
  break;

case 'rollback':
  console.log(`Rolling back last migration...`);
  
  migrationVersion = Object.keys(schema).pop();
  
  if(!migrationVersion) {console.log(`There is no previous migration.`);process.exit(0);}
  
  migrateVersion(migration.path, migrationVersion, 'down')
    .then(res => {
    console.log(res);
  process.exit(0);
})
.catch(err => {
    console.log('Error in migrateDatabase() > ', err);
  process.exit(1);
});
  
  break;

default:
  console.log(`Unknown command.`);
  process.exit(1);
}
};

// Entry point
if(process.env.NODE_ENV !== 'test') {
  loadSchema(path.join(process.cwd(), options.schema))
    .then(res => {
      schema = res;
      
      handleCommands()
    })
    .catch(err => console.log(`Error in loadSchema() > ${err}`));
}
