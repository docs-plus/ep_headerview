'use strict'

const eejs = require('ep_etherpad-lite/node/eejs/')
const packageJson = require('./package.json')

exports.eejsBlock_editbarMenuRight = (hookName, args, cb) => {
  args.content += eejs.require('ep_headerview/templates/editbarButtons.ejs')
  return cb()
}

exports.clientVars = (hook, context, callback) => {
  const result = {
    version: packageJson.version
  }

  return ({ headerView: result })
}

const db = require('./server/dbRepository')

exports.socketio = (hookName, args, cb) => {
  const io = args.io.of('/headerview')
  io.on('connection', (socket) => {
    socket.on('addNewFilter', async (padId, filter, callback) => {
      const key = `filters:${padId}:${filter.id}`
      console.info('Add new Filter', key, filter)
      await db.set(key, filter)
        .catch((error) => {
          console.error('[headerview]: ', error)
          callback(false)
        })

      socket.broadcast.to(padId).emit('addNewFilter', filter)

      callback(filter)
    })


    socket.on('removeFilter', async (padId, filter, callback) => {
      await db.remove(`filters:${padId}:${filter.id}`)
        .catch((error) => {
          console.error('[headerview]: ', error)
          callback(false)
        })

      socket.broadcast.to(padId).emit('removeFilter', filter)
      callback(true)
    })

    socket.on('getFilterList', async (padId, callback) => {
      socket.join(padId)
      let filters = await db.getFilterList(`filters:${padId}`)
        .catch((error) => {
          console.error('[headerview]: ', error)
          callback(false)
        })
      if (!filters) filters = []
      filters = filters.filter((x) => x != null)
      callback(filters)
    })
  })
}
