// territory-manager.js

const districts = Array.from({ length: 150 }, (_, i) => {
  const id = `district${i + 1}`;
  return {
    id,
    name: `Територія ${i + 1}`,
    color: 'blue',
    fillColor: '#99ccff',
  };
});

const overlayMaps = {};
const geoJsonLayers = {};
const districtCenters = [];
const districtGeometries = [];
const loadedLayers = [];
let layersControl = null;

function loadTerritories(map, db, getStatusPopup) {
  showLoading(true);
  districts.forEach(d => {
    const layer = L.layerGroup();
    fetch(`${d.id}.json`)
      .then(res => res.json())
      .then(data => {
        const geoJsonLayer = L.geoJSON(data, {
          onEachFeature: (feature, layer) => {
            const center = layer.getBounds().getCenter();
            districtCenters.push({ name: feature.properties?.name || d.name, latlng: center });
            layer.on("click", async () => {
              const popupContent = await getStatusPopup(d.id.replace("district", ""), d.name);
              layer.bindPopup(popupContent + `<br><button onclick=\"routeToDistrict('${d.name}')\">📌 Прокласти маршрут сюди</button>`).openPopup();
            });
          },
          style: { color: d.color, fillColor: d.fillColor, fillOpacity: 0.4 }
        });
        geoJsonLayers[d.name] = geoJsonLayer;
        geoJsonLayer.addTo(layer);
        overlayMaps[d.name] = layer;
        loadedLayers.push(d.name);
        tryAddLayersControl(map);

        const coordinates = [];
        const geometries = data.type === "GeometryCollection" ? data.geometries : [data.geometry];
        geometries.forEach(geom => {
          const coords = geom.coordinates;
          const pushCoords = ring => ring.forEach(c => coordinates.push(L.latLng(c[1], c[0])));
          if (geom.type === "Polygon") coords.forEach(pushCoords);
          if (geom.type === "MultiPolygon") coords.forEach(polygon => polygon.forEach(pushCoords));
        });
        districtGeometries.push({ name: d.name, coordinates });
        showLoading(false);
      })
      .catch(err => {
        alert(`⚠ Не вдалося завантажити ${d.id}.json`);
        showLoading(false);
      });
  });
}

function tryAddLayersControl(map) {
  if (loadedLayers.length === districts.length && !layersControl) {
    layersControl = L.control.layers(
      { "Стандартна карта": googleStreets, "Супутникова карта": satellite },
      overlayMaps,
      { collapsed: true }
    ).addTo(map);
  }
}

function showAllTerritories(map) {
  Object.values(overlayMaps).forEach(layer => map.addLayer(layer));
}

function hideAllTerritories(map) {
  Object.values(overlayMaps).forEach(layer => map.removeLayer(layer));
}

async function filterTerritories(map, db, currentUser, statusFilter) {
  if (!currentUser) {
    alert("⛔ Увійдіть, щоб бачити статус територій");
    return;
  }
  showLoading(true);
  hideAllTerritories(map);
  for (const d of districts) {
    const q = query(
      collection(db, `territories/${d.id.replace("district", "")}/history`),
      orderBy("timestamp", "desc")
    );
    const snap = await getDocs(q);
    let status = 'вільно';
    if (!snap.empty) {
      const data = snap.docs[0].data();
      status = data.status;
    }
    if (status === statusFilter) {
      map.addLayer(overlayMaps[d.name]);
    }
  }
  showLoading(false);
}

export {
  districts,
  geoJsonLayers,
  overlayMaps,
  districtCenters,
  districtGeometries,
  loadTerritories,
  showAllTerritories,
  hideAllTerritories,
  filterTerritories
};
