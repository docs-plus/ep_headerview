'use strict';

const db = require('ep_etherpad-lite/node/db/DB');

exports.get = (key) => db.get(key).catch((error) => {
  throw new Error(`[repository]: set has an error, ${error.message}`);
});

exports.set = (key, value) => db.set(key, value).catch((error) => {
  throw new Error(`[repository]: set has an error, ${error.message}`);
});

exports.remove = (key, value) => db.remove(key).catch((error) => {
  throw new Error(`[repository]: remove has an error, ${error.message}`);
});

exports.getFilterList = async (key) => {
  const results = [];

  const keys = await db.findKeys(`${key}:*`, null).catch((error) => {
    throw new Error(`[repository]: getLatestId has an error,${error.message}`);
  });

  keys.map((keyId) => results.push(db.get(keyId)));

  return Promise.all(results);
};
