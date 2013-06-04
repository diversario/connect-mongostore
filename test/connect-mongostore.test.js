'use strict'

var assert = require('assert');

var connect = require('connect')
  , mongoose = require('mongoose')
  , mongo = require('mongodb')
  , _ = require('lodash')

var MongoStore = require('../.')(connect)

var defaultOptions = {w: 1}
  , dbName = 'connect-mongostore-test' 
  , options = {db: dbName}

var testMongooseDb = mongoose.connect('mongodb://127.0.0.1:27017/' + dbName)
  , mongooseDb = {'mongoose_connection': testMongooseDb.connections[0]}
  , testMongoNativeDb = new mongo.Db(dbName, new mongo.Server('127.0.0.1', 27017, {}), { w: defaultOptions.w })
  , mongoNativeDb = {db: testMongoNativeDb}



function authenticate(store, db, options, callback) {
  if (options.username && options.password) {
    db.authenticate(options.username, options.password, function () {
      db.collection('sessions', function (err, collection) {
        callback(store, db, collection)
      })
    })
  } else {
    db.collection('sessions', function (err, collection) {
      callback(store, db, collection)
    });
  }
}



function openDb(options, callback) {
  var store = new MongoStore(options)
    , db

  if (options.mongoose_connection) {
    db = new mongo.Db(
      options.mongoose_connection.db.databaseName, 
      new mongo.Server(
        options.mongoose_connection.db.serverConfig.host,
        options.mongoose_connection.db.serverConfig.port,
        options.mongoose_connection.db.serverConfig.options
      ),
      { w: options.w || defaultOptions.w })
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
      { w: options.w || defaultOptions.w })
  }

  if (db.openCalled) {
    authenticate(store, db, options, callback)
  } else {
    db.open(function (err) {
      authenticate(store, db, options, callback)
    })
  }
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


describe('Set', function () {
  var store, db, collection

  function init(opts, done) {
    if (!done) {
      done = opts
      opts = {}
    }
    
    var config = {'db': options.db}
    _.extend(config, opts)
    
    openDb(config, function (_store, _db, _collection) {
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
      var sid = 'test_set-sid'
      store.set(sid, {foo: 'bar'}, function (err, session) {
        assert.strictEqual(err, null)

        collection.findOne({_id: sid}, function (err, session) {
          assert.deepEqual(session, {
            session: {foo: 'bar'},
            _id: sid
          });

          done()
        })
      })
    })
  })

  it('saves session as string', function (done) {
    init({stringify: true}, function () {
      var sid = 'test_set-sid'
      store.set(sid, {foo: 'bar'}, function (err, session) {
        assert(!err)
  
        collection.findOne({_id: sid}, function (err, session) {
          assert.deepEqual(session, {
            session: JSON.stringify({foo: 'bar'}),
            _id: sid
          })

          done()
        })
      })
    })
  })
  
  it('saves session with expiration', function (done) {
    init(function () {
      var sid = 'test_set_expires-sid';
      var data = {
        foo: 'bar',
        cookie: {
          _expires: '2011-04-26T03:10:12.890Z'
        }
      };

      store.set(sid, data, function (err, session) {
        assert.strictEqual(err, null);

        collection.findOne({_id: sid}, function (err, session) {
          assert.deepEqual(session.session, data);
          assert.strictEqual(session._id, sid);
          assert.equal(session.expires.toJSON(), new Date(data.cookie._expires).toJSON());

          done();
        });
      });
    })
  })
})




