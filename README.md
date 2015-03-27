tylr
====

Vector tile caching from GeoJSON files

## Install

    npm install -g tylr 

## Usage 

    tylr -f ./examples/us-states.json -d ./output -l 0,5 -a algo

  * Options
    
    -f input geojson
    
    -d output dir
    
    -l zoom levels ( 0 to 20 )

    -a algo center or box
       center : One tile touching the center of the boundary box of the geo area 
       box : All the tiles touching the boundary box of the geo area
