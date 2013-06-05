'use strict'

var assert = require('assert')
  , crypto = require('crypto')

var connect = require('connect')
  , mongoose = require('mongoose')
  , mongo = require('mongodb')
  , _ = require('lodash')

var MongoStore = require('../.')(connect)

var defaultOptions = {w: 1}
  , dbName = 'connect-mongostore-test' 
  , collectionName = 'sessions-test'
  , options = {db: dbName}

var mongooseDb = {'mongooseConnection': mongoose.connect('mongodb://127.0.0.1:27017/' + dbName).connections[0]}
  , mongoNativeDb = {'db': new mongo.Db(dbName, new mongo.Server('127.0.0.1', 27017, {}), {'w': defaultOptions.w})}



/**
 * Performs authentication, if credentials provided
 * @param db
 * @param options
 * @param cb
 */
function authenticate(db, options, cb) {
  if (options.username && options.password) {
    db.authenticate(options.username, options.password, cb)
  } else cb();
}



/**
 * Returns a collection reference
 * @param db
 * @param cb
 */
function getCollection(db, cb) {
  db.collection('sessions', function (err, collection) {
    cb(err, collection)
  })
}



/**
 * Creates and opens a database instance
 * @param options
 * @param cb
 * @returns {*}
 */
function openDatabase(options, cb) {
  var db

  if (options.mongooseConnection) {
    db = new mongo.Db(
      options.mongooseConnection.db.databaseName, 
      new mongo.Server(
        options.mongooseConnection.db.serverConfig.host,
        options.mongooseConnection.db.serverConfig.port,
        options.mongooseConnection.db.serverConfig.options
      ),
      {w: options.w || defaultOptions.w})
  } else if (typeof options.db == "object") {
    db = options.db
  } else {
    db = new mongo.Db(
      options.db, 
      new mongo.Server(
        '127.0.0.1',
        27017, 
        {}
      ),
      {w: options.w || defaultOptions.w})
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
  var store = new MongoStore(options);
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
  });
}


function getRandomString() {
  return crypto.randomBytes(16).toString('hex')
}


