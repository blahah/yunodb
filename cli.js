#! /usr/bin/env node

var program = require('commander')
var yuno = require('.')
var exists = require('path-exists').sync
var JSONStream = require('JSONStream')
var fs = require('fs')
var _path = require('path')

program
  .version(require('./package.json').version)

program
  .command('create <path> <input>')
  .description('create a database from JSON objects')
  .option('-o, --opts <file>', 'JSON file containing database options')
  .action(function (path, input, options) {
    checkFile(input, 'input JSON')
    var opts = {}
    if (options.opts) {
      checkFile(input, 'options JSON')
      opts = require(_path.resolve('.', options.opts))
    }

    console.log('creating database at', path, 'from file', input)
    opts.location = path

    function load (err, db) {
      if (err) throw err
      populate(db, input)
    }

    yuno(opts, load)
  })

program
  .parse(process.argv)

function populate (db, file) {
  var json = JSONStream.parse()
  var read = fs.createReadStream(file)

  var n = 0
  var chunk = []

  json.on('data', function (entry) {
    chunk.push(entry)

    if (chunk.length === 10000) {
      var thischunk = chunk

      db.add(thischunk, {}, function (err) {
        if (err) return console.log(err)
        n += 10000
        console.log('written:', n)
      })

      chunk = []
    }
  })

  json.on('end', function () {
    if (chunk.length === 0) return

    db.add(chunk, {}, function (err) {
      if (err) throw console.log(err)
      db.index.tellMeAboutMySearchIndex(function (err, info) {
        if (err) throw err
        console.log('done! added', info.totalDocs, 'docs to index')
      })
    })
  })

  read.pipe(json)
}

function checkFile (file, name) {
  if (!file) {
    console.log('ERROR: you must provide an', name)
    process.exit(1)
  } else if (/^input/.test(name) && !exists(file)) {
    console.log('ERROR:', name, "file doesn't exist at path", file)
    process.exit(1)
  }
}
