# geojson-dijkstra

A GeoJSON-first implementation of [Dijkstra](https://en.wikipedia.org/wiki/Dijkstra's_algorithm) and [A*](https://en.wikipedia.org/wiki/A*_search_algorithm) for NodeJS.

This repo is heavily indebted to the great [ngraph.path](https://github.com/anvaka/ngraph.path) library, which instructed a good portion of the data model for *geojson-dijkstra*.  Extra thanks to @mourner for creating a blazing fast priority queue.

If you are looking for a more flexible, general-purpose pathfinding library, you should consider using NGraph instead.

## Quickstart

```
npm install geojson-dijkstra --save
```

```
const fs = require('fs');
const { Graph, CoordinateLookup, buildGeoJsonPath, buildEdgeIdList } = require('geojson-dijkstra');

const geojson = JSON.parse(fs.readFileSync('./networks/test.geojson'));

const graph = new Graph(geojson);

// create a coordinate lookup to be able to input arbitrary coordinate pairs
// and return the nearest coordinates in the network
const lookup = new CoordinateLookup(graph);
const coords1 = lookup.getClosestNetworkPt(-101.359, 43.341);
const coords2 = lookup.getClosestNetworkPt(-91.669, 40.195);

// create a finder, in which you may specify your A* heuristic (optional)
// and add extra attributes to the result object
const finder = graph.createFinder({ parseOutputFns: [buildGeoJsonPath, buildEdgeIdList] });

// the result will contain a total_cost attribute,
// as well as additional attributes you specified when creating a finder
const result = finder.findPath(coords1, coords2);

```

## Input GeoJSON

Each geojson feature's `properties` object must contain an `_id` attribute (as a number) and a `_cost` attribute (as a non-zero number).

Additionally, the following properties can be used to customize:

* `_direction`: a value of `"f"` indicates that the linestring is valid in the forward direction only. default is valid in both directions.
* `_forward_cost`: (number, overrides _cost) cost in the forward direction
* `_backward_cost`: (number, overrides _cost) cost in the backward direction

## API

```
const graph = new Graph(geojson, options_object);
```

Create new new graph.  `options_object` is an object with the following (optional) property:

`mutate_inputs`: (default false)

Allows the mutation of the source dataset.  Dramatically speeds up loading large datasets.  Do not use this options if your in-memory geojson will be used in other places in your application.

**Graph Methods**

```
const finder = graph.createFinder({options_object});
```

Creates a `finder` object with one property; the `findPath` function.

The `options_object` for `graph.createFinder` includes the following **optional** properties:

 - `heuristic`:  This activates A* mode, and will dramatically speed up routing.  The function will be supplied with `(fromCoords, toCoords)`, (the current and end node in a graph) in which both of parameters are of type `[lng, lat]`. The heuristic function will return an estimated `_cost` of the travel between the two nodes.

Without a heuristic function your path will be routed by a standard implementation of Dijkstra algorithm.

Defining a heuristic function that has not been properly considered can result in suboptimal paths, so beware!

The trick to creating a good heuristic function is to try to guess the `_cost` between the current node and the end node **without overestimating**.

 - `outputFns`:  These function determine the answers you will receive from your pathfinding.  

You can provide a single function by itself, an array of functions, or nothing at all.

By default, running `findPath` will return a response with only a `total_cost` property:

```
{
  total_cost: 123
}
```

To provide additional outputs, you can add (or create your own) `outputFunctions` functions which can parse Dijkstra internals into usable outputs.

Two built-in output functions are:

 - **buildGeoJsonPath**

Will append `{ path: (geojson) }` to the response object, where `path` is a GeoJSON linestring of all edges and properties along the shortest path.

 - **buildEdgeIdList**

Will append `{ edge_list: [array, of, ids] }` to the response object, where `edge_list` is an ordered array of edge-ids `[1023, 1024, 1025]`, corresponding to the `_id` property in your input GeoJSON file.

**Finder Methods**

```
const path = finder.findPath(startCoordinates, endCoordinates);
```

Runs Dijkstra's algorithm from the `startCoordinates` to the `endCoordinates`.  Coordinates must be in the form of [lng, lat], where `lng` and `lat` are both numbers (not strings!).

These coordinates must exactly correspond to network nodes in your graph (the start or end points of actual linestrings in your geoJSON).  Because this can be inconvenient, the library provides a `CoordinateLookup` service which will take an input coordinate, and provide the closest network node.

**CoordinateLookup**

A fast geographically indexed coordinate lookup service leveraging [geokdbush](https://github.com/mourner/geokdbush).

```
const lookup = new CoordinateLookup(graph);
const longitude = -120.868893;
const latitude = 39.500155;
const startOfPath = lookup.getClosestNetworkPt(longitude, latitude);
```

Provide a `longitude` and `latitude` coordinate, and receive an array: `[lng, lat]` corresponding to the nearest node in your network.


## How fast is it?

Suffice to say; if this is not fast enough, you'll need to seek a solution implemented in a compiled language.

## Motivation?

I built this library mainly as a data-structure base to build a [Contraction Hierarchy](https://en.wikipedia.org/wiki/Contraction_hierarchies).

Pre-processing a graph using a Contraction Hiererarchy can result in pathfinding performance that far exceeds A*.

**[Contraction Hierarchy](https://github.com/royhobbstn/contraction-hierarchy-js) project** (in progress)
