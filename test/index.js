var test = require('tape')

var options = {
  d: './output',
  n: 'test',
  l: '0,0',
  t: 'pbf'
}

var tylr = require('../tylr')(options)

var features = [{
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Point',
    coordinates: [0, 0]
  }
}]

test('adds a feature to the tile index', function (t) {
  t.plan(2)
  tylr.addFeature(features[0])
  t.equal(tylr.features.length, 1)
  t.equal(Object.keys(tylr.tileStore).length, 1)
})

test('can build geojson from a feature index', function (t) {
  t.plan(1)
  tylr.features = []
  tylr.tileStore = {}
  tylr.addFeature(features[0])
  var geojson = tylr.buildGeoJSON(tylr.tileStore['0-0-0'])
  t.equal(geojson.features.length, 1)
})
