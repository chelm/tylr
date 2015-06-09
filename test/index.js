var test = require('tape'),
  fs = require('fs')

var options = {
  d: './output',
  n: 'test',
  l: '0,2',
  t: 'pbf'
}

var tylr = require('../tylr')(options)
var data = JSON.parse(fs.readFileSync(__dirname + '/fixtures/states.json').toString())

/*var features = [{
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Point',
    coordinates: [40, -105]
  }
}]*/

test('adds a feature to the tile index', function (t) {
  t.plan(1)
  tylr.addFeature(data.features[0])
  t.equal(Object.keys(tylr.tileStore).length, 3)
})

test('can build geojson from a feature index', function (t) {
  t.plan(1)
  tylr.features = []
  tylr.tileStore = {}
  tylr.addFeature(data.features[0])
  var geojson = tylr.buildGeoJSON(tylr.tileStore['0-0-0'])
  t.equal(geojson.features.length, 1)
})

test('finds all the tiles that cover a feature', function (t) {
  t.plan(1)
  var tiles = tylr.findTileCoverage(data.features[22], 5)
  t.deepEqual(tiles, [ '8-11-5', '7-11-5' ])
})

test('finds all the tiles inside parent all the way up to a given zoom', function (t) {
  t.plan(1)
  var tiles = tylr.tilesInParent([ 3, 6, 4 ], 6)
  t.equal(tiles.length, 16)
})

test('finds all children in a parent tile when zoom is equal to the given zoom level', function (t) {
  t.plan(1)
  var tiles = tylr.tilesInParent([ 3, 6, 4 ], 4)
  t.equal(tiles.length, 1)
})
