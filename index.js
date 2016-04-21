var path = require('path')

var levelup = require('levelup')
var searchIndex = require('search-index')
var _ = require('lodash')
var mkdirp = require('mkdirp')

var preprocess = require('./preprocess/preprocess.js')

function Yuno (opts, cb) {
  if (!(this instanceof Yuno)) return new Yuno(opts, cb)

  requiredOpts(opts, ['keyField', 'indexMap'], cb)

  var self = this

  function ready () {
    if (cb) cb(null, self)
    // TODO: events, self.emit('ready')
  }

  mkdirp(opts.location)

  this.docstorePath = path.join(opts.location, 'docstore')
  this.docstore = levelup(opts.location)

  this.indexPath = path.join(opts.location, 'index')
  searchIndex({
    indexPath: this.indexPath,
    deletable: false,
    fieldedSearch: false,
    fieldsToStore: ['tokens'],
    nGramLength: 1
  }, (err, si) => {
    if (err) return cb(err)
    self.index = si
    ready()
  })

  this.preprocessor = preprocess(opts)
  this.keyField = opts.keyField
}

Yuno.prototype.putOp = function (doc) {
  return { type: 'put', key: doc[this.keyField], value: doc }
}

// docs: array of documents to add
// opts: options for adding
Yuno.prototype.add = function (docs, opts, cb) {
  var self = this
  if (_.isFunction(opts)) cb = opts
  if (_.isPlainObject(docs)) docs = [docs]

  var errs = []
  var docb = _.after(2, function () {
    cb(errs.length > 0 ? errs[0] : null, docs.length)
  })
  var done = function (err) {
    if (err) errs.push(err)
    docb()
  }

  this.docstore.batch(docs.map((d) => {
    return { type: 'put', key: '' + d[self.keyField], value: JSON.stringify(d) }
  }), done)

  this.index.add(docs.map((d) => {
    return { id: d[self.keyField], tokens: self.preprocessor.process(d) }
  }), done)
  // process the docs for search indexing
}

Yuno.prototype.get = function (key, cb) {
  this.docstore.get(key, cb)
}

Yuno.prototype.search = function (query, opts, cb) {
  if (_.isFunction(opts)) {
    cb = opts
    opts = null
  }
  var cursor = Cursor(query, this, opts)
  cursor.next(cb)
  return cursor
}

function Cursor (query, db, opts) {
  if (!(this instanceof Cursor)) return new Cursor(query, db, opts)

  var defaults = {
    pageSize: 50
  }
  if (!opts) opts = defaults

  this.pageSize = opts.pageSize || defaults.pageSize
  this.offset = 0
  this.query = { AND: { '*': db.preprocessor.naturalize(query) } }
  this.db = db
}

Cursor.prototype.next = function (cb) {
  var self = this
  var q = {
    query: this.query,
    offset: this.offset,
    pageSize: this.pageSize
  }
  this.db.index.search(q, (err, results) => {
    if (err) return cb(err)
    self.fullResults(results, cb)
  })
  this.offset += this.pageSize
}

Cursor.prototype.fullResults = function (results, cb) {
  var self = this

  var done = _.after(results.hits.length, function () {
    cb(null, results)
  })

  results.hits.map((hit, i) => {
    self.db.docstore.get(hit[self.db.keyField], (err, document) => {
      if (err) cb(err)
      results.hits[i].document = document
      done(null)
    })
  })
}

function requiredOpts (opts, keys, cb) {
  keys.forEach((key) => {
    if (!opts[key]) {
      cb(new Error(key + ' option is required'))
    }
  })
}

module.exports = Yuno
