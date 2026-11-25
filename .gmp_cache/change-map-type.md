# Change the Map Type

## Overview

The Maps JavaScript API uses a `MapType` object to hold information about the
visual presentation of map tiles and the translation of coordinate systems from
screen coordinates to world coordinates. Rather than assigning a `MapType`
object directly to a map, you set its `mapTypeId` property to reference an
identifier managed by the map's internal `MapTypeRegistry`.

You can configure the map to use one of the standard basic map types (`roadmap`,
`satellite`, `hybrid`, or `terrain`), customize the appearance of standard maps
using styled maps, or define your own tile sets and overlays using custom map
types and custom projections.

## Prerequisites

Before changing or customizing map types, ensure you have completed the base
setup:

-   **Add a customizable, interactive map to a web page or mobile app** (Maps
    JavaScript API loaded with a valid API key and a rendered map container).

--------------------------------------------------------------------------------

## Basic Map Types

The Maps JavaScript API provides four basic map types:

-   **`roadmap`**: Displays the default road map view with basemap labels (this
    is the default `mapTypeId`).
-   **`satellite`**: Displays a photorealistic map based on aerial imagery.
-   **`hybrid`**: Displays the satellite map view overlaid with basemap road and
    feature labels.
-   **`terrain`**: Displays a physical map based on terrain and elevation
    information.

> **Note:** 3D Maps (`Map3DElement`) only supports `SATELLITE` and `HYBRID`
> modes.

### Setting the Map Type at Initialization

Pass the `mapTypeId` property within the `MapOptions` object when instantiating
`google.maps.Map`:

```javascript
async function initMap() {
  const { Map } = await google.maps.importLibrary("maps");

  const mapOptions = {
    zoom: 8,
    center: { lat: -34.397, lng: 150.644 },
    mapTypeId: 'satellite',
    internalUsageAttributionIds: ['gmp_git_agentskills_v1'],
  };

  const map = new Map(document.getElementById('map'), mapOptions);
}

initMap();
```

### Modifying the Map Type Dynamically

To change the map type after the map has been initialized, call `setMapTypeId()`
on the `Map` instance:

```javascript
map.setMapTypeId('terrain');
```

You can also listen for map type changes using the `maptypeid_changed` event:

```javascript
map.addListener('maptypeid_changed', () => {
  console.log('Current Map Type:', map.getMapTypeId());
});
```

--------------------------------------------------------------------------------

## 3D Maps & 45° Perspective View

> **Deprecation Notice:** As of version 3.65 (May 2026), `satellite` and
> `hybrid` 2D map types no longer automatically switch to 45° imagery at higher
> zoom levels, and calls to `map.setTilt(45)` are ineffective. Applications
> requiring 45° perspective views should use **3D Maps** (`Map3DElement`).

### Rendering a 3D Map with Satellite Imagery

```javascript
async function init() {
  const { Map3DElement } = await google.maps.importLibrary('maps3d');

  const map = new Map3DElement({
    center: {
      lat: 37.789,
      lng: -122.401,
      altitude: 0,
    },
    range: 2200,
    tilt: 45,
    heading: 188,
  });

  map.mode = 'SATELLITE';
  map.setAttribute('internal-usage-attribution-ids', 'gmp_git_agentskills_v1');
  document.body.append(map);
}

void init();
```

--------------------------------------------------------------------------------

## Modifying the Map Type Registry

Each `Map` instance maintains a `MapTypeRegistry` (`map.mapTypes`), which holds
the collection of available `MapType` implementations for that map. To use a
custom or styled map type:

1.  Include your custom string identifier in `mapTypeControlOptions.mapTypeIds`
    if you want it to be selectable in the UI control.
2.  Register the custom `MapType` instance with `map.mapTypes.set(id,
    mapTypeInstance)`.
3.  Activate it via `map.setMapTypeId(id)` or in the initial `MapOptions`.

```javascript
const MY_MAPTYPE_ID = 'custom_style';

const mapOptions = {
  zoom: 12,
  center: { lat: 40.674, lng: -73.945 },
  mapTypeControlOptions: {
    mapTypeIds: ['roadmap', MY_MAPTYPE_ID]
  },
  mapTypeId: MY_MAPTYPE_ID,
  internalUsageAttributionIds: ['gmp_git_agentskills_v1'],
};

const map = new google.maps.Map(document.getElementById('map'), mapOptions);

// Associate the string ID with your MapType instance in the registry
map.mapTypes.set(MY_MAPTYPE_ID, myCustomMapType);
```

> **Note:** If you want to update styles across multiple apps, use Cloud-based
> maps styling with a `mapId`. Do **not** combine cloud customization (`mapId`)
> and hardcoded local JSON styling (`styles`) in the same map configuration.

--------------------------------------------------------------------------------

## Custom Map Types

The Maps JavaScript API supports three primary custom map type patterns:

1.  **Image Map Types (`google.maps.ImageMapType`)**: Standard image tile sets
    acting as full base maps or overlays.
