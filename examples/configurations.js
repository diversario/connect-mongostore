var singleServer = {
  "db" : "sessions",
  "collection" : "express_sessions",
  "host" : "localhost",
  "port" : 27017
}

var replicaSet = {
  "collection" : "express_sessions",
  "stringify": false,
  "db": {
    "name" : "sessions",
    "servers" : [
      {
        "host" : "localhost",
        "port" : 27017,
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
      },
      {
        "host" : "localhost",
        "port" : 27018,
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
      },
      {
        "host" : "localhost",
        "port" : 27019,
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
    ]
  }
}