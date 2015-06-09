var fs = require('fs'),
  mkdirp = require('mkdirp'),
  events = require('events'),
  tileBelt = require('tilebelt'),
  intersect = require('turf-intersect'),
  extent = require('turf-extent'),
  mapnikTiles = require('mapnik-tiles'),
  zlib = require('zlib')

module.exports = function (options) {
  var tylr = new events.EventEmitter()
  tylr.options = options

  // array of features from the incoming stream
  // tylr.features = []

  // store geojson for each tile zoom
  // maps tiles to feature indexes
  tylr.tileStore = {}

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
    // for each zoom level figure out the tile
    var tiles
    for (var z = levels[0]; z <= levels[1]; z++) {
      tiles = tylr.findTileCoverage(feature, parseInt(z, 0))
      tiles.forEach(function (tile) {
        if (!tylr.tileStore[tile]) {
          tylr.tileStore[tile] = []
        }
        tylr.tileStore[tile].push(feature)
      })
    }
  }

  /**
   * Gets the bbox of a feature and find unique tiles for each corner
   */
  tylr.findTileCoverage = function (feature, zoom) {
    var bbox = extent({type: 'FeatureCollection', features: [feature] }),
      parentTile = tileBelt.bboxToTile(bbox),
      tiles = []

    if (parentTile[2] > zoom) {
      var tileObj = {}
      tileObj[tileBelt.pointToTile(bbox[0], bbox[1], zoom).join('-')] = true
      tileObj[tileBelt.pointToTile(bbox[2], bbox[1], zoom).join('-')] = true
      tileObj[tileBelt.pointToTile(bbox[0], bbox[3], zoom).join('-')] = true
      tileObj[tileBelt.pointToTile(bbox[2], bbox[3], zoom).join('-')] = true
      tiles = Object.keys(tileObj)
      tiles = tiles.map(function (t) { return t.split('-') })
    } else {
      tiles = tylr.tilesInParent(parentTile, zoom)
    }

    var tileJSON, tileMatch = []
    tiles.forEach(function (tile) {
      tileJSON = tileBelt.tileToGeoJSON(tile)
      var coords = [[
        [ bbox[0], bbox[1] ],
        [ bbox[2], bbox[1] ],
        [ bbox[2], bbox[3] ],
        [ bbox[0], bbox[3] ],
        [ bbox[0], bbox[1] ]
      ]]
      var polygon = {
        type: 'Feature',
        geometry: {
          coordinates: coords,
          type: 'Polygon'
        }
      }
      try {
        if (intersect(tileJSON, polygon)) {
          tileMatch.push(tile.join('-'))
        }
      } catch (e) {
        console.log(e, tile, feature.properties)
      }

    })
    return tileMatch
  }

  /**
   * Creates an array of all the children tiles at the given zoom
   * must progress the zoom level up until it matches the passes in level
   * and collect tiles only at the highest zoom
   *
   *
   */
  tylr.tilesInParent = function (parentTile, zoom) {
    var tiles = [],
      parentZ = parentTile[2]

    var loopChildren = function (children) {
      children.forEach(function (child) {
        if (child[2] === zoom) {
          tiles.push(child)
        } else if (child[2] < zoom) {
          loopChildren(tileBelt.getChildren(child))
        }
      })
    }

    // are the zooms the same
    if (parentZ === zoom) {
      tiles = [parentTile]
      return tiles
    } else if (parentZ < zoom) {
      loopChildren(tileBelt.getChildren(parentTile))
      return tiles
    }
  }

  /**
   * Loops over the tile indexes and build geojson to create tiles
   * has logic for writing either pbf or json tiles to disk
   */
  tylr.writeTiles = function () {
    var tiles = Object.keys(tylr.tileStore)

    var next = function (index) {

      if (!index) {
        console.log('All done!')
        return
      } else {
        var features = tylr.tileStore[index]
        var xyz = index.split('-')
        var geojson = tylr.buildGeoJSON(features)

        if (tylr.options.t === 'geojson') {
          tylr.createJSONTile(xyz, geojson, function () {
            next(tiles.pop())
          })
        } else {
          tylr.createPBFTile(xyz, geojson, function () {
            next(tiles.pop())
          })
        }
      }
    }
    next(tiles.pop())
  }

  tylr.buildGeoJSON = function (list) {
    var geojson = {type: 'FeatureCollection', features: []}
    list.forEach(function (f) {
      geojson.features.push(f) // tylr.features[index-1])
    })
    return geojson
  }

  /**
   * Write PBF tiles
   */
  tylr.createPBFTile = function (xyz, geojson, callback) {
    var z = parseInt(xyz[2], 0),
      y = parseInt(xyz[1], 0),
      x = parseInt(xyz[0], 0)

    var params = {
      format: 'pbf',
      name: tylr.options.name,
      z: z,
      x: x,
      y: y
    }

    mapnikTiles.generate(geojson, params, function (err, tileBuffer) {
      var p = [tylr.options.d, z, x].join('/')
      var file = p + '/' + y + '.pbf'

      if (verbose) {
        console.log(file)
      }

      if (err) {
        console.log(err)
      } else {
        mkdirp(p, function () {
          zlib.inflate(tileBuffer, function (e, tbuff) {
            fs.writeFile(file, tbuff, function () { callback() })
          })
        })
      }
    })
  }

  /**
   * Write a tile to disk
   */
  tylr.createJSONTile = function (xyz, geojson, callback) {
    var dir = [tylr.options.d, xyz[2], xyz[0]].join('/')
    var file = dir + '/' + xyz[1] + '.json'
    mkdirp(dir, function () {
      fs.writeFile(file, JSON.stringify(options.json), function () { callback() })
    })
  }

  return tylr
}
