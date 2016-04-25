var _ = require('lodash')

function Cursor (query, db, opts) {
  if (!(this instanceof Cursor)) return new Cursor(query, db, opts)

  var defaults = {
    pageSize: 50
  }
  if (!opts) opts = defaults

  this.pageSize = opts.pageSize || defaults.pageSize
  this.lastOffset = null
  this.query = { AND: { '*': db.preprocessor.naturalize(query) } }
  this.db = db
}

Cursor.prototype.next = function (cb) {
  var offset = (this.lastOffset === null) ? 0 : this.lastOffset + this.pageSize
  this.lastOffset = offset

  var self = this
  var q = {
    query: this.query,
    offset: offset,
    pageSize: this.pageSize
  }
  this.db.index.search(q, (err, results) => {
    if (err) return cb(err)
    results.offset = offset
    self.fullResults(results, cb)
  })
}

Cursor.prototype.prev = function (cb) {
  var offset = (this.lastOffset === null) ? 0 : this.lastOffset - this.pageSize
  this.lastOffset = offset

  var self = this
  var q = {
    query: this.query,
    offset: offset,
    pageSize: this.pageSize
  }
  this.db.index.search(q, (err, results) => {
    if (err) return cb(err)
    results.offset = offset
    self.fullResults(results, cb)
  })
}

Cursor.prototype.fullResults = function (results, cb) {
  var self = this

  var done = _.after(results.hits.length, function () {
    cb(null, results)
  })

  results.hits.map((hit, i) => {
    self.db.docstore.get(hit.id, (err, document) => {
      if (err) cb(err)
      results.hits[i].document = document
      done(null)
    })
  })
}

module.exports = Cursor
