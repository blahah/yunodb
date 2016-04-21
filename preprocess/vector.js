var natural = require('natural')
var tokenize = (new natural.TreebankWordTokenizer()).tokenize
var stem = natural.PorterStemmer.stem
var inherits = require('util').inherits
var path = require('path')
var rules = path.join(__dirname, './tagger/tr_from_posjs.txt')
var lexicon = path.join(__dirname, './tagger/lexicon_from_posjs.json')
var tagger = new natural.BrillPOSTagger(lexicon, rules, 'N')

inherits(Vector, Array)

function Vector (terms) {
  if (!(this instanceof Vector)) return new Vector(terms)
  if (terms instanceof Vector) terms = terms.terms

  if (typeof terms === 'string') {
    this.eatString(terms)
  } else {
    this.terms = terms
  }
}

function stripPunctuation (term) {
  return term.replace(/\W+/g, '')
}

function stripTag (pair) {
  return pair[0]
}

function isWord (term) {
  return term.replace(/[0-9]+/g, '').length > 0
}

Vector.prototype.eatString = function (string) {
  this.terms = tokenize(string.replace('/', ' '))
}

Vector.prototype.lowercase = function () {
  return Vector(this.terms.map((s) => { return s.toLowerCase() }))
}

Vector.prototype.trim = function () {
  return Vector(this.terms.map((s) => { return s.trim() }))
}

Vector.prototype.tag = function () {
  this.tags = tagger.tag(this.terms)
  return this
}

Vector.prototype.filterPOS = function () {
  var filtered = this.tags.filter((part) => {
    // see
    // https://en.wikipedia.org/wiki/Brown_Corpus#Part-of-speech_tags_used
    var tag = part[1]
    if (!tag) return false

    // keep
    var first = tag[0]
    if (first === 'N') return true // nouns
    if (first === 'V') return true // verbs
    if (first === 'J') return true // adjectives
    if (first === 'R') return true // adverbs

    // discard
    return false
  })
  return Vector(filtered)
}

Vector.prototype.stripTags = function () {
  return Vector(this.terms.map(stripTag))
}

Vector.prototype.stripPunctuation = function () {
  return Vector(this.terms.map(stripPunctuation))
}

Vector.prototype.filterNonWords = function () {
  return Vector(this.terms.filter(isWord))
}

Vector.prototype.stem = function () {
  return Vector(this.terms.map(stem))
}

module.exports = Vector
