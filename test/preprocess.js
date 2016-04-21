var preprocessor = require('../preprocess/preprocess.js')
var test = require('tape')

test('preprocess', function (t) {
  var opts = {
    indexMap: ['vec']
  }

  var p = preprocessor(opts)

  var obj = {
    vec: 'the big green manitee jumped over the laziest lungfish'
  }
  var expected = [
    'big', 'green', 'manite', 'jump', 'laziest', 'lungfish'
  ]

  t.deepEqual(p.naturalize(obj.vec), expected, 'naturalize a string')

  t.deepEqual(p.process(obj)[0], expected, 'process an object (indexMap is array)')

  opts.indexMap = { vec: (x) => 'a' }
  p = preprocessor(opts)
  t.deepEqual(p.process(obj)[0], 'a', 'process an object (indexMap is object)')
  t.end()
})