2.  **Base Map Types (`google.maps.MapType` interface)**: Custom DOM
    nodes/elements replacing the standard base map tiles.
3.  **Overlay Map Types (`map.overlayMapTypes`)**: Transparent or
    semi-transparent tile layers displayed on top of an existing base map.

### 1. Image Map Types (`ImageMapType`)

For custom map types composed of single image files per tile, use the built-in
`google.maps.ImageMapType` class. It requires an `ImageMapTypeOptions` object
specifying `tileSize` (`google.maps.Size`) and a `getTileUrl(coord, zoom)`
function.

```typescript
// Source: https://github.com/googlemaps/js-samples
async function initMap(): Promise<void> {
  const { Map, ImageMapType } = await google.maps.importLibrary("maps") as google.maps.MapsLibrary;
  const { Size } = await google.maps.importLibrary("core") as google.maps.CoreLibrary;

  const map = new Map(
    document.getElementById("map") as HTMLElement,
    {
      center: { lat: 0, lng: 0 },
      zoom: 1,
      streetViewControl: false,
      mapTypeControlOptions: {
        mapTypeIds: ["moon"],
      },
      internalUsageAttributionIds: ["gmp_git_agentskills_v1"],
    }
  );

  const moonMapType = new ImageMapType({
    getTileUrl: function (coord, zoom): string {
      const normalizedCoord = getNormalizedCoord(coord, zoom);
      if (!normalizedCoord) {
        return "";
      }
      const bound = Math.pow(2, zoom);
      return (
        "https://mw1.google.com/mw-planetary/lunar/lunarmaps_v1/clem_bw" +
        "/" + zoom + "/" + normalizedCoord.x + "/" +
        (bound - normalizedCoord.y - 1) + ".jpg"
      );
    },
    tileSize: new Size(256, 256),
    maxZoom: 9,
    minZoom: 0,
    name: "Moon",
  });

  map.mapTypes.set("moon", moonMapType);
  map.setMapTypeId("moon");
}

// Normalizes coordinates so tiles repeat horizontally (x-axis) but not vertically (y-axis).
function getNormalizedCoord(coord: google.maps.Point, zoom: number) {
  const y = coord.y;
  let x = coord.x;
  const tileRange = 1 << zoom;

  if (y < 0 || y >= tileRange) {
    return null;
  }
  if (x < 0 || x >= tileRange) {
    x = ((x % tileRange) + tileRange) % tileRange;
  }
  return { x: x, y: y };
}
```

### 2. Implementing the `MapType` Interface (Custom Base Maps)

To build a non-image or custom DOM tile map type, create a class implementing
`google.maps.MapType`:

-   **Required properties**: `tileSize` (`google.maps.Size`), `maxZoom`
    (`number`).
-   **Optional properties**: `minZoom` (`number`), `name` (`string`), `alt`
    (`string`), `projection` (`google.maps.Projection`).
-   **Required method**: `getTile(tileCoord: Point, zoom: number, ownerDocument:
    Document): Element`
-   **Optional method**: `releaseTile(tile: Element): void`

```typescript
class CoordMapType implements google.maps.MapType {
  tileSize: google.maps.Size;
  maxZoom = 19;
  name = "Tile #s";
  alt = "Tile Coordinate Map Type";

  constructor(tileSize: google.maps.Size) {
    this.tileSize = tileSize;
  }

  getTile(
    coord: google.maps.Point,
    zoom: number,
    ownerDocument: Document
  ): HTMLElement {
    const div = ownerDocument.createElement("div");
    div.innerHTML = String(coord);
    div.style.width = this.tileSize.width + "px";
    div.style.height = this.tileSize.height + "px";
    div.style.fontSize = "10";
    div.style.borderStyle = "solid";
    div.style.borderWidth = "1px";
    div.style.borderColor = "#AAAAAA";
    div.style.backgroundColor = "#E5E3DF";
    return div;
  }

  releaseTile(tile: Element): void {
    // Clean up any attached listeners or state when a tile falls out of view
  }
}

async function initMap(): Promise<void> {
  const { Map } = await google.maps.importLibrary("maps") as google.maps.MapsLibrary;
  const { Size } = await google.maps.importLibrary("core") as google.maps.CoreLibrary;

  const map = new Map(document.getElementById("map") as HTMLElement, {
    zoom: 10,
    center: { lat: 41.85, lng: -87.65 },
    streetViewControl: false,
    mapTypeId: "coordinate",
    mapTypeControlOptions: {
      mapTypeIds: ["coordinate", "roadmap"],
      style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
    },
    internalUsageAttributionIds: ["gmp_git_agentskills_v1"],
  });

  map.addListener("maptypeid_changed", () => {
    const showStreetViewControl = map.getMapTypeId() !== "coordinate";
    map.setOptions({ streetViewControl: showStreetViewControl });
  });

  map.mapTypes.set("coordinate", new CoordMapType(new Size(256, 256)));
}
```

### 3. Overlay Map Types

