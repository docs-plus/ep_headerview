'use strict';

const eejs = require('ep_etherpad-lite/node/eejs/');

exports.eejsBlock_editbarMenuRight = (hookName, args, cb) => {
  args.content += eejs.require('ep_headerview/templates/editbarButtons.ejs');
  return cb();
};
