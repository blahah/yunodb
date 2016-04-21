var yuno = require('../')
var test = require('tape')
var tmp = require('temporary')
var rimraf = require('rimraf')

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
    t.error(err, 'no error creating db')

    db.add(doc, function (err) {
      t.error(err, 'no error adding document')

      db.docstore.get(doc.id, function (err, value) {
        t.error(err, 'no error retrieving doc from docstore')
        t.equals(JSON.stringify(doc), value, 'doc is exactly as inserted')
        rimraf(dbpath, {}, t.end)
      })
    })
  })
})
