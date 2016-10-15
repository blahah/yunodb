var path = require('path')

var levelup = require('levelup')
var searchIndex = require('search-index')
var _ = require('lodash')
var mkdirp = require('mkdirp')
var jsonpath = require('jsonpath-plus')

var LevelBatch = require('level-batch-stream')
var BatchStream = require('batch-stream')
var multi = require('multi-write-stream')
var through = require('through2')
var pumpify = require('pumpify')

var preprocess = require('./preprocess/preprocess.js')

function Yuno (opts, cb) {
  if (!(this instanceof Yuno)) return new Yuno(opts, cb)

  requiredOpts(opts, ['keyField', 'indexMap'], cb)

  var self = this

  function ready () {
    if (cb) cb(null, self)
    // TODO: events, self.emit('ready')
  }

  var docstoreOpts = opts.docstore || {
    keyEncoding: 'string',
    valueEncoding: 'json'
  }

  mkdirp.sync(opts.location)

  this.docstorePath = path.join(opts.location, 'docstore')
  this.docstore = levelup(this.docstorePath, docstoreOpts)

  this.indexPath = path.join(opts.location, 'index')

  var indexOpts = _.defaults(opts, {
    indexPath: this.indexPath,
    deletable: false,
    fieldedSearch: false,
    fieldsToStore: ['tokens'],
    nGramLength: 1
  })

  searchIndex(indexOpts, (err, si) => {
    if (err) return cb(err)
    self.index = si
    ready()
  })

  this.preprocessor = preprocess(opts)
  this.keyField = opts.keyField || 'id'
}

Yuno.prototype.getKey = function (doc) {
  return jsonpath({ json: doc, path: this.keyField })[0]
}

Yuno.prototype.putOp = function (doc) {
  return { type: 'put', key: this.getKey(doc), value: doc }
}

// docs: array of documents to add
// opts: options for adding
Yuno.prototype.add = function () {
  var self = this

  var storeify = through.obj(function (data, enc, cb) {
    cb(null, {
      type: 'put',
      key: '' + self.getKey(data),
      value: JSON.stringify(data)
    })
  })

  var store = pumpify.obj(
    storeify, new BatchStream({ size: 100 }), new LevelBatch(self.docstore)
  )

  var indexify = through.obj(function (data, enc, cb) {
    var tokenbag = JSON.stringify({
      id: self.getKey(data),
      tokens: self.preprocessor.process(data)
    })
    cb(null, tokenbag)
  })

  var index = pumpify.obj(indexify, self.index.add())
  return multi.obj([store, index])
}

Yuno.prototype.get = function (key, cb) {
  this.docstore.get(key, cb)
}

Yuno.prototype.search = function (query, opts) {
  var self = this

  var q = { query: { AND: { '*': self.preprocessor.naturalize(query) } } }
  var search = self.index.search(q)

  var lookup = through(function (data, enc, cb) {
    console.log('result', data)
    self.docstore.get(data.key, function (err, doc) {
      if (err) return cb(err)
      data.document = doc
      cb(null, data)
    })
  })

  return pumpify(search, lookup)
}

Yuno.prototype.del = function (keys, cb) {
  var self = this

  if (!(_.isArray(keys))) keys = [keys]
  if (_.isPlainObject(keys[0])) keys = keys.map((doc) => { self.getKey(doc) })

  var errs = []
  var done = _.after(2, function () {
    cb(errs.length > 0 ? errs[0] : null)
  })

  this.docstore.batch(keys.map((key) => {
    return { type: 'del', key: key }
  }), done)

  this.index.del(keys.map((key) => {
    return { id: key }
  }), done)
}

Yuno.prototype.close = function (cb) {
  var errs = []
  var done = _.after(2, function () {
    cb(errs.length > 0 ? errs[0] : null)
  })

  this.docstore.close(done)
  this.index.close(done)
}

function requiredOpts (opts, keys, cb) {
  keys.forEach((key) => {
    if (!opts[key]) {
      cb(new Error(key + ' option is required'))
    }
  })
}

module.exports = Yuno
