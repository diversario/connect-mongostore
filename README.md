# connect-mongostore

  MongoDB session store for Connect

  [![Build Status](https://secure.travis-ci.org/diversario/connect-mongostore.png?branch=master)](http://travis-ci.org/diversario/connect-mongostore)
  [![Coverage Status](https://coveralls.io/repos/diversario/connect-mongostore/badge.png?branch=master)](https://coveralls.io/r/diversario/connect-mongostore?branch=master)
  [![Dependency Status](https://gemnasium.com/diversario/connect-mongostore.png)](https://gemnasium.com/diversario/connect-mongostore)
  [![NPM version](https://badge.fury.io/js/connect-mongostore.png)](http://badge.fury.io/js/connect-mongostore)
  
### Why?
  
  Existing stores work fine but we needed a store that supports replica sets configuration passed to it.

## Installation

connect-mongostore supports only connect `>= 1.0.3`.

via npm:

    $ npm install connect-mongostore

## Options

  Pass a fully-qualified URI as the only option (e.g., `mongodb://127.0.0.1:27017/myDatabase`), or an object (also see `examples` folder for configuration examples):

  - `db` Can be three different things:
    - database name (string)
    - mongo-native database instance
    - object with replica set options. These options requires:
    
      + `name` Database name
      + `servers` Array of replica set server configurations similar to:

          ```javascript
            {
              "host" : "127.0.0.1", // required
              "port" : 27017, // required
              "options" : { // all optional
                "autoReconnect" : false,
                "poolSize" : 200,
                "socketOptions" : {
                  "timeout" : 0,
                  "noDelay" : true,
                  "keepAlive" : 1,
                  "encoding" : "utf8"
                }
              }
            }
          ```
          Configuration options explained [here](http://mongodb.github.io/node-mongodb-native/markdown-docs/database.html)
      + `replicaSetOptions` An object with a single `rs_name` property specifying your replica set name
  - `collection` Collection (optional, default: `sessions`) 
  - `host` MongoDB server hostname (optional, default: `127.0.0.1`). Not needed for Replica Sets.
  - `port` MongoDB server port (optional, default: `27017`) Not needed for Replica Sets.
  - `username` Username (optional)
  - `password` Password (optional)
  - `expireAfter` Duration of session cookies in milliseconds (e.g., ones with `maxAge` not defined). Defaults to 2 weeks.
    May be useful if you see a lot of orphaned sessions in the database and want them removed sooner than 2 weeks.
  - `autoReconnect` This is passed directly to the MongoDB `Server` constructor as the auto_reconnect
                     option (optional, default: false).
  - `ssl` Use SSL to connect to MongoDB (optional, default: false).
  - `mongooseConnection` in the form: `mongooseDatabase.connections[0]` to use an existing mongoose connection. (optional)
  - `stringify` If false, connect-mongostore will serialize sessions using `JSON.stringify` before
                setting them, and deserialize them with `JSON.parse` when getting them.
                (optional, default: false). Note that deserialization will not revive Dates, Object IDs and other non-plain objects.

The second parameter to the `MongoStore` constructor is a callback which will be called once the database connection is established.
This is mainly used for the tests, however you can use this callback if you want to wait until the store has connected before
starting your app.

## Example

With express:

    var express = require('express');
    var MongoStore = require('connect-mongostore')(express);

    app.use(express.session({
        secret: 'my secret',
        store: new MongoStore({'db': 'sessions'})
      }));

With connect:

    var connect = require('connect');
    var MongoStore = require('connect-mongostore')(connect);

## Removing expired sessions

  connect-mongostore uses MongoDB's TTL collection feature (2.2+) to
  have mongod automatically remove expired sessions. (mongod runs this
  check every minute.)

  **Note:** By connect/express's default, session cookies are set to 
  expire when the user closes their browser (maxAge: null). In accordance
  with standard industry practices, connect-mongostore will set these sessions
  to expire two weeks from their last 'set'. You can override this 
  behavior by manually setting the maxAge for your cookies - just keep in
  mind that any value less than 60 seconds is pointless, as mongod will
  only delete expired documents in a TTL collection every minute.

  For more information, consult connect's [session documentation](http://www.senchalabs.org/connect/session.html).

## Tests

You need `mocha`.

    make test

The tests use a database called `connect-mongostore-test`. `make test` **does not** run replica set tests.

To run all tests including replica set tests:

    make test-rs

Note that replica set tests will fail unless you 1) have a replica set, and 2) set the address of that replica set either in `CM_REPL_SET_HOST` environment variable or directly in `connect-mongostore.test.js` file.

You can check code coverage report by running

    make coverage
    
or
    
    make coverage-rs
        
for coverage with replica set tests.
    
Coverage report will be in `reports/lcov-report/index.html` file.


## Stuff

Big thanks to @kcbanner and his `connect-mongo`, which was a starting point for `connect-mongostore`.

## License 

(The MIT License)


Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
