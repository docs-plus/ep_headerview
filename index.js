'use strict';

const eejs = require('ep_etherpad-lite/node/eejs/');
const packageJson = require('./package.json');

exports.eejsBlock_editbarMenuRight = (hookName, args, cb) => {
  args.content += eejs.require('ep_headerview/templates/editbarButtons.ejs');
  return cb();
};


exports.clientVars = (hook, context, callback) => {

  const result = {
    version: packageJson.version,
  }

  return callback({headerView: result});
}
