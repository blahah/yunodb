var yuno = require('../')
var test = require('tape')
var tmp = require('temporary')
var rimraf = require('rimraf')

var path = require('path')

var reuters = require('./reuters-000.json')

test('basic search', function (t) {
  t.timeoutAfter(1000)

  var tmpdir = new tmp.Dir()
  var dbpath = path.join(tmpdir.path, 'yuno')

  var opts = {
    location: dbpath,
    keyField: 'id',
    indexMap: ['word']
  }

  var docs = [
    { id: '1234', word: 'sesquipedalianism is for deipnosophists' },
    { id: '4321', word: 'deipnosophists are annoying' }
  ]

  yuno(opts, (err, db) => {
    t.error(err, 'no error creating db')

    db.add(docs, function (err) {
      t.error(err, 'no error adding document')

      db.search('deipnosophists', function (err, result) {
        t.error(err, 'no error searching single')
        t.equals(result.totalHits, 2, 'correct number of hits A')
        t.equals(result.hits[0].document, JSON.stringify(docs[1]), 'doc 1 is exactly as inserted')

        rimraf(dbpath, {}, t.end)
      })
    })
  })
})

test('paging search', function (t) {
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
    t.error(err, 'no error creating db')

    db.add(reuters, function (err) {
      t.error(err, 'no error adding document')

      var cursor = db.search('new york', function (err, result) {
        t.error(err, 'no error searching single')

        t.equals(result.totalHits, 55, 'correct number of hits B')
        t.equals(result.hits.length, 50, 'correct first page size')

        cursor.next((err, result) => {
          t.error(err, 'no error paging')

          t.equals(result.hits.length, 5, 'correct second page size')
          rimraf(dbpath, {}, t.end)
        })
      })
    })
  })
})
