tylr
====

Vector tile caching from GeoJSON files

## Install

    npm install -g tylr 

## Usage 

    tylr -f ./examples/us-states.json -d ./output -l 0,5 -a center

  * Options
    
    -f input geojson
    
    -d output dir
    
    -l zoom levels ( 0 to 20 ) 

    -a algo use to choose tile (choose between center and box algorithm)
       
       * center : choose one tile touching the center of the boundary geo zone area
       * box : choose all tile touching the boundary box of the geo area
