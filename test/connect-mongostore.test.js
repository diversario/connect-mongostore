'use strict'

var assert = require('assert')
  , crypto = require('crypto')

var connect = require('connect')
  , mongoose = require('mongoose')
  , mongo = require('mongodb')
  , _ = require('lodash')

var MongoStore = require('../.')(connect)

var defaultOptions = {'w': 1, 'host': '127.0.0.1', 'port': 27017, 'autoReconnect': true, 'ssl': false}
  , dbName = 'connect-mongostore-test' 
  , collectionName = 'sessions'
  , defaultDbOptions = {'db': dbName}
  , expirationPeriod = 1000 * 60 * 60 * 24 * 14 // 2 weeks

var mongooseDb = {
    'mongooseConnection': mongoose.connect('mongodb://127.0.0.1:27017/' + dbName).connections[0]
    }

var mongoNativeDb = {
      'db': new mongo.Db(dbName, new mongo.Server('127.0.0.1', 27017, {}), {'w': defaultOptions.w})
    }

var replSetMember = {
  "host" : process.env.CM_REPL_SET_HOST || "192.168.1.225",
  "port" : -1,
  "options" : {
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

var replSetConfig = {
  "collection" : collectionName,
  "db": {
    "name" : dbName,
    "servers" : [
      getReplSetMember(27017),
      getReplSetMember(27018),
      getReplSetMember(27019)
    ],
    'replicaSetOptions' : {
      'rs_name' : 'rs0',
      'w': 'majority',
      'read_secondary': true
    }
  }
}


function getReplSetMember(port) {
  var config = JSON.parse(JSON.stringify(replSetMember))
  config.port = port
  return config
}


function dbFromMongooseConnection(mongooseConnection, opts) {
  if (mongooseConnection.user && mongooseConnection.pass) {
    opts.username = mongooseConnection.user
    opts.password = mongooseConnection.pass
  }

  return new mongo.Db(
    mongooseConnection.db.databaseName,
    new mongo.Server(mongooseConnection.db.serverConfig.host,
      mongooseConnection.db.serverConfig.port,
      mongooseConnection.db.serverConfig.options),
    { w: opts.w || defaultOptions.w }
  )
}


/**
 * Performs authentication, if credentials provided
 * @param db
 * @param options
 * @param cb
 */
function authenticate(db, options, cb) {
  if (options.username && options.password) {
    db.authenticate(options.username, options.password, cb)
  } else cb()
}



/**
 * Returns a collection reference
 * @param db
 * @param cb
 */
function getCollection(db, cb) {
  db.collection(collectionName, function (err, collection) {
    cb(err, collection)
  })
}



/**
 * Creates and opens a database instance
 * @param opts
 * @param cb
 * @returns {*}
 */
function openDatabase(opts, cb) {
  var db

  if (opts.mongooseConnection) {
    db = dbFromMongooseConnection(opts.mongooseConnection, opts)
  } else if (!opts.db) {
    throw new Error('Required MongoStore option `db` missing')
  } else if (typeof opts.db == 'object' && opts.db.databaseName) { // Assume it's an instantiated DB Object
    db = opts.db
  } else if (Array.isArray(opts.db.servers)) {
    var serverArray = [];

    opts.db.servers.forEach(function (server) {
      var serverOptions = server.options || {}
      var newServer = new mongo.Server(server.host, server.port, serverOptions)
      serverArray.push(newServer)
    })

    db = new mongo.Db(opts.db.name, new mongo.ReplSetServers(serverArray), opts.db.replicaSetOptions || {w: 0})
  } else if (typeof opts.db != 'string') {
    throw new Error('`db` option must be a string, array or a database instance.')
  } else {
    db = new mongo.Db(
      opts.db, new mongo.Server(
        opts.host || defaultOptions.host,
        opts.port || defaultOptions.port,
        {
          'auto_reconnect': opts.autoReconnect || defaultOptions.autoReconnect,
          'ssl': opts.ssl || defaultOptions.ssl
        }),
      {'w': opts.w || defaultOptions.w})
  }

  if (db.openCalled) return cb(db)
  
  db.open(function (err) {
    cb(db)
  })
}



/**
 * Returns instances of store, mongo-native database and
 * mongo-native collection.
 * @param options
 * @param cb
 */
function getInstances(options, cb) {
  var store = new MongoStore(options)
  openDatabase(options, function (db) {
    authenticate(db, options, function () {
      getCollection(db, function (err, coll) {
        cb(store, db, coll)
      })
    })
  })
}


function closeStore(store) {
  store.db.close()
}

function cleanup(store, db, collection, cb) {
  collection.drop(function (err, result) {
    db.close()
    closeStore(store)
    cb && cb()
  })
}


function getRandomString() {
  return crypto.randomBytes(16).toString('hex')
}


describe('Connect-mongostore', function () {
  function tests(ctorOptions, suiteCallback) {
    describe('Basic stuff:', function () {
      var store, db, collection

      function init(opts, done) {
        if (!done) {
          done = opts
          opts = [{}]
        }

        if (!Array.isArray(opts)) opts = [opts]

        opts.push(ctorOptions)

        var config = {}

        opts.forEach(function (opt) {
          _.extend(config, opt)
        })


        getInstances(config, function (_store, _db, _collection) {
          store = _store
          db = _db
          collection = _collection
          done()
        })
      }

      afterEach(function (done) {
        cleanup(store, db, collection, function () {
          done()
        })
      })
      
      it('after first call getCollection returns the cached collection', function (done) {
        init(function () {
          store.getCollection(function (coll) {
            assert(coll)
            
            coll.__JUST_TESTING = true
            
            store.getCollection(function (coll) {
              assert(coll)
              assert(coll.__JUST_TESTING)
              done()
            })            
          })
        })
      })
    })
    
    describe('Set', function () {
      var store, db, collection
    
      function init(opts, done) {
        if (!done) {
          done = opts
          opts = [{}]
        }
    
        if (!Array.isArray(opts)) opts = [opts]
    
        opts.push(ctorOptions)
    
        var config = {}
    
        opts.forEach(function (opt) {
          _.extend(config, opt)
        })
    
        
        getInstances(config, function (_store, _db, _collection) {
          store = _store
          db = _db
          collection = _collection
          done()
        })
      }
    
      afterEach(function (done) {
        cleanup(store, db, collection, function () {
          done()
        })
      })
      
      it('saves session as object', function (done) {
        init(function () {
          var sid = getRandomString()
            , s = {'test': getRandomString()}
            , date = new Date
          
          store.set(sid, s, function (err, session) {
            assert.strictEqual(err, null)
    
            collection.findOne({'_id': sid}, function (err, session) {
              assert(session.expires - date < expirationPeriod + 100)
              delete session.expires
              
              assert.deepEqual(session, {
                'session': s,
                '_id': sid
              })
              
    
              done()
            })
          })
        })
      })
    
      it('saves session as string', function (done) {
        init({'stringify': true}, function () {
          var sid = getRandomString()
            , s = {'test': getRandomString()}
            , date = new Date
          
          store.set(sid, s, function (err, session) {
            assert(!err)
      
            collection.findOne({'_id': sid}, function (err, session) {
              assert(session.expires - date < expirationPeriod + 100)
              delete session.expires
              
              assert.deepEqual(session, {
                'session': JSON.stringify(s),
                '_id': sid
              })
    
              done()
            })
          })
        })
      })
      
      it('saves session with expiration', function (done) {
        init(function () {
          var sid = getRandomString()
          var s = {
            'test': getRandomString(),
            'cookie': {
              '_expires': new Date
            }
          }
    
          store.set(sid, s, function (err, session) {
            assert.strictEqual(err, null)
    
            collection.findOne({'_id': sid}, function (err, session) {
              assert.deepEqual(session.session, s)
              assert.strictEqual(session._id, sid)
              assert.equal(session.expires.toJSON(), new Date(s.cookie._expires).toJSON())
    
              done()
            })
          })
        })
      })
      
      it('saves session with default expiration', function (done) {
        init(function () {
          var sid = getRandomString()
          var s = {
            'test': getRandomString(),
            'cookie': {}
          }

          store.set(sid, s, function (err, session) {
            assert.strictEqual(err, null)
            
            var expirationDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14) // two weeks

            collection.findOne({'_id': sid}, function (err, session) {
              assert.deepEqual(session.session, s)
              assert.strictEqual(session._id, sid)
              
              assert(expirationDate - session.expires < 1000) // a generous 1 second for stuff to run

              done()
            })
          })
        })
      })

      it('saves session with overriden default expiration', function (done) {
        init({'expireAfter': 10000}, function () {
          var sid = getRandomString()
          var s = {
            'test': getRandomString(),
            'cookie': {}
          }

          store.set(sid, s, function (err, session) {
            assert.strictEqual(err, null)

            var expirationDate = new Date(Date.now() + 10000) // two weeks

            collection.findOne({'_id': sid}, function (err, session) {
              assert.deepEqual(session.session, s)
              assert.strictEqual(session._id, sid)

              assert(expirationDate - session.expires < 1000) // a generous 1 second for stuff to run

              done()
            })
          })
        })
      })
    })
    
    
    
    
    describe('Get', function () {
      var store, db, collection
    
      function init(opts, done) {
        if (!done) {
          done = opts
          opts = [{}]
        }
    
        if (!Array.isArray(opts)) opts = [opts]
    
        opts.push(ctorOptions)
        
        var config = {}
    
        opts.forEach(function (opt) {
          _.extend(config, opt)
        })
    
        getInstances(config, function (_store, _db, _collection) {
          store = _store
          db = _db
          collection = _collection
          done()
        })
      }
    
      afterEach(function (done) {
        cleanup(store, db, collection, function () {
          done()
        })
      })
      
      it('gets session', function (done) {
        init(function () {
          var sid = getRandomString()
            , s = {'one': getRandomString(), 'two': {'three': getRandomString()}, 'four': 42}
          
          collection.insert({'_id': sid, 'session': s}, function (error, ids) {
            store.get(sid, function (err, session) {
              assert.deepEqual(session, s)
              done()
            })
          })
        })
      })

      it('gets non-existent session', function (done) {
        init(function () {
          var sid = getRandomString()

          store.get(sid, function (err, session) {
            assert(!err)
            assert(!session)
            done()
          })
        })
      })
      
      it('gets session as string', function (done) {
        init({stringify: true}, function () {
          var sid = getRandomString()
            , s = {'one': getRandomString(), 'two': {'three': getRandomString()}, 'four': 42}
          
          collection.insert({'_id': sid, 'session': JSON.stringify(s)}, function (error, ids) {
            store.get(sid, function (err, session) {
              assert.deepEqual(session, s)
              done()
            })
          })
        })
      })
      
      it('gets length', function (done) {
        init(function () {
          var sid = getRandomString()
            , s = {'one': getRandomString(), 'two': {'three': getRandomString()}, 'four': 42}
          
          collection.insert({'_id': sid, 'session': s}, function (error, ids) {
            store.length(function (err, length) {
              assert(!err)
              assert.strictEqual(length, 1)
              done()
            })
          })
        })
      })
      
      it('destroys a session', function (done) {
        init(function () {
          var sid = getRandomString()
            , s = {'one': getRandomString(), 'two': {'three': getRandomString()}, 'four': 42}
          
          collection.insert({'_id': sid, 'session': s}, function (error, ids) {
            store.destroy(sid, function (err) {
              assert(!err)
              done()
            })
          })
        })
      })
    
      it('clears all sessions', function (done) {
        init(function () {
          var sid = getRandomString()
            , s = {'one': getRandomString(), 'two': {'three': getRandomString()}, 'four': 42}
          
          collection.insert({'_id': sid, 'session': s}, function (error, ids) {
            store.clear(function (err) {
              collection.count(function (err, count) {
                assert.strictEqual(count, 0)
                done()
              })
            })
          })
        })
      })

      it('does not return expired session', function (done) {
        init(function () {
          var sid = getRandomString()
            , s = {'one': getRandomString(), 'two': {'three': getRandomString()}, 'four': 42}

          collection.insert({'_id': sid, 'session': s, 'expires': new Date(Date.now()-1000)}, function (err, saved) {
            assert.deepEqual(saved[0].session, s)
            store.get(sid, function (err, session) {
              assert(!session)
              done()
            })
          })
        })
      })
    })
    
    
    
    describe('Options', function () {
      after(suiteCallback)
      
      it('support string URL', function (done) {
        var store = new MongoStore('mongodb://127.0.0.1:27017/connect-mongostore-test/sessions')
        assert.strictEqual(store.db.databaseName, dbName)
        assert.strictEqual(store.db.serverConfig.host, '127.0.0.1')
        assert.equal(store.db.serverConfig.port, 27017)
    
        store.getCollection(function () {
          assert.equal(store.collection.collectionName, collectionName)
          closeStore(store)
          done()
        })
      })
    
      it('support string URL with auth', function (done) {
        var store = new MongoStore('mongodb://test:test@127.0.0.1:27017/connect-mongostore-test/sessions')
    
        assert.strictEqual(store.db.databaseName, dbName)
        assert.strictEqual(store.db.serverConfig.host, '127.0.0.1')
        assert.equal(store.db.serverConfig.port, 27017)
    
        store.getCollection(function () {
          assert.equal(store.collection.collectionName, collectionName)
          closeStore(store)
          done()
        })
      })
    
      it('require some sort of database option', function () {
        assert.throws(function () {
          new MongoStore({})
        }, /`db` missing/)

        assert.throws(function () {
          new MongoStore({'mongooseConnection': 'foobar'}, function () {})
        }, Error)
        
        assert.throws(function () {
          var store = new MongoStore({'db': {}})
          store.getCollection()
        }, /`db` option must be/)
      })
      
      it('support options object with URL', function (done) {
        var store = new MongoStore({
          'url': 'mongodb://test:test@127.0.0.1:27017/',
          'db': dbName,
          'collection': collectionName
        })
    
        assert.strictEqual(store.db.databaseName, dbName)
        assert.strictEqual(store.db.serverConfig.host, '127.0.0.1')
        assert.equal(store.db.serverConfig.port, 27017)
    
        store.getCollection(function () {
          assert.equal(store.collection.collectionName, collectionName)
          closeStore(store)
          done()
        })
      })
    })
  }

  tests(defaultDbOptions, function () {
    tests(mongoNativeDb, function () {
      tests(mongooseDb, function () {
        if (process.env.HAS_JOSH_K_SEAL_OF_APPROVAL != 'true') { // do not run replica set tests on Travis CI
          tests(replSetConfig, function () {
          })
        }
      })
    })
  })
})