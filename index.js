'use strict';

const eejs = require('ep_etherpad-lite/node/eejs/');
const packageJson = require('./package.json');
const randomString = require('ep_etherpad-lite/static/js/pad_utils').randomString;


exports.eejsBlock_styles = (hook_name, args, cb) => {
  args.content += "<link href='../static/plugins/ep_headerview/static/css/editor.css' rel='stylesheet'>";
  return {};
};

exports.eejsBlock_scripts = (hook_name, args, cb) => {
  args.content += eejs.require('ep_headerview/templates/filterModal.html');
  return cb();
};

exports.eejsBlock_editbarMenuRight = (hookName, args, cb) => {
  args.content += eejs.require('ep_headerview/templates/editbarButtons.ejs');
  return cb();
};

exports.clientVars = (hook, context, callback) => {
  const result = {
    version: packageJson.version,
  };

  return ({headerView: result});
};

const db = require('./server/dbRepository');

const getFilters = async (padId, padSlugs) => {
  let filters = await db.getFilterList(`filters:${padId}`)
      .catch((error) => {
        console.error('[headerview]: ', error);
      });
  if (!filters) filters = [];
  filters = filters.filter((x) => x != null);

  const notExistsSlug = [];

  padSlugs.forEach((slug) => {
    if (!filters.find((x) => x && x.slug === slug)) {
      notExistsSlug.push(slug);
    }
  });

  await Promise.all(notExistsSlug.map(async (slug) => {
    const newFilter = {
      name: slug,
      slug,
      id: randomString(16),
    };
    const key = `filters:${padId}:${newFilter.id}`;
    console.log('new filter', newFilter, key);
    console.info('Add new Filter', key, newFilter);
    await db.set(key, newFilter)
        .catch((error) => {
          console.error('[headerview]: ', error);
        });
  }));
  // if new filter added to list
  if (notExistsSlug.length > 0) {
    filters = await db.getFilterList(`filters:${padId}`)
        .catch((error) => {
          console.error('[headerview]: ', error);
        });
    if (!filters) filters = [];
    filters = filters.filter((x) => x != null);
  }

  return filters;
};

exports.expressCreateServer = (hookName, args, callback) => {
  args.app.get('/pluginfw/ep_headerview/:padId', async (req, res) => {
    let {slugs} = req.query;
    slugs = slugs.split(',');
    const {padId} = req.params;
    const filters = await getFilters(padId, slugs);
    res.json({message: true, filters});
  });
  return callback();
};

exports.socketio = (hookName, args, cb) => {
  const io = args.io.of('/headerview');
  io.on('connection', (socket) => {
    socket.on('addNewFilter', async (padId, filter, callback) => {
      const key = `filters:${padId}:${filter.id}`;
      console.info('Add new Filter', key, filter);
      await db.set(key, filter)
          .catch((error) => {
            console.error('[headerview]: ', error);
            callback(false);
          });

      socket.broadcast.to(padId).emit('addNewFilter', filter);

      callback(filter);
    });

    socket.on('removeFilter', async (padId, filter, callback) => {
      await db.remove(`filters:${padId}:${filter.id}`)
          .catch((error) => {
            console.error('[headerview]: ', error);
            callback(false);
          });

      socket.broadcast.to(padId).emit('removeFilter', filter);
      callback(true);
    });


    socket.on('getFilterList', async (padId, padSlugs, callback) => {
      socket.join(padId);
      const filters = await getFilters(padId, padSlugs);
      callback(filters);
    });
  });
  return args;
};
