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
    socket.on('addNewFilter', async (padId, { filterId, filterUrl, filterName }, callback) => {
      const key = `filters:${padId}:${filterId}`
      const newFilter = { filterId, filterUrl, filterName }
      console.log('asdasd', key, newFilter)
      await db.set(key, newFilter)
        .catch((error) => {
          console.error('[headerview]: ', error)
          callback(false)
        })

      socket.broadcast.to(padId).emit('addNewFilter', { filterId, filterUrl, filterName })

      callback({ filterId, filterUrl, filterName })
    })

    socket.on('editeFilter', async (padId, { filterId, filterUrl, filterName }, callback) => {
      const key = `filters:${padId}:${filterId}`
      const newFilter = { filterId, filterUrl, filterName }
      await db.set(key, JSON.stringify(newFilter))
        .catch((error) => {
          console.error('[headerview]: ', error)
          callback(false)
        })
      callback(true)
    })

    socket.on('removeFilter', async (padId, { filterId }, callback) => {
      await db.remove(`filters:${padId}:${filterId}`)
        .catch((error) => {
          console.error('[headerview]: ', error)
          callback(false)
        })

      socket.broadcast.to(padId).emit('removeFilter', { filterId })
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
