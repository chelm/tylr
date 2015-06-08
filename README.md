tylr
====

Create a cache vector tiles from GeoJSON files.

## Install

`npm install -g tylr`

## Usage 

Using tylr can be done in 2 ways, either as a command line utility or as a node module.

### Command Line 

```bash
# using a -f to pass in features 
tylr -f ./examples/us-states.json -d ./output -n states -l 0,5 -t pbf

# OR stream features in like this
cat ./examples/us-states.json | tylr -d ./out -n states
```

### Node Module

```javascript

var options = {
  d: './out',
  n: 'layer-name',
  t: 'pbf',
  l: '0,5'
}
 
// pass the options into tylr
var tylr = require('tylr')(options)

// add array of features to tile
var features = [...]

// add each feature to tylr
feature.forEach(function (f) {
  tylr.addFeature(f);
})

// finally dump the features out to disk
tylr.writeTiles() 
```

### Options
    
* -f input geojson
* -n name of tiles (for client side rendering / styling)
* -t output type ('pbf', 'json')
* -d output dir
* -l zoom levels ( 0 to 20 ) 


## Formats 

Using the `-t` options you can have tylr create either protocol buffer tiles adhering to the [Mapbox Vector Tile Spec](https://github.com/mapbox/vector-tile-spec) or as [GeoJSON](http://geojson.org/) tiles. 