describe('Get', function () {
  var store, db, collection;

  function init(opts, done) {
    if (!done) {
      done = opts
      opts = [{}]
    }

    if (!Array.isArray(opts)) opts = [opts]

    var config = {'db': options.db};

    opts.forEach(function (opt) {
      _.extend(config, opt);
    })

    openDb(config, function (_store, _db, _collection) {
      store = _store
      db = _db
      collection = _collection
      done()
    });
  }

  afterEach(function (done) {
    cleanup(store, db, collection, function () {
      done();
    });    
  })
  
  it('gets session', function (done) {
    init(function () {
      var sid = 'test_get-sid';
      collection.insert({_id: sid, session: {key1: 1, key2: 'two'}}, function (error, ids) {
        store.get(sid, function (err, session) {
          assert.deepEqual(session, {key1: 1, key2: 'two'});
          done()
        });
      });
    })
  })

  it('gets session as string', function (done) {
    init({stringify: true}, function () {
      var sid = 'test_get-sid';
      collection.insert({_id: sid, session: JSON.stringify({key1: 1, key2: 'two'})}, function (error, ids) {
        store.get(sid, function (err, session) {
          assert.deepEqual(session, {key1: 1, key2: 'two'});
          done()
        });
      });
    })
  })
  
  it('gets length', function (done) {
    init(function () {
      var sid = 'test_length-sid';
      collection.insert({_id: sid, session: {key1: 1, key2: 'two'}}, function (error, ids) {
        store.length(function (err, length) {
          assert.strictEqual(err, null);
          assert.strictEqual(length, 1);
          done()
        });
      });
    })
  })
  
  it('destroys expired session', function (done) {
    init(function () {
      var sid = 'test_destroy_ok-sid';
      collection.insert({_id: sid, session: {key1: 1, key2: 'two'}}, function (error, ids) {
        store.destroy(sid, function (err) {
          assert.strictEqual(err, undefined);
          done()
        });
      });
    })
  })

  it('clears all sessions', function (done) {
    init(function () {
      var sid = 'test_length-sid';
      collection.insert({_id: sid, key1: 1, key2: 'two'}, function (error, ids) {
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
  it('support string URL', function (done) {
    var store = new MongoStore('mongodb://127.0.0.1:27017/connect-mongo-test/sessions-test');
    assert.strictEqual(store.db.databaseName, 'connect-mongo-test');
    assert.strictEqual(store.db.serverConfig.host, '127.0.0.1');
    assert.equal(store.db.serverConfig.port, 27017);

    store.getCollection(function () {
      assert.equal(store.collection.collectionName, 'sessions-test');
      closeStore(store);
      done();
    })
  })

  it('support string URL with auth', function (done) {
    var store = new MongoStore('mongodb://test:test@127.0.0.1:27017/connect-mongo-test/sessions-test');

    assert.strictEqual(store.db.databaseName, 'connect-mongo-test');
    assert.strictEqual(store.db.serverConfig.host, '127.0.0.1');
    assert.equal(store.db.serverConfig.port, 27017);

    store.getCollection(function () {
      assert.equal(store.collection.collectionName, 'sessions-test');
      closeStore(store);
      done();
    });
  })

  it('require some sort of database option', function () {
    assert.throws(function () {
      new MongoStore({});
    }, /`db` missing/);
  })
  
  it('support options object with URL', function (done) {
    var store = new MongoStore({
      url: 'mongodb://test:test@127.0.0.1:27017/',
      db: 'connect-mongo-test',
      collection: 'sessions-test'
    });

    assert.strictEqual(store.db.databaseName, 'connect-mongo-test');
    assert.strictEqual(store.db.serverConfig.host, '127.0.0.1');
    assert.equal(store.db.serverConfig.port, 27017);

    store.getCollection(function () {
      assert.equal(store.collection.collectionName, 'sessions-test');
      closeStore(store);
      done();
    })
  })
})



describe('Set with existing database instance', function () {
  var store, db, collection;

  function init(opts, done) {
    if (!done) {
      done = opts
      opts = [{}]
    }

    if (!Array.isArray(opts)) opts = [opts]
    
    var config = {'db': options.db};
    
    opts.forEach(function (opt) {
      _.extend(config, opt);
    })

    openDb(config, function (_store, _db, _collection) {
      store = _store
      db = _db
      collection = _collection
      done()
    });
  }

  afterEach(function (done) {
    cleanup(store, db, collection, function () {
      done()
    })
  })
  
  it('set works', function (done) {
    init(mongooseDb, function () {
      var sid = 'test_set-sid';
      store.set(sid, {foo: 'bar'}, function (err, session) {
        assert.strictEqual(err, null);

        // Verify it was saved
        collection.findOne({_id: sid}, function (err, session) {
          assert.deepEqual(session, {
            session: {foo: 'bar'},
            _id: sid
          });

          done();
        });
      });
    })
  })

  it('set works with stringify', function (done) {
    init([mongooseDb, {stringify: true}], function() {
      var sid = 'test_set-sid';
      store.set(sid, {foo: 'bar'}, function (err, session) {
        assert.strictEqual(err, null);

        // Verify it was saved
        collection.findOne({_id: sid}, function (err, session) {
          assert.deepEqual(session, {
            session: JSON.stringify({foo: 'bar'}),
            _id: sid
          });

          done();
        });
      });
    })
  })
  
  it('set expires', function (done) {
    init(mongooseDb, function () {
      var sid = 'test_set_expires-sid';
      var data = {
        foo: 'bar',
        cookie: {
          _expires: '2011-04-26T03:10:12.890Z'
        }
      };

      store.set(sid, data, function (err, session) {
        assert.strictEqual(err, null);

        // Verify it was saved
        collection.findOne({_id: sid}, function (err, session) {
          assert.deepEqual(session.session, data);
          assert.strictEqual(session._id, sid);
          assert.equal(session.expires.toJSON(), new Date(data.cookie._expires).toJSON());

          done();
        });
      });
    })
  })
})





describe('Get with existing database instance', function () {
  var store, db, collection;

  function init(opts, done) {
    if (!done) {
      done = opts
      opts = [{}]
    }

    if (!Array.isArray(opts)) opts = [opts]

    var config = {'db': options.db};

    opts.forEach(function (opt) {
      _.extend(config, opt);
    })

    openDb(config, function (_store, _db, _collection) {
      store = _store
      db = _db
      collection = _collection
      done()
    });
  }
  
  afterEach(function (done) {
    cleanup(store, db, collection, function () {
      done()
    })
  })
  
  it('gets', function (done) {
    init(mongooseDb, function () {
      var sid = 'test_get-sid';
      collection.insert({_id: sid, session: {key1: 1, key2: 'two'}}, function (error, ids) {
        store.get(sid, function (err, session) {
          assert.strictEqual(err, null);
          assert.deepEqual(session, {key1: 1, key2: 'two'});

          done()
        });
      });
    })
  })

  it('gets length', function (done) {
    init(mongooseDb, function () {
      var sid = 'test_length-sid';
      collection.insert({_id: sid, session: {key1: 1, key2: 'two'}}, function (error, ids) {
        store.length(function (err, length) {
          assert.strictEqual(err, null);
          assert.strictEqual(length, 1);

          done()
        });
      });
    })
  })
  
  it('destroys expired session', function (done) {
    init(mongooseDb, function () {
      var sid = 'test_destroy_ok-sid';
      collection.insert({_id: sid, session: {key1: 1, key2: 'two'}}, function (error, ids) {
        store.destroy(sid, function (err) {
          assert.strictEqual(err, undefined);

          done()
        });
      });
    });
  })
  
  it('clears sessions', function (done) {
    init(mongooseDb, function () {
      var sid = 'test_length-sid';
      collection.insert({_id: sid, key1: 1, key2: 'two'}, function (error, ids) {
        store.clear(function (err) {
          collection.count(function (err, count) {
            assert.strictEqual(err, null);
            assert.strictEqual(count, 0);

            done()
          });
        });
      });
    })
  })
  
  it('throws on invalid DB option', function () {
    assert.throws(function () {
      new MongoStore({mongoose_connection: 'foobar'}, function () {});
    }, Error);
  })
})



describe('Set with existing database instance', function () {
  var store, db, collection;

  function init(opts, done) {
    if (!done) {
      done = opts
      opts = [{}]
    }

    if (!Array.isArray(opts)) opts = [opts]

    opts.push(mongoNativeDb)

    var config = {};
    
    opts.forEach(function (opt) {
      _.extend(config, opt);
    })

    openDb(config, function (_store, _db, _collection) {
      store = _store
      db = _db
      collection = _collection
      done()
    });
  }

  afterEach(function (done) {
    cleanup(store, db, collection, function () {
      done();
    });
  })
  
  it('saves objects', function (done) {
    init(function () {
      var sid = 'test_set-sid';
      store.set(sid, {foo: 'bar'}, function (err, session) {
        assert.strictEqual(err, null);

        // Verify it was saved
        collection.findOne({_id: sid}, function (err, session) {
          assert.deepEqual(session, {
            session: {foo: 'bar'},
            _id: sid
          });

          done();
        });
      });
    })
  })
  
  it('saves strings', function (done) {
    init({stringify: true}, function () {
      var sid = 'test_set-sid';
      store.set(sid, {foo: 'bar'}, function (err, session) {
        assert.strictEqual(err, null);

        // Verify it was saved
        collection.findOne({_id: sid}, function (err, session) {
          assert.deepEqual(session, {
            session: JSON.stringify({foo: 'bar'}),
            _id: sid
          });

          done();
        });
      });
    })
  })
  
  it('sets expiration', function (done) {
    init(function () {
      var sid = 'test_set_expires-sid';
      var data = {
        foo: 'bar',
        cookie: {
          _expires: '2011-04-26T03:10:12.890Z'
        }
      };

      store.set(sid, data, function (err, session) {
        assert.strictEqual(err, null);

        // Verify it was saved
        collection.findOne({_id: sid}, function (err, session) {
          assert.deepEqual(session.session, data);
          assert.strictEqual(session._id, sid);
          assert.equal(session.expires.toJSON(), new Date(data.cookie._expires).toJSON());

          done();
        });
      });
    })
  })
})



describe('Get with mongo-native instance', function () {
  var store, db, collection;
  
  function init(opts, done) {
    if (!done) {
      done = opts
      opts = [{}]
    }

    if (!Array.isArray(opts)) opts = [opts]

    opts.push(mongoNativeDb)

    var config = {};

    opts.forEach(function (opt) {
      _.extend(config, opt);
    })

    openDb(config, function (_store, _db, _collection) {
      store = _store
      db = _db
      collection = _collection
      done()
    });
  }
  
  afterEach(function (done) {
    cleanup(store, db, collection, function () {
      done();
    });
  })
  
  it('gets session', function (done) {
    init(function () {
      var sid = 'test_get-sid';
      collection.insert({_id: sid, session: {key1: 1, key2: 'two'}}, function (error, ids) {
        store.get(sid, function (err, session) {
          assert.strictEqual(err, null);
          assert.deepEqual(session, {key1: 1, key2: 'two'});

          done()
        });
      });
    })
  })
  
  it('gets session count', function (done) {
    init(function () {
      var sid = 'test_length-sid';
      collection.insert({_id: sid, session: {key1: 1, key2: 'two'}}, function (error, ids) {
        store.length(function (err, length) {
          assert.strictEqual(err, null);
          assert.strictEqual(length, 1);

          done()
        });
      });
    })
  })
  
  it('destroys sessions', function (done) {
    init(function () {
      var sid = 'test_destroy_ok-sid';
      collection.insert({_id: sid, session: {key1: 1, key2: 'two'}}, function (error, ids) {
        store.destroy(sid, function (err) {
          assert.strictEqual(err, undefined);

          done()
        });
      });
    })
  })

  it('clears sessions', function (done) {
    init(function () {
      var sid = 'test_length-sid';
      collection.insert({_id: sid, key1: 1, key2: 'two'}, function (error, ids) {
        store.clear(function (err) {
          collection.count(function (err, count) {
            assert.strictEqual(err, null);
            assert.strictEqual(count, 0);
            
            done();
          });
        });
      });
    })
  })
  
  it('throws with bad db', function () {
    assert.throws(function () {
      var store = new MongoStore({db: {}});
      store.getCollection();
    }, /no method/);
  })
})