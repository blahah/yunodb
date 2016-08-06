## yunodb

A portable, persistent, electron compatible fulltext search + document store database for node.js. LevelDB underneath.

[![js-standard-style](https://img.shields.io/badge/code%20style-standard%20js-green.svg?style=flat-square)](https://github.com/feross/standard)  [![Travis](https://img.shields.io/travis/blahah/yunodb.svg?style=flat-square)](https://travis-ci.org/blahah/yunodb)  [![npm](https://img.shields.io/npm/v/yunodb.svg?style=flat-square)](https://www.npmjs.com/package/yunodb)  [![cc-zero](https://img.shields.io/badge/license-CC0%20public%20domain-ff69b4.svg?style=flat-square)](https://github.com/blahah/yunodb#license---cc0)

- [How it works](https://github.com/blahah/yunodb#how-it-works)
- [Install](https://github.com/blahah/yunodb#install)
- [Use](https://github.com/blahah/yunodb#use)
  - [Create / load a database](https://github.com/blahah/yunodb#create--load-a-database)
    - [Index mapping](https://github.com/blahah/yunodb#index-mapping)
  - [Add documents](https://github.com/blahah/yunodb#add-documents)
  - [Search](https://github.com/blahah/yunodb#search)
  - [CLI](https://github.com/blahah/yunodb#cli)
- [Contributing](https://github.com/blahah/yunodb#contributing)
- [License - CC0](https://github.com/blahah/yunodb#license---cc0)

## How it works

yuno is a JSON document store with fulltext search. It's meant for embedding in electron apps, focuses solely on text search, and in most cases should handle millions of documents easily.

yuno is pretty basic - it has three components:
- The document store, which is just the raw JSON objects stored in [leveldb](https://github.com/Level/levelup)
- The inverted search index, powered by [search-index](https://github.com/fergiemcdowall/search-index)
- A customisable [natural](https://github.com/NaturalNode/natural) language processing pipeline that is applied to documents before adding them to the index, greatly improving speed and memory usage compared to the vanilla search-index.

**None of this is revolutionary** - actually it's standard in fulltext-search database engines. And all the pieces exist already in the node ecosystem. But I couldn't find a node fulltext search and document store that could handle millions of documents, persisted on disk, didn't have crazy memory requirements and could be easily bundled into an electron app.

Like, db, **y** **u** **no** exist already??

![yuno.jpg](yuno.jpg)

## Install

```
npm install --save yunodb
```

## Use

### Create / load a database

**`yuno(options, callback)`**

e.g.

```
var yuno = require('yuno')

var dbopts = {
  location: './.yuno',
  keyField: 'id',
  indexMap: ['text']
}
var db = yuno(opts, (err, dbhandle) => {
  if (err) throw err

  // do stuff with the db
  db = dbhandle
})
```

`opts` configures the two persistent datastores. Possible key-value pairs are:

- **location** (String, required) - Base directory in which both datastores will be kept.
- **keyField** (String, required) - [JSONpath](https://github.com/s3u/JSONPath#syntax-through-examples) specifying the field in each document to be used as a key in the document store.
- **indexMap** (Array | Object, required) - [JSONpaths](https://github.com/s3u/JSONPath#syntax-through-examples) specifying the fields in each document to index for fulltext searching. See [index mapping](#index-mapping) below for details.
- **deletable** (Boolean, optional) - Whether documents should be deletable. Setting to true increases index size. Default: false.
- **ngramLength** (Integer | Array, optional) - ngram length(s) to use when building index.

#### Index mapping

It is quite rare that all fields in a database should be exposed to the user search. More often, we want to allow the user to search certain fields, but retrieve the full document for each result. The `indexMap` option allows you to specify how to index documents.

There are two ways to tell `yuno` how to index:

##### 1. Pass an Array of fields

The simple option - an array of fields to index. The contents of each field will be passed through the default Natural Language Processing pipeline before being added to the search index.

##### 2. Pass an Object mapping fields to processors

To fine-tune the processing on a per-field basis, pass an Object where each key is a field to index. Values can be one of:

- `true`/`false` whether to apply the default NLP pipeline
- `function` a custom processing function.

Custom processing take the field value as a single argument, and their return value (either a string or an array) will be tokenised and added to the index.

### Add documents

**`db.add(documents, options, callback)`**

- `documents`, array of JSON-able objects to store
- `options` optional, can override the database-wide `indexMap` option
- `callback`, function to call on completion, with a single argument to be passed an error if there was one

e.g.

```js
var docs = [
  { id: 1, text: 'hello '},
  { id: 2, text: 'goodbye '},
  { id: 3, text: 'tortoise '}
]

function done (err) {
  if (err) throw err
  console.log('successfully added', docs.length, 'documents')
}

db.add(docs, done)
```

or using a custom `indexMap`:

```js
// trim whitespace
function trim (str) { return str.trim() }

db.add(docs, { text: trim }, doneAdding)
```

### Delete documents

**`db.del(documents, callback)`**

- `documents`, document (object), id (string), or array of documents or ids
- `callback`, function to call on completion, with a single argument to be passed an error if there was one

e.g.

```js
// document
db.del({ id: '1234', otherkey: 'something else' }, done)

// with id
db.del('1234', done)

// array
db.del(['1234', '1235', '1236'], done)
```

### Search

**`db.search(query, opts, callback)`**

Returns a cursor that can be used to page through the results. By default the `pageSize` is 50.

- `query`, string search query
- `opts`, (optional) options object
- `callback`, function to call on completion. Takes two arguments:
  - `err` error or `null`
  - `results` object containing the result metadata and hits

e.g.

```js
var cursor = db.search('tortoise', function(err, results) {
  if (err) throw err

  // first 50 results
  console.log(results)

  cursor.next(function(err, results) {
    // next page in here
  })
})
```

### CLI

yuno has a minimal command-line interface that can be used to create a database from a file containing JSON objects.

Install the CLI:

```bash
npm install --global yuno
```

Create a new database:

```bash
yuno create <database path> <JSON data>
```

The JSON data file must contain JSON objects, rather than an array. For example:

```json
{ "id": "1234", "title": "the coleopterist's handbook" }
{ "id": "4321", "title": "bark and ambrosia beetles of south america" }
```

You can provide database options as a JSON file using the `--opts` argument:

```bash
yuno create --opts <JSON options> <database path> <JSON data>
```

Where the options JSON looks like:

```json
{
  "keyField": "id",
  "indexMap": {
    "title": true,
  }
}
```

## Contributing

yuno is being built to serve my use-case of embedding pre-made databases in electron apps. If you have another use-case and would like features added, please open an issue to discuss it - I'm happy to add things that will be widely useful.

Contributions are very welcome. **Please** open an issue to discuss any changes you would like to PR, or mention in an existing issue that you plan to work on it.

Ideas for improving performance are particularly welcome.

## License - CC0

https://creativecommons.org/publicdomain/zero/1.0/

yuno is public domain code. Do whatever you want with it. Credit would be appreciated, but it's not required.
