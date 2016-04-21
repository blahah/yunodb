var vector = require('./vector.js')
var _ = require('lodash')
var jsonpath = require('jsonpath-plus')

function Preprocessor (opts) {
  if (!(this instanceof Preprocessor)) return new Preprocessor(opts)

  if (!opts.indexMap) throw new Error('preprocessor requires an indexMap option')

  this.opts = opts
  this.createPipeline(opts)
  this.cachePaths(opts)
}

Preprocessor.prototype.naturalize = function (str) {
  return vector(str)
    .trim()
    .tag()
    .filterPOS()
    .stripTags()
    .lowercase()
    .stripPunctuation()
    .filterNonWords()
    .stem().terms
}

Preprocessor.prototype.createPipeline = function (opts) {
  var indexMap = opts.indexMap
  if (indexMap instanceof Array) {
    indexMap = _.zipObject(indexMap, [true])
  }

  var self = this
  this.pipeline = _.transform(indexMap, function (pipeline, action, field) {
    var op = _.identity
    if (_.isFunction(action)) {
      op = _.bind(action, self)
    } else if (action) {
      op = self.naturalize
    }
    pipeline[field] = op
  }, {})
}

Preprocessor.prototype.cachePaths = function (opts) {
  var map = opts.indexMap
  this.paths = _.isArray(map) ? map : Object.keys(map)
}

Preprocessor.prototype.pick = function (object) {
  return _.zipObject(this.paths, this.paths.map(function (path) {
    return jsonpath({ json: object, path: path }).join(' ')
  }))
}

Preprocessor.prototype.process = function (object) {
  var self = this
  var picked = this.pick(object)
  var parts = _.map(picked, (value, key, o) => {
    var step = self.pipeline[key]
    return step ? step(value) : value
  })
  return _.flatten(parts)
}

module.exports = Preprocessor
