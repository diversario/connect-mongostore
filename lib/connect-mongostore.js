'use strict'

var mongo = require('mongodb')
  , url = require('url')
  , util = require('util')
  , _ = require('lodash')


/**
 * Default options
 */
var defaultOptions = {
  'host': '127.0.0.1',
  'port': 27017,
  'stringify': false,
  'collection': 'sessions',
  'expireAfter': 1000 * 60 * 60 * 24 * 14, // 2 weeks
  'autoReconnect': false,
  'ssl': false,
  'w': 1
}



function getStore(Store) {
  /**
   * Initialize MongoStore with the given `options`.
   *
   * @param {Object} options
   */
  function MongoStore (options, callback) {
    Store.call(this, this.options)

    if (typeof options == 'string') {
      this.options = parseUrl(options)
    } else {
      this.options = _.clone(options || {})
      this.options.expireAfter = this.options.expireAfter || defaultOptions.expireAfter
    }

    if (!this.options.hasOwnProperty('stringify')) {
      this.options.stringify = defaultOptions.stringify
    }

    this.collectionName = this.options.collection || defaultOptions.collection
    this.db = setupDb(this.options)

    callback && this.getDatabase(callback);
  }



  /**
   * Inherit from `Store`.
   */
  util.inherits(MongoStore, Store)



  MongoStore.prototype.serialize = function (obj) {
    if (this.options.stringify) {
      return JSON.stringify(obj)
    }
    return obj
  }


  MongoStore.prototype.deserialize = function (str) {
    if (this.options.stringify) {
      return JSON.parse(str)
    }
    return str
  }


  MongoStore.prototype.getDatabase = function (cb) {
    var self = this

    self.db.open(function (err, db) {
      if (err) throw new Error('Error connecting to database:\n' + err.message + '\n' + err.stack + '\n')

      if (self.options.username && self.options.password) {
        db.authenticate(self.options.username, self.options.password, {authSource: self.options.authSource || null}, function () {
          self.getCollection(cb)
        })
      } else {
        self.getCollection(cb)
      }
    })
  }



  /**
   * Returns a MongoDB collection.
   *
   * @param cb
   */
  MongoStore.prototype.getCollection = function (cb) {
    var self = this

    if (self.collection) {
      cb && cb(self.collection)
      return
    }

    if (!self.db.openCalled) return self.getDatabase(cb)

    self.db.collection(self.collectionName, function (err, collection) {
      if (err) throw new Error('Error getting collection: ' + self.collectionName + ' <' + err + '>')

      self.collection = collection

      self.collection.ensureIndex({'expires': 1}, {'expireAfterSeconds': 0}, function (err, result) {
        if (err) throw new Error('Error setting TTL index on collection : ' + self.collectionName + ' <' + err + '>')
        cb && cb(self.collection)
      })
    })
  }



  /**
   * Attempt to fetch session by the given `sid`.
   *
   * @param {String} sid
   * @param {Function} cb
   * @api public
   */
  MongoStore.prototype.get = function (sid, cb) {
    var self = this

    this.getCollection(function (collection) {
      collection.findOne({_id: sid}, function (err, session) {
        if (err) {
          cb && cb(err)
          return
        }

        if (!session) {
          cb && cb()
          return
        }

        if (!session.expires || new Date < session.expires) return cb(null, self.deserialize(session.session))
        self.destroy(sid, cb)
      })
    })
  }



  /**
   * Commit the given `session` object associated with the given `sid`.
   *
   * @param {String} sid
   * @param {Object} session
   * @param {Function} cb
   * @api public
   */
  MongoStore.prototype.set = function (sid, session, cb) {
    var s = {'_id': sid, 'session': this.serialize(session)}

    if (session && session.cookie && session.cookie._expires) {
      s.expires = new Date(session.cookie._expires)
    } else {
      s.expires = getFutureDate(this.options.expireAfter)
    }

    this.getCollection(function (collection) {
      collection.update({'_id': sid}, s, {'upsert': true, 'safe': true}, function (err, data) {
        cb(err, data)
      })
    })
  }



  /**
   * Destroy the session associated with the given `sid`.
   *
   * @param {String} sid
   * @param {Function} cb
   * @api public
   */
  MongoStore.prototype.destroy = function (sid, cb) {
    this.getCollection(function (collection) {
      collection.remove({_id: sid}, function () {
        cb && cb()
      })
    })
  }



  /**
   * Fetch number of sessions.
   *
   * @param {Function} cb
   * @api public
   */
  MongoStore.prototype.length = function (cb) {
    this.getCollection(function (collection) {
      collection.count({}, function (err, count) {
        cb && cb(err, count)
      })
    })
  }



  /**
   * Clear all sessions.
   *
   * @param {Function} cb
   * @api public
   */
  MongoStore.prototype.clear = function (cb) {
    this.getCollection(function (collection) {
      collection.drop(function () {
        cb && cb()
      })
    })
  }


  return MongoStore
}



