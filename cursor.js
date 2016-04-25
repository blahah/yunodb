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

Cursor.prototype.first = function (cb) {
  return this.queryWithOffset(0, cb)
}

Cursor.prototype.next = function (cb) {
  var offset = (this.lastOffset === null) ? 0 : this.lastOffset + this.pageSize
  return this.queryWithOffset(offset, cb)
}

Cursor.prototype.prev = function (cb) {
  var offset = (this.lastOffset === null) ? 0 : this.lastOffset - this.pageSize
  return this.queryWithOffset(offset, cb)
}

Cursor.prototype.last = function (cb) {
  if (this.totalHits) {
    var penultimatePage = Math.floor(this.totalHits / this.pageSize)
    var lastPageOffset = penultimatePage * this.pageSize
    return this.queryWithOffset(lastPageOffset, cb)
  }

  cb(new Error('cannot get last page until initial query has run (try cursor.first() first)'))
}

Cursor.prototype.queryWithOffset = function (offset, cb) {
  this.lastOffset = offset

  var self = this
  var q = {
    query: this.query,
    offset: offset,
    pageSize: this.pageSize
  }
  this.db.index.search(q, (err, results) => {
    if (err) return cb(err)
    self.totalHits = results.totalHits
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
