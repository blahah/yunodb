var yuno = require('../')
var test = require('tape')
var tmp = require('temporary')
var rimraf = require('rimraf')
var pumpify = require('pumpify')
var JSONStream = require('JSONStream')

var fs = require('fs')

var path = require('path')

test('streaming search', function (t) {
  t.timeoutAfter(50000)

  var tmpdir = new tmp.Dir()
  var dbpath = path.join(tmpdir.path, 'yuno')

  var opts = {
    location: dbpath,
    keyField: 'id',
    indexMap: {
      title: true,
      body: true,
      topics: true,
      places: true,
      date: false
    }
  }

  yuno(opts, (err, db) => {
    t.error(err, 'db created without error')

    var done = function (err) {
      t.error(err, 'documents added without error')

      var results = []

      var keep = function (data) {
        results.push(data)
      }

      var done = function (err) {
        t.error(err, 'search completes without error')

        t.equals(results.length, 20, 'correct number of hits')
        rimraf(dbpath, {}, t.end)
      }

      db.search('new york').on('data', keep)
        .on('end', done)
        .on('error', done)
        .on('close', done)
    }

    pumpify(
      fs.createReadStream('./node_modules/reuters-21578-json/data/fullFileStream/000.str'),
      JSONStream.parse(),
      db.add(done)
    )
  })
})
