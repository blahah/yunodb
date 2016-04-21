var vector = require('./vector.js')
var _ = require('lodash')

function Preprocessor (opts) {
  if (!(this instanceof Preprocessor)) return new Preprocessor(opts)

  this.opts = opts
  this.createPipeline(opts)
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

Preprocessor.prototype.process = function (object) {
  var self = this
  return _.map(object, (value, key, o) => {
    var step = self.pipeline[key]
    return step ? step(value) : value
  })
}

module.exports = Preprocessor
