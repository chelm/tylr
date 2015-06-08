var fs = require('fs'),
  mkdirp = require('mkdirp'),
  events = require('events'),
  tileCover = require('tile-cover'),
  mapnikTiles = require('mapnik-tiles'),
  zlib = require('zlib')

module.exports = function (options) {
  var tylr = new events.EventEmitter()
  tylr.options = options

  // array of features from the incoming stream
  var features = []

  // store geojson for each tile zoom
  // maps tiles to feature indexes
  var tileStore = {}

  tylr.parser = require('JSONStream').parse(options.pattern || 'features.*')
  tylr.parser.on('end', function () {
    tylr.writeTiles()
  })

  var levels = options.l.split(',')
  var verbose = options.v

  /**
   * Adds a feature to the list of features to be written
   */
  tylr.addFeature = function (feature) {
    features.push(feature)
    tylr.collect(feature.geometry, features.length - 1)
    if (verbose) {
      console.log(feature.properties)
    }
  }

  /**
   * Matches features to tiles
   * intersects a geom with a tile bbox
   */
  tylr.collect = function (geometry, index) {
    // for each zoom level figure out the tile
    var tiles, limits, key
    for (var z = levels[0]; z <= levels[1]; z++) {
      limits = {
        min_zoom: z,
        max_zoom: z
      }
      tiles = tileCover.tiles(geometry, limits)
      tiles.forEach(function (tile) {
        key = tile.join('-')
        if (!tileStore[key]) {
          tileStore[key] = []
        }
        tileStore[key].push(index)
      })
    }
  }

  /**
   * Loops over the tile indexes and build geojson to create tiles
   * has logic for writing either pbf or json tiles to disk
   */
  tylr.writeTiles = function () {
    for (var index in tileStore) {
      var indexes = tileStore[index]
      var xyz = index.split('-')
      var geojson = tylr.buildGeoJSON(indexes)
      if (tylr.options.t === 'geojson') {
        tylr.createJSONTile(xyz, geojson)
      } else {
        tylr.createPBFTile(xyz, geojson)
      }
    }
  }

  tylr.buildGeoJSON = function (indexes) {
    var geojson = {type: 'FeatureCollection', features: []}
    indexes.forEach(function (index) {
      geojson.features.push(features[index])
    })
    return geojson
  }

  /**
   * Write PBF tiles
   */
  tylr.createPBFTile = function (xyz, geojson) {
    var params = {
      format: 'pbf',
      name: tylr.options.name,
      z: parseInt(xyz[2], 0),
      x: parseInt(xyz[0], 0),
      y: parseInt(xyz[1], 0)
    }

    mapnikTiles.generate(geojson, params, function (err, tileBuffer, callback) {
      var p = [tylr.options.d, xyz[2], xyz[0]].join('/')
      var file = p + '/' + xyz[1] + '.pbf'
      if (err && callback) {
        callback(err, null)
      } else {
        mkdirp(p, function () {
          zlib.inflate(tileBuffer, function (e, tbuff) {
            fs.writeFile(file, tbuff, function () {})
          })
        })
      }
    })
  }

  /**
   * Write a tile to disk
   */
  tylr.createJSONTile = function (xyz, geojson) {
    var dir = [tylr.options.dir, xyz[2], xyz[0]].join('/')
    var file = dir + '/' + xyz[1] + '.json'

    mkdirp(dir, function () {
      fs.writeFile(file, JSON.stringify(options.json))
    })
  }

  return tylr
}
