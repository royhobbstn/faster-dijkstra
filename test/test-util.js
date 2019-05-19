//
const fs = require('fs').promises;

exports.readyNetwork = readyNetwork;
exports.cleanseNetwork = cleanseNetwork;
exports.getNGraphDist = getNGraphDist;
exports.populateNGraph = populateNGraph;

async function readyNetwork() {

  const geojson_raw = await fs.readFile('../networks/faf.geojson'); // full_network
  const geojson = JSON.parse(geojson_raw);

  //set up cost field
  geojson.features.forEach(feat => {
    const mph = getMPH(feat.properties.NHS);
    feat.properties._cost = (feat.properties.MILES / 60) * mph;
    feat.properties._id = feat.properties.ID;
  });

  // clean network
  geojson.features = geojson.features.filter(feat => {
    if (feat.properties._cost && feat.geometry.coordinates &&
      ( /*feat.properties.STFIPS === 6 || feat.properties.STFIPS === 41 ||*/ feat.properties.STFIPS === 53)) {
      return true;
    }
  });

  return geojson;
}

function getMPH(nhs) {
  switch (nhs) {
    case 1:
      return 70;
    case 2:
      return 60;
    case 3:
      return 50;
    case 4:
      return 40;
    case 7:
      return 30;
    case 8:
      return 20;
    default:
      return 10;
  }
}

function cleanseNetwork(geojson) {

  // get rid of duplicate edges (same origin to dest)
  const inventory = {};
  geojson.features.forEach(feature => {
    const start = feature.geometry.coordinates[0].join(',');
    const end = feature.geometry.coordinates[feature.geometry.coordinates.length - 1].join(',');
    const id = `${start}|${end}`;

    const reverse_id = `${end}|${start}`;

    if (!feature.properties._direction || feature.properties._direction === 'all' || feature.properties._direction === 'f') {

      if (!inventory[id]) {
        // new segment
        inventory[id] = feature;
      }
      else {
        // a segment with the same origin/dest exists.  choose shortest.
        const old_cost = inventory[id].properties._cost;
        const new_cost = feature.properties._forward_cost || feature.properties._cost;
        if (new_cost < old_cost) {
          // mark old segment for deletion
          inventory[id].properties.__markDelete = true;
          // rewrite old segment because this one is shorter
          inventory[id] = feature;
        }
        else {
          // instead mark new feature for deletion
          feature.properties.__markDelete = true;
        }
      }

    }

    if (!feature.properties._direction || feature.properties._direction === 'all' || feature.properties._direction === 'b') {
      // now reverse
      if (!inventory[reverse_id]) {
        // new segment
        inventory[reverse_id] = feature;
      }
      else {
        // a segment with the same origin/dest exists.  choose shortest.
        const old_cost = inventory[reverse_id].properties._cost;
        const new_cost = feature.properties._backward_cost || feature.properties._cost;
        if (new_cost < old_cost) {
          // mark old segment for deletion
          inventory[reverse_id].properties.__markDelete = true;
          // rewrite old segment because this one is shorter
          inventory[reverse_id] = feature;
        }
        else {
          // instead mark new feature for deletion
          feature.properties.__markDelete = true;
        }
      }
    }

  });


  // filter out marked items
  geojson.features = geojson.features.filter(feature => {
    return !feature.properties.__markDelete;
  });

  return geojson;
}


function populateNGraph(ngraph, geojson) {

  geojson.features.forEach(feature => {
    const start = feature.geometry.coordinates[0];
    const end = feature.geometry.coordinates[feature.geometry.coordinates.length - 1];

    ngraph.addNode(String(start), { lng: start[0], lat: start[1] });
    ngraph.addNode(String(end), { lng: end[0], lat: end[1] });

    const properties = Object.assign({}, feature.properties, { _geometry: feature.geometry.coordinates });

    ngraph.addLink(String(start), String(end), properties);

    if (properties._direction !== 'f') {
      ngraph.addLink(String(end), String(start), properties);
    }

  });

}

function getNGraphDist(path) {

  const edge_ids = [];
  let distance = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const start_node = path[i].id;
    const end_node = path[i + 1].id;

    path[i]['links'].forEach(link => {
      if ((link.toId === start_node && link.fromId === end_node)) {
        edge_ids.push(link.data._id);
        distance += link.data._cost;
      }

    });

  }

  return { edgelist: edge_ids.reverse(), distance };
}
