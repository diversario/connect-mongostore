# connect-mongostore

  MongoDB session store for Connect/Express

  [![Build Status](https://secure.travis-ci.org/diversario/connect-mongostore.png?branch=master)](http://travis-ci.org/diversario/connect-mongostore)
  [![Coverage Status](https://coveralls.io/repos/diversario/connect-mongostore/badge.png?branch=master)](https://coveralls.io/r/diversario/connect-mongostore?branch=master)
  [![Dependency Status](https://gemnasium.com/diversario/connect-mongostore.png)](https://gemnasium.com/diversario/connect-mongostore)
  [![NPM version](https://badge.fury.io/js/connect-mongostore.png)](http://badge.fury.io/js/connect-mongostore)
  [![Stories in Ready](https://badge.waffle.io/diversario/connect-mongostore.png?label=ready&title=Ready)](https://waffle.io/diversario/connect-mongostore)
  
### v1.0.0 Breaking API Change!
  
  Version 1.0.0 introduces use of MongoClient and attempts to simplify options object, therefore breaking backwards compatibility with pre-1.0.0 versions.

## Installation

connect-mongostore supports connect `>= 1.0.3`, express `3.x` and express `4.x` with express-session.

via npm:

    $ npm install connect-mongostore

## Options

  Pass a fully-qualified URI as the only option (e.g., `mongodb://127.0.0.1:27017/myDatabase`). 
  
  , or an object (also see `examples` folder for configuration examples):

```javascript
// Pass an instance of mongodb-native database
{
  db: <MongoDB Native DB instance>
}


// Pass Mongoose connection
{
  mongooseConnection: mongoose.connection[0]
}


// Pass an object with connection options
{
  databaseName: 'test',
  collection: 'session',  // optional
  host: '127.0.0.1',      // optional
  port: 27017,            // optional
  username: 'user',       // optional
  password: 'pass',       // optional
  authSource: {},         // options for `Db#authenticate` method (optional)
  expireAfter: 100000     // duration of session cookies in milliseconds (e.g., ones with `maxAge` not defined). Defaults to 2 weeks.
  serverOptions: {        // all optional
    "autoReconnect" : false,
    "poolSize" : 200,
    "socketOptions" : {
      "timeout" : 0,
      "noDelay" : true,
      "keepAlive" : 1,
      "encoding" : "utf8"
    }
  },
  stringify: false        // If false, connect-mongostore will serialize sessions using `JSON.stringify` before
                          // setting them, and deserialize them with `JSON.parse` when getting them.
                          // (optional, default: false). Note that deserialization will not revive Dates, Object IDs and other non-plain objects.
}

// Object with replica set configuration

{
  databaseName: 'test',
  servers: [
    {
      host: '127.0.0.1', // optional
      port: 27017,       // optional,
      options: {}        // see serverOptions above
    },
    {}
  ],
  username: 'user',    // optional
  password: 'pass',    // optional
  autoReconnect: true, // optional
  ssl: false,          // optional
  replSet: {           // optional
    rs_options: {
      w: 1
    }
  }
}
```


## Example

With express 3.x:

    var express = require('express');
    var MongoStore = require('connect-mongostore')(express);
    var app = express();
    
    app.use(express.session({
        secret: 'my secret',
        store: new MongoStore({'databaseName': 'sessions'})
      }));

With express 4.x:

    var express = require('express');
    var session = require('express-session');
    var MongoStore = require('connect-mongostore')(session);
    var app = express();

    app.use(session({
        secret: 'my secret',
        store: new MongoStore({'databaseName': 'sessions'})
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
