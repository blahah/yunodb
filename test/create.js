var yuno = require('../')
var test = require('tape')
var tmp = require('temporary')
var rimraf = require('rimraf')

var path = require('path')
var fs = require('fs')

test('create', function (t) {
  t.plan(2)

  var tmpdir = new tmp.Dir()
  var dbpath = path.join(tmpdir.path, 'yuno')

  var opts = {
    location: dbpath,
    keyField: 'id',
    indexMap: ['word']
  }

  function cb (err) {
    t.error(err, 'no error on create db')

    var stats = fs.lstatSync(dbpath)
    t.ok(stats.isDirectory(), 'db directory exists')

    rimraf(dbpath, {}, t.end)
  }

  yuno(opts, cb)
})
