module.exports = process.env.CONNECT_MONGOSTORE_COV
  ? require('./lib-cov/connect-mongostore')
  : require('./lib/connect-mongostore');