describe('Connect-mongostore', function () {
  function tests(ctorOptions, suiteCallback) {
    describe('Set', function () {
      var store, db, collection
    
      function init(opts, done) {
        if (!done) {
          done = opts
          opts = [{}]
        }
    
        if (!Array.isArray(opts)) opts = [opts]
    
        opts.push(ctorOptions)
    
        var config = {};
    
        opts.forEach(function (opt) {
          _.extend(config, opt);
        })
    
        
        getInstances(config, function (_store, _db, _collection) {
          store = _store
          db = _db
          collection = _collection
          done()
        });
      }
    
      afterEach(function (done) {
        cleanup(store, db, collection, function () {
          done()
        });
      })
      
      it('saves session as object', function (done) {
        init(function () {
          var sid = getRandomString()
            , s = {'test': getRandomString()}
          
          store.set(sid, s, function (err, session) {
            assert.strictEqual(err, null)
    
            collection.findOne({_id: sid}, function (err, session) {
              assert.deepEqual(session, {
                session: s,
                _id: sid
              });
    
              done()
            })
          })
        })
      })
    
      it('saves session as string', function (done) {
        init({stringify: true}, function () {
          var sid = getRandomString()
            , s = {'test': getRandomString()}
          
          store.set(sid, s, function (err, session) {
            assert(!err)
      
            collection.findOne({_id: sid}, function (err, session) {
              assert.deepEqual(session, {
                session: JSON.stringify(s),
                _id: sid
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
            test: getRandomString(),
            cookie: {
              _expires: new Date
            }
          }
    
          store.set(sid, s, function (err, session) {
            assert.strictEqual(err, null)
    
            collection.findOne({_id: sid}, function (err, session) {
              assert.deepEqual(session.session, s)
              assert.strictEqual(session._id, sid)
              assert.equal(session.expires.toJSON(), new Date(s.cookie._expires).toJSON())
    
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
    
        var config = {'db': options.db}
    
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
            , s = {'one': getRandomString(), two: {three: getRandomString()}, four: 42}
          
          collection.insert({_id: sid, session: s}, function (error, ids) {
            store.get(sid, function (err, session) {
              assert.deepEqual(session, s);
              done()
            });
          });
        })
      })
    
      it('gets session as string', function (done) {
        init({stringify: true}, function () {
          var sid = getRandomString()
            , s = {'one': getRandomString(), two: {three: getRandomString()}, four: 42}
          
          collection.insert({_id: sid, session: JSON.stringify(s)}, function (error, ids) {
            store.get(sid, function (err, session) {
              assert.deepEqual(session, s);
              done()
            });
          });
        })
      })
      
      it('gets length', function (done) {
        init(function () {
          var sid = getRandomString()
            , s = {'one': getRandomString(), two: {three: getRandomString()}, four: 42}
          
          collection.insert({_id: sid, session: s}, function (error, ids) {
            store.length(function (err, length) {
              assert.strictEqual(err, null);
              assert.strictEqual(length, 1);
              done()
            });
          });
        })
      })
      
      it('destroys a session', function (done) {
        init(function () {
          var sid = getRandomString()
            , s = {'one': getRandomString(), two: {three: getRandomString()}, four: 42}
          
          collection.insert({_id: sid, session: s}, function (error, ids) {
            store.destroy(sid, function (err) {
              assert.strictEqual(err, undefined);
              done()
            });
          });
        })
      })
    
      it('clears all sessions', function (done) {
        init(function () {
          var sid = getRandomString()
            , s = {'one': getRandomString(), two: {three: getRandomString()}, four: 42}
          
          collection.insert({_id: sid, session: s}, function (error, ids) {
            store.clear(function (err) {
              collection.count(function (err, count) {
                assert.strictEqual(count, 0);
                done()
              });
            });
          });
        })
      })
    })
    
    
    
    describe('Options', function () {
      after(suiteCallback)
      
      it('support string URL', function (done) {
        var store = new MongoStore('mongodb://127.0.0.1:27017/connect-mongostore-test/sessions-test');
        assert.strictEqual(store.db.databaseName, dbName);
        assert.strictEqual(store.db.serverConfig.host, '127.0.0.1');
        assert.equal(store.db.serverConfig.port, 27017);
    
        store.getCollection(function () {
          assert.equal(store.collection.collectionName, collectionName);
          closeStore(store);
          done();
        })
      })
    
      it('support string URL with auth', function (done) {
        var store = new MongoStore('mongodb://test:test@127.0.0.1:27017/connect-mongostore-test/sessions-test');
    
        assert.strictEqual(store.db.databaseName, dbName);
        assert.strictEqual(store.db.serverConfig.host, '127.0.0.1');
        assert.equal(store.db.serverConfig.port, 27017);
    
        store.getCollection(function () {
          assert.equal(store.collection.collectionName, collectionName);
          closeStore(store);
          done();
        });
      })
    
      it('require some sort of database option', function () {
        assert.throws(function () {
          new MongoStore({});
        }, /`db` missing/);

        assert.throws(function () {
          new MongoStore({mongooseConnection: 'foobar'}, function () {});
        }, Error);
        
        assert.throws(function () {
          var store = new MongoStore({db: {}});
          store.getCollection();
        }, /no method/);
      })
      
      it('support options object with URL', function (done) {
        var store = new MongoStore({
          url: 'mongodb://test:test@127.0.0.1:27017/',
          db: dbName,
          collection: collectionName
        });
    
        assert.strictEqual(store.db.databaseName, dbName);
        assert.strictEqual(store.db.serverConfig.host, '127.0.0.1');
        assert.equal(store.db.serverConfig.port, 27017);
    
        store.getCollection(function () {
          assert.equal(store.collection.collectionName, collectionName);
          closeStore(store);
          done();
        })
      })
    })
  }

  tests(options, function () {
    tests(mongoNativeDb, function () {
      tests(mongooseDb, function () {
      })
    })
  })
})