ddb-migrate
===========
[![Travis build](https://img.shields.io/travis/sdelrio0/ddb-migrate.svg?style=flat)](https://travis-ci.org/sdelrio0/ddb-migrate)
[![Codecov coverage](https://img.shields.io/codecov/c/github/sdelrio0/ddb-migrate.svg?style=flat)]()
[![npm version](https://img.shields.io/npm/v/ddb-migrate.svg?style=flat)]()
[![npm licence](https://img.shields.io/npm/l/ddb-migrate.svg?style=flat)](https://en.wikipedia.org/wiki/MIT_License)

AWS DynamoDB Migration Tools for Node.js

**Under development. Not intended for production use.**

Introduction
============


Getting Started
===============


Usage
=====
```
$ ddb migrate # runs all migrations *up* sequentially
$ ddb migrate:up # same as above
$ ddb clear # deletes all tables
$ ddb seed # executes seeds
$ ddb setup # migrate -> seed
$ ddb reset # clear -> setup
$ ddb migrate VERSION=YYYYMMDDHHMMSS # migrates only this version *up*
$ ddb migrate:up VERSION=YYYYMMDDHHMMSS # same as above
$ ddb migrate:down VERSION=YYYYMMDDHHMMSS # migrates only this version *down*
$ ddb migrate:down # migrates all versions backwards and *down*
$ ddb rollback # last migration *down*
$ ddb create tableName
$ ddb update tableName
$ ddb describe tableName
$ ddb list
$ ddb scan tableName
```

MIT Licence
===========

Copyright (c) 2016 Sergio del Rio


Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.