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
 * [x] ddb migrate NODE_ENV=test
 * [x] ddb create tableName
 * [x] ddb update tableName
 * [x] ddb describe tableName
 * [x] ddb list
 * [x] ddb scan tableName
 * [] ddb rollback STEP=X # last X migrations *down*
 * [] ddb delete # Deletes table
 */

import Promise from 'bluebird';
import path from 'path';
import { isArray, isObject, isBoolean, isString, has, filter, template } from 'underscore';

import { ddb, ddbClient, argv, options } from './core';
// import { buildMigrationList, migrateVersion, migrateDatabase, doMigration, doMigrationRecursive } from './migrations';
import { reverseKeys, getTimeHash } from './utils'

const fs = Promise.promisifyAll(require('fs'));

let schema = {};

const migration = {
  command: argv._[0],
  path: options.dir ? path.join(process.cwd(), options.dir) : process.cwd()
};

// MIGRATIONS

// TODO: Extract functionality to load the contents from one file and use it with migrateVersion()
const buildMigrationList = (dir) => new Promise((resolve, reject) => {
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
        
        result[migrationNumber] = migrationContents;
      });
      
      resolve(result);
    })
    .catch(err => reject(`Could not find path '${dir}'`));
});

const migrateVersion = (dir, version, direction) => new Promise((resolve, reject) => {
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
      
      list[version] = migrationContents;
      
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

const migrateDatabase = (dir, direction) => new Promise((resolve, reject) => {
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

const doMigration = (contents, key, direction) => new Promise((resolve, reject) => {
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

const doMigrationRecursive = (migrationList, direction) => new Promise((resolve, reject) => {
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

// TABLES
const listTables = () => ddb('listTables', {});

const scanTable = (tableName) => ddbClient('scan', {TableName: tableName});

const describeTable = (tableName) => ddb('describeTable', {TableName: tableName});

const deleteTable = (tableName) => ddb('deleteTable', {TableName: tableName});

const deleteTablesRecursive = (tableArray) => new Promise((resolve, reject) => {
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


// DATABASE
const clearDatabase = () => new Promise((resolve, reject) => {
  listTables()
    .then(res => {
      const tables = res.TableNames;
  
      if(!tables.length) return resolve('No tables to clear.');
    
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

const setupDatabase = () => new Promise((resolve, reject) => {
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

// SEEDS
const buildSeedList = (seedPath) => new Promise((resolve, reject) => {
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

const seedDatabase = (dir, fileName) => new Promise((resolve, reject) => {
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

// SCHEMA
const addToSchema = (key, obj) => {
  schema[key] = obj;
};

const removeFromSchema = (key) => {
  if(schema[key]) delete schema[key];
};

const saveSchema = (dir) => new Promise((resolve, reject) => {
  fs.writeFileAsync(dir, JSON.stringify(schema, null, 2))
    .then(() => resolve())
    .catch(err => reject(err))
});

const loadSchema = (dir) => new Promise((resolve, reject) => {
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

// TEMPLATES
// @todo: Create directory if it doesn't exist.
const createTable = (tableName, dir) => new Promise((resolve, reject) => {
  fs.readFileAsync(path.join(process.cwd(), 'templates', 'create.js'), 'utf8')
    .then((data) => {
      const fileName = `${getTimeHash()}_create_${tableName}.js`;
  
      fs.writeFileAsync(path.join(dir, fileName), template(data)({tableName}))
        .then(() => resolve(`Table '${fileName}' created.`))
        .catch(err => reject(`Error writing table. \n${err}`));
      })
    .catch(err => reject(`Error reading template file. \n${err}`));
});

const createUpdate = (tableName, dir) => new Promise((resolve, reject) => {
  fs.readFileAsync(path.join(process.cwd(), 'templates', 'update.js'), 'utf8')
    .then((data) => {
      const fileName = `${getTimeHash()}_update_${tableName}.js`;
  
      fs.writeFileAsync(path.join(dir, fileName), template(data)({tableName}))
        .then(() => resolve(`Update '${fileName}' created.`))
        .catch(err => reject(`Error writing update. \n${err}`));
      })
    .catch(err => reject(`Error reading template file. \n${err}`));
});

// CORE
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
      
      console.log(`Generating table migration '${tableName}'`);
      
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
      process.exit(0);
    }
};

if(process.env.NODE_ENV !== 'test') {
  // Entry point
  loadSchema(path.join(process.cwd(), options.schema))
    .then(res => {
      schema = res;
      
      handleCommands()
    })
    .catch(err => console.log(`Error in loadSchema() > ${err}`));
}