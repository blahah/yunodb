var yuno = require('../')
var test = require('tape')
var tmp = require('temporary')
var rimraf = require('rimraf')
var streamify = require('stream-array')
var pumpify = require('pumpify')

var path = require('path')

test('add', function (t) {
  var tmpdir = new tmp.Dir()
  var dbpath = path.join(tmpdir.path, 'yuno')

  var opts = {
    location: dbpath,
    keyField: 'id',
    indexMap: ['word']
  }

  var doc = { id: '1234', word: 'sesquipedalianism is for deipnosophists' }

  yuno(opts, (err, db) => {
    t.error(err, 'db created without error')

    var done = function (err) {
      setTimeout(function () {
        t.error(err, 'add stream completes without error')

        db.get(doc.id, function (err, value) {
          t.error(err, 'added doc retrieved without error')
          t.equals(value, JSON.stringify(doc), 'doc is exactly as inserted')
          rimraf(dbpath, {}, t.end)
        })
      }, 0)
    }

    var adder = pumpify(streamify([doc]), db.add())

    adder.on('end', done)
    adder.on('error', done)
    adder.on('close', done)
  })
})