To render a custom `MapType` on top of an existing base map (such as `roadmap`),
insert it into the map's `overlayMapTypes` `MVCArray` instead of registering it
as a standalone base map. Overlays with higher index values render in front of
overlays with lower index values.

```typescript
const coordOverlay = new CoordMapType(new google.maps.Size(256, 256));
// Ensure backgroundColor is not opaque in getTile() so the base map shows through
map.overlayMapTypes.insertAt(0, coordOverlay);
```

--------------------------------------------------------------------------------

## Custom Projections

Google Maps uses the Web Mercator projection by default. To use a custom
rectilinear projection on a custom `MapType`, assign an object implementing the
`google.maps.Projection` interface to the `MapType.projection` property:

-   `fromLatLngToPoint(latLng: LatLng, point?: Point): Point`: Converts
    geographic `LatLng` coordinates into world coordinates.
-   `fromPointToLatLng(pixel: Point, noWrap?: boolean): LatLng`: Converts world
    coordinates back into geographic `LatLng` coordinates.

```typescript
// Source: https://github.com/googlemaps/js-samples/blob/HEAD/samples/map-projection-simple/index.ts?utm_campaign=gmp_git_agentskills_v1
async function initGallPeters(): Promise<google.maps.ImageMapType> {
  const [{ ImageMapType }, { Size, Point, LatLng }] = await Promise.all([
    google.maps.importLibrary('maps') as Promise<google.maps.MapsLibrary>,
    google.maps.importLibrary('core') as Promise<google.maps.CoreLibrary>,
  ]);

  const GALL_PETERS_RANGE_X = 800;
  const GALL_PETERS_RANGE_Y = 512;

  const gallPetersMapType = new ImageMapType({
    getTileUrl(coord, zoom) {
      const scale = 1 << zoom;
      const x = ((coord.x % scale) + scale) % scale;
      const y = coord.y;
      if (y < 0 || y >= scale) return '';

      return `https://developers.google.com/maps/documentation/javascript/examples/full/images/gall-peters_${zoom}_${x}_${y}.png`;
    },
    tileSize: new Size(GALL_PETERS_RANGE_X, GALL_PETERS_RANGE_Y),
    minZoom: 0,
    maxZoom: 1,
    name: 'Gall-Peters',
  });

  gallPetersMapType.projection = {
    fromLatLngToPoint(latLng: google.maps.LatLng) {
      const latRadians = (latLng.lat() * Math.PI) / 180;
      return new Point(
        GALL_PETERS_RANGE_X * (0.5 + latLng.lng() / 360),
        GALL_PETERS_RANGE_Y * (0.5 - 0.5 * Math.sin(latRadians))
      );
    },
    fromPointToLatLng(point: google.maps.Point, noWrap?: boolean) {
      const x = point.x / GALL_PETERS_RANGE_X;
      const y = Math.max(0, Math.min(1, point.y / GALL_PETERS_RANGE_Y));

      return new LatLng(
        (Math.asin(1 - 2 * y) * 180) / Math.PI,
        -180 + 360 * x,
        noWrap
      );
    },
  };

  return gallPetersMapType;
}
```

--------------------------------------------------------------------------------

## React Integration (`@vis.gl/react-google-maps`)

When using `@vis.gl/react-google-maps`, pass `mapTypeId`, `mapId`, or `styles`
directly as props to the `<Map>` component.

> **Important Billing & Lifecycle Note:** Due to how the Maps JavaScript API
> works, changing the `mapId` prop dynamically requires creating a new
> underlying `google.maps.Map` instance, which triggers a new billable map load.
> Changing `mapTypeId` or local `styles` on an existing `Map` instance does not
> recreate the map.

```tsx
// Source: https://github.com/visgl/react-google-maps/blob/HEAD/examples/change-map-styles/src/app.tsx?utm_campaign=gmp_git_agentskills_v1
import React, { useState } from 'react';
import { APIProvider, Map } from '@vis.gl/react-google-maps';

const MapTypeId = {
  HYBRID: 'hybrid',
  ROADMAP: 'roadmap',
  SATELLITE: 'satellite',
  TERRAIN: 'terrain'
};

export const MapTypeSwitcherApp = () => {
  const [mapTypeId, setMapTypeId] = useState<string>(MapTypeId.ROADMAP);

  return (
    <APIProvider apiKey={process.env.GOOGLE_MAPS_API_KEY as string}>
      <select value={mapTypeId} onChange={(e) => setMapTypeId(e.target.value)}>
        <option value={MapTypeId.ROADMAP}>Roadmap</option>
        <option value={MapTypeId.SATELLITE}>Satellite</option>
        <option value={MapTypeId.HYBRID}>Hybrid</option>
        <option value={MapTypeId.TERRAIN}>Terrain</option>
      </select>

      <Map
        defaultCenter={{ lat: 22, lng: 0 }}
        defaultZoom={3}
        mapTypeId={mapTypeId}
        gestureHandling={'greedy'}
        disableDefaultUI={true}
        internalUsageAttributionIds={['gmp_git_agentskills_v1']}
      />
    </APIProvider>
  );
};
```
