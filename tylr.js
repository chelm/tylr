var nfs = require('fs');
var async = require('async');
var mapnikTiles = require('mapnik-tiles');
var zlib = require('zlib');

module.exports = {

  tyle: function( options ){
    var self = this;
    var file = options.f;
    var dir = options.d;
    var levels = options.l.split(',');
    var type = options.t;   
    var algo = options.a;
    var name = options.n;

    console.log( file, dir, levels, algo );
    if ( nfs.existsSync( file ) ) {
      nfs.readFile( file, function( err, data ){
        var features = JSON.parse(data).features;
        //console.log('features', features);
        features.forEach(function( f ){
          //console.log('f', f);
          var llArray = [];
          llArray = self.getTiles(f.geometry , levels, algo);
          for(i = 0 ;i < llArray.length; i++) {
            self.storeJson({ type: "json", dir: dir, x: llArray[i].x, y: llArray[i].y, z: llArray[i].z, feature: f });
          }
        });

        for ( var obj in self.localJson ) {
          var xyz = obj.split('/');
          if ( type === 'pbf' ) {
            self.writePBF({ name: name, type: "pbf", dir: dir, z: xyz[0], x: xyz[1], y: xyz[2], json: self.localJson[obj]});
          } else {
            self.writeJSON({ type: "json", dir: dir, z: xyz[0], x: xyz[1], y: xyz[2], json: self.localJson[obj] }, function (err) {} );
          }
        }

      });
    } else {
      console.log('Can\'t find input geojson file');
    }

  },

  /*local json storage before writing to disk*/
  storeJson: function(options) {
    this.localJson = this.localJson || {};
    var key = [options.z, options.x, options.y].join('/');

    if ( !this.localJson[key] ) {
      this.localJson[key] = { type:'FeatureCollection', features: [ options.feature ] };
    } else {
      this.localJson[key].features.push(options.feature);
    }

  },


  getTiles: function(geom, levels, algo ){
    var self = this;

    var minx, miny, maxx, maxy;

    function adjust( c ){
      var len = c.length;
      while ( len-- ){
        var p = c[len];
        minx = ( p[0] < minx ) ? p[0] : minx;
        miny = ( p[1] < miny ) ? p[1] : miny;
        maxx = ( p[0] > maxx ) ? p[0] : maxx;
        maxy = ( p[1] > maxy ) ? p[1] : maxy;
      }
    }

    if (geom.type == 'MultiPolygon'){
      var coords = geom.coordinates[0];
      minx = coords[0][0][0],
        miny = coords[0][0][1],
        maxx = coords[0][0][0],
        maxy = coords[0][0][1];
      geom.coordinates.forEach(function( polygon ){
        adjust( polygon[0] );
      });
    } else {
      var coords = geom.coordinates[0];
      minx = coords[0][0],
        miny = coords[0][1],
        maxx = coords[0][0],
        maxy = coords[0][1];
      
      adjust( geom.coordinates[0] ); 
    }
    var z = parseInt( levels[0] );
    var xyzArray = [];
    
    while ( z <= levels[ 1 ] ) {
      switch( algo ) {
        case 'center':
          // We add one tile touching the center of the boundary box of the geo area
          xyzArray.push( self.location( (maxy + miny) / 2, (maxx + minx) / 2, z ) );
          break;
        case 'box':
          // We add all the tiles touching the boundary box of the geo area
          // * Taking the tile up right and the tile left down
          var xyzMin = self.location( miny , minx, z );
          var xyzMax = self.location( maxy , maxx, z );
          //console.log('box : x [' + xyzMin.x + ', ' + xyzMax.x + '] - y [' + xyzMax.y + ', ' + xyzMin.y + ']'); 
          // for all tile in this area
          for( y = xyzMax.y; y <= xyzMin.y; y++) {
            for( x = xyzMin.x; x <= xyzMax.x; x++) {
              xyzArray.push( {y: y , x: x, z: z } );
            }
          }
          break;
        default:
          console.log('Algo "' + algo + '" undefined. Available : "center" or box' );
      }
      z++;
    }
    return( xyzArray );
  },

  location: function( lat, lon, zoom ) {
    var lon_rad = lon * (Math.PI / 180),
      lat_rad = lat * (Math.PI / 180),
      n = Math.pow(2.0, zoom);
  
    var tileX = Math.floor( ( ( lon + 180 ) / 360 ) * n );
    var tileY = Math.floor( ( 1 - ( Math.log( Math.tan( lat_rad ) + 1.0 / Math.cos( lat_rad ) ) / Math.PI ) ) * n / 2.0 );
  
    return { x : tileX, y: tileY, z: zoom };
  },

  /*
  * Write PBF tiles
  */
  writePBF: function(options) {
    var self = this;
    var params = {
      format: 'pbf',
      name: options.name,
      z: parseInt(options.z),
      x: parseInt(options.x),
      y: parseInt(options.y)
    };

    mapnikTiles.generate(options.json, params, function(err, tileBuffer) {
      var p = [options.dir, options.z, options.x].join('/');
      var file = p + '/' + options.y + '.pbf';
      
      if ( err ) {
        callback( err, null );
      } else {
        nfs.mkdir( p, '0777', true, function() {
          zlib.inflate(tileBuffer, function(e, tbuff) {
            nfs.writeFile( file, tbuff, function( err ) {});
          });
        });
      }
    });
  },


  /*
  * Write JSON tiles
  */
  writeJSON: function(options) {
    var p = [options.dir, options.z, options.x].join('/');
    var file = p + '/' + options.y + '.json';

    nfs.mkdir( p, '0777', true, function(){
      nfs.writeFile( file, JSON.stringify( options.json ));
    });
  }

};
  

/*function centroid( coords ){
  var area = 0;
  var p1, p2, f;
  var x = 0, y = 0;

  coords.forEach(function(c){
    var nPts = c.length;

    for ( var i=0; i < nPts; j = i++ ) {
      var j = nPts - 1;
      p1 = c[i];
      p2 = c[j];
      area += p1[1] * p2[0];
      area -= p1[0] * p2[1];

      f = p1[1] * p2[0] - p2[1] * p1[0];

      x += ( p1[1] + p2[1] ) * f;
      y += ( p1[0] + p2[0] ) * f;
    }
  });

  f = area * 3;
  return [ x/f + coords[0][0][0], y/f + coords[0][0][1] ];
}*/
