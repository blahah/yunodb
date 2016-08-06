var path = require('path')

var levelup = require('levelup')
var searchIndex = require('search-index')
var _ = require('lodash')
var mkdirp = require('mkdirp')
var jsonpath = require('jsonpath-plus')

var preprocess = require('./preprocess/preprocess.js')
var Cursor = require('./cursor.js')

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
  this.docstore = levelup(opts.location, docstoreOpts)

  this.indexPath = path.join(opts.location, 'index')
  searchIndex(_.defaults({
    indexPath: this.indexPath,
    deletable: false,
    fieldedSearch: false,
    fieldsToStore: ['tokens'],
    nGramLength: 1
  }, opts), (err, si) => {
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
    return { type: 'put', key: '' + self.getKey(d), value: JSON.stringify(d) }
  }), done)

  this.index.add(docs.map((d) => {
    return { id: self.getKey(d), tokens: self.preprocessor.process(d) }
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
  cursor.first(cb)
  return cursor
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

function requiredOpts (opts, keys, cb) {
  keys.forEach((key) => {
    if (!opts[key]) {
      cb(new Error(key + ' option is required'))
    }
  })
}

module.exports = Yuno
