require('events').EventEmitter.defaultMaxListeners = 0

var path = require('path')

var level = require('level')
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

var naturalizer = require('nala-stream/preprocess')
var nala = require('nala-stream')

var noop = function () {}
var delify = key => ({ type: 'del', key: key })

function Yuno (opts, cb) {
  if (!(this instanceof Yuno)) return new Yuno(opts, cb)

  requiredOpts(opts, ['keyField', 'indexMap'], cb)

  var self = this

  this.preprocessor = naturalizer(opts)
  this.nalaify = () => nala(opts)
  this.keyField = opts.keyField || 'id'

  var docstoreOpts = opts.docstore || {
    keyEncoding: 'string',
    valueEncoding: 'json'
  }

  mkdirp.sync(opts.location)

  this.docstorePath = path.join(opts.location, 'docstore')
  this.docstore = level(this.docstorePath, docstoreOpts)

  this.indexPath = path.join(opts.location, 'index')

  function ready () {
    if (cb) cb(null, self)
    // TODO: events, self.emit('ready').
  }

  var indexOpts = _.defaults(opts, {
    indexPath: this.indexPath,
    batchsize: 100,
    fieldedSearch: false,
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

  var indexify = through.obj(
    (data, enc, next) => next(null, {
      id: self.getKey(data.input),
      tokens: data.terms
    })
  )

  var indexadd = self.index.feed({ objectMode: true })
  eos(indexadd, alldone)

  var index = pumpify.obj(self.nalaify(), indexify, indexadd)

  return multi.obj([store, index])
}

Yuno.prototype.update = function (cb) {
  var self = this

  var storeify = through.obj(function (data, enc, next) {
    var putOp = self.putOp(data)
    next(null, putOp)
  })

  var store = pumpify.obj(
    storeify,
    levelstream(self.docstore)({ sync: true })
  )

  eos(store, cb || noop)

  return store
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
  if (_.isPlainObject(keys[0])) keys = keys.map(doc => self.getKey(doc))

  var errs = []
  var done = _.after(2, function () {
    cb(errs.length > 0 ? errs[0] : null)
  })

  this.docstore.batch(keys.map(delify), done)
  this.index.del(keys, done)
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
