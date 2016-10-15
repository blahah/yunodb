var yuno = require('../')
var test = require('tape')
var tmp = require('temporary')
// var rimraf = require('rimraf')
var eos = require('end-of-stream')
var streamify = require('stream-array')
var pumpify = require('pumpify')

var path = require('path')

var reuters = require('./reuters-000.json')

test('streaming search', function (t) {
  t.timeoutAfter(10000)

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

    var adder = pumpify(streamify(reuters), db.add())

    eos(adder, function (err) {
      t.error(err, 'documents added without error')

      setTimeout(() => {
        db.index.tellMeAboutMySearchIndex(function (err, info) {
          console.log(err, info)
        })

        db.index.get(['1', '2', '3']).on('data', function (d) {
          console.log('data get', d)
        })

        var results = []

        var keep = function (data) {
          results.push(data)
        }

        var done = function (err) {
          t.error(err, 'search completes without error')

          console.log(results)
          t.equals(results.length, 55, 'correct number of hits')
          // rimraf(dbpath, {}, t.end)
        }

        var search = db.search('new york').on('data', keep)
        eos(search, done)
      }, 100)
    })
  })
})
