require('events').EventEmitter.defaultMaxListeners = 0

var path = require('path')

var levelup = require('levelup')
var searchIndex = require('search-index')
var _ = require('lodash')
var after = require('lodash/after')
var mkdirp = require('mkdirp')
var jsonpath = require('jsonpath-plus')

var levelstream = require('level-write-stream')
var multi = require('multi-write-stream')
var through = require('through2')
var pumpify = require('pumpify')
var eos = require('end-of-stream')

var preprocess = require('./preprocess/preprocess.js')

var noop = function () {}

function Yuno (opts, cb) {
  if (!(this instanceof Yuno)) return new Yuno(opts, cb)

  requiredOpts(opts, ['keyField', 'indexMap'], cb)

  var self = this

  this.preprocessor = preprocess(opts)
  this.keyField = opts.keyField || 'id'

  var docstoreOpts = opts.docstore || {
    keyEncoding: 'string',
    valueEncoding: 'json'
  }

  mkdirp.sync(opts.location)

  this.docstorePath = path.join(opts.location, 'docstore')
  this.docstore = levelup(this.docstorePath, docstoreOpts)

  this.indexPath = path.join(opts.location, 'index')

  function ready () {
    if (cb) cb(null, self)
    // TODO: events, self.emit('ready')
  }

  var indexOpts = _.defaults(opts, {
    indexPath: this.indexPath,
    batchsize: 100,
    nGramLength: 1,
    separator: ' ',
    stopwords: []
  })

  searchIndex(indexOpts, (err, si) => {
    if (err) return cb(err)
    self.index = si
    ready()
  })
}

Yuno.prototype.getKey = function (doc) {
  return jsonpath({ json: doc, path: this.keyField })[0]
}

Yuno.prototype.putOp = function (doc) {
  return { type: 'put', key: this.getKey(doc), value: doc }
}

// docs: array of documents to add
// opts: options for adding
Yuno.prototype.add = function (cb) {
  var self = this

  cb = cb || noop
  var cbb = after(2, cb)
  var alldone = function (err) {
    if (err) return cb(err)
    cbb()
  }

  var storeify = through.obj(function (data, enc, next) {
    var putOp = self.putOp(data)
    next(null, putOp)
  })

  var storeadd = levelstream(self.docstore)({ sync: true })
  eos(storeadd, alldone)

  var store = pumpify.obj(storeify, storeadd)

  var indexify = through.obj(function (data, enc, next) {
    var tokenbag = {
      id: self.getKey(data),
      tokens: self.preprocessor.process(data)
    }
    next(null, tokenbag)
  })

  var indexadd = self.index.add().on('data', noop)
  eos(indexadd, alldone)

  var index = pumpify.obj(indexify, self.index.defaultPipeline(), indexadd)

  return multi.obj([store, index])
}

Yuno.prototype.get = function (key, cb) {
  this.docstore.get(key, cb)
}

Yuno.prototype.search = function (query, opts) {
  var self = this

  var searchOpts = _.defaults(opts, {})

  var q = {
    query: [{ AND: { '*': self.preprocessor.naturalize(query) } }],
    pageSize: searchOpts.limit || 10000
  }

  var lookup = through.obj(function (data, enc, cb) {
    if (typeof data === 'string') data = JSON.parse(data.toString('utf8'))

    self.docstore.get(data.id, function (err, doc) {
      if (err) return cb(err)
      data.document = doc
      cb(null, data)
    })
  })

  return pumpify.obj(self.index.search(q, searchOpts), lookup)
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
  var done = after(2, function () {
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