/**
 * Returns a data in the future. By default,
 * returns now + 2 weeks.
 *
 * @param {Date} offset
 * @returns {Date}
 */
function getFutureDate(offset) {
  return new Date(Date.now() + offset)
}



/**
 * Parse a database URL.
 *
 * @param {String} path
 * @returns {Object}
 */
function parseUrl(path) {
  var parsed = {}

  var dbUri = url.parse(path)

  if (dbUri.port) {
    parsed.port = parseInt(dbUri.port)
  }

  if (dbUri.pathname != undefined) {
    var pathname = dbUri.pathname.split('/')

    if (pathname.length >= 2 && pathname[1]) {
      parsed.db = pathname[1]
    }

    if (pathname.length >= 3 && pathname[2]) {
      parsed.collection = pathname[2]
    }
  }

  if (dbUri.hostname != undefined) {
    parsed.host = dbUri.hostname
  }

  if (dbUri.auth != undefined) {
    var auth = dbUri.auth.split(':')

    if (auth.length >= 1) {
      parsed.username = auth[0]
    }

    if (auth.length >= 2) {
      parsed.password = auth[1]
    }
  }

  return parsed
}



/**
 * Instantiate database instance.
 *
 * @param opts
 * @returns {*}
 */
function setupDb(opts) {
  if (opts.mongooseConnection) {
    var _opts = dbFromMongooseConnection(opts.mongooseConnection)
    opts.db = _opts.db
    opts.host = _opts.host
    opts.port = _opts.port
    opts.username = _opts.username
    opts.password = _opts.password
  }

  if (!opts.db) throw new Error('Required MongoStore option `db` missing')
  if (typeof opts.db == 'object' && opts.db.databaseName) return opts.db // Assume it's an instantiated DB Object

  if (Array.isArray(opts.db.servers)) {
    var serverArray = []

    opts.db.servers.forEach(function (server) {
      var serverOptions = server.options || {}
      serverOptions.ssl = serverOptions.ssl || opts.ssl || defaultOptions.ssl
      var newServer = new mongo.Server(server.host, server.port, serverOptions)
      serverArray.push(newServer)
    })

    return new mongo.Db(opts.db.name, new mongo.ReplSetServers(serverArray), opts.db.replicaSetOptions || {'w': 1})
  }

  if (typeof opts.db != 'string') throw new Error('`db` option must be a string, array or a database instance.')

  return new mongo.Db(
    opts.db, new mongo.Server(
      opts.host || defaultOptions.host,
      opts.port || defaultOptions.port,
      {
        auto_reconnect: opts.autoReconnect || defaultOptions.autoReconnect,
        ssl: opts.ssl || defaultOptions.ssl
      }),
    { w: opts.w || defaultOptions.w })
}



/**
 * Make a DB instance from mongoose connection.
 * @param mongooseConnection
 * @param opts
 * @returns {Object} mongo-native Server instance
 */
function dbFromMongooseConnection(mongooseConnection) {
  var opts = {}

  if (mongooseConnection.user && mongooseConnection.pass) {
    opts.username = mongooseConnection.user
    opts.password = mongooseConnection.pass
  }

  // is this a replica set? #23
  if (mongooseConnection.hosts && Array.isArray(mongooseConnection.hosts)) {
    opts.db = {
      name: mongooseConnection.name,
      servers: []
    }

    mongooseConnection.hosts.forEach(function (_server) {
      opts.db.servers.push({
        host: _server.host,
        port: _server.port,
        options: mongooseConnection.options
      })
    })
  } else {
    opts.db = mongooseConnection.name
    opts.host = mongooseConnection.host
    opts.port = mongooseConnection.port
  }

  return opts
}



module.exports = function (connect) {
  return getStore(connect.Store? connect.Store : connect.session.Store)
}
