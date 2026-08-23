import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, StatusBar,
  TouchableOpacity, ActivityIndicator, Animated,
  Linking, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Rect, Circle } from 'react-native-svg';
import { SHADOWS } from '../utils/shadow';
import BackButton from '../components/BackButton';
import { busAPI, getUser } from '../services/apiService';
import { getBusPosition } from '../services/oneLapService';
import { s, ms, fs } from '../utils/responsive';
import { ONELAP_CONFIG, SCHOOL_CONFIG } from '../config/appConfig';
import {
  requestLocationPermission,
  getCurrentLocation,
  distanceBetween,
} from '../services/locationService';
import { requestNotificationPermission } from '../services/notificationService';

const BUS_CLR               = '#EF6C00';
const APPROACHING_THRESHOLD = 500;
const ARRIVED_THRESHOLD     = 150;
const POLL_INTERVAL_MS      = 15_000; // REST polling interval for live bus position

const SCH_LAT  = SCHOOL_CONFIG.latitude;
const SCH_LON  = SCHOOL_CONFIG.longitude;
const SCH_NAME = SCHOOL_CONFIG.name;

const MAP_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link href='https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css' rel='stylesheet'/>
<script src='https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js'><\/script>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body,#map{width:100%;height:100%;overflow:hidden}
  .maplibregl-ctrl-attrib,.maplibregl-ctrl-logo,
  .maplibregl-ctrl-top-right,.maplibregl-ctrl-bottom-left,
  .maplibregl-ctrl-bottom-right{display:none!important}
  /* School marker popup (SCH_NAME) — unstyled, it inherits maplibre-gl.css's
     desktop-browser-sized default (much too large on a phone-scale map). */
  .maplibregl-popup-content{
    font-family:-apple-system,BlinkMacSystemFont,sans-serif;
    font-size:12px;
    font-weight:700;
    color:#1A237E;
    padding:6px 12px;
    border-radius:8px;
    box-shadow:0 2px 6px rgba(0,0,0,0.25);
    white-space:nowrap;
  }
  .maplibregl-popup-tip{ display:none }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var SCH_LAT = ${SCH_LAT}, SCH_LON = ${SCH_LON};
  var BUS_ICON_COLOR = '${BUS_CLR}';

  // Raster tiles (server-rendered PNGs, labels baked into the image) instead
  // of a vector style — the vector "liberty" style depends on the WebView
  // successfully loading + rendering glyphs client-side for every place/road
  // label, which is a known weak point on some Android WebView/GPU
  // combinations. Raster sidesteps that whole pipeline: whatever labels the
  // tile server drew are just pixels, so they can't silently fail to render
  // here even if they fail to render there. MapLibre supports full
  // pitch/bearing/rotation on raster sources same as vector, so none of the
  // nav-mode camera logic below needs to change.
  var map = new maplibregl.Map({
    container: 'map',
    style: {
      version: 8,
      sources: {
        'raster-tiles': {
          type: 'raster',
          // @2x explicitly, not the {r} suffix CartoDB's own docs show for
          // Leaflet — that's a Leaflet-only convention (L.tileLayer expands
          // {r} to '@2x' itself on retina screens). MapLibre GL JS's raster
          // source has no such token, so {r} was reaching CartoDB literally
          // unresolved in the URL; verified their CDN silently ignores it
          // and always returns the base 1x tile either way (confirmed: a
          // literal "{r}.png" request returns 200 with the exact same
          // byte-identical PNG as no suffix at all — never actually 2x).
          // Every Android phone worth testing on is >1x DPI, so the app was
          // always rendering baked-in place/road labels undersized and soft
          // — hardcoding @2x here is what actually serves the sharper tile.
          tiles: [
            'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
            'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
            'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
            'https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png'
          ],
          tileSize: 256,
          maxzoom: 20
        },
        // Esri World Imagery — free, no API key, widely used for satellite
        // basemaps in prototypes/small apps. Swapped in via visibility
        // toggle (toggleMapType) rather than replacing 'raster-tiles', so
        // switching back to streets doesn't need to re-fetch anything.
        'satellite-tiles': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          ],
          tileSize: 256,
          maxzoom: 19
        },
        // Raw satellite photography has no text baked in at all (unlike the
        // street raster above, which has road/place names painted into the
        // image) — without this, switching to satellite drops every label.
        // Esri's matching reference layer is transparent PNG tiles with just
        // place names/roads/boundaries, meant to sit on top of World_Imagery
        // (the same "hybrid" look as Google/Apple Maps satellite mode).
        'satellite-labels': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'
          ],
          tileSize: 256,
          maxzoom: 19
        }
      },
      layers: [
        { id: 'background', type: 'background', paint: { 'background-color': '#f2efe9' } },
        { id: 'raster-tiles', type: 'raster', source: 'raster-tiles' },
        { id: 'satellite-tiles', type: 'raster', source: 'satellite-tiles', layout: {visibility: 'none'} },
        { id: 'satellite-labels', type: 'raster', source: 'satellite-labels', layout: {visibility: 'none'} }
      ]
    },
    center: [SCH_LON, SCH_LAT],
    zoom: 14, pitch: 0, bearing: 0,
    attributionControl: false
  });

  // Camera pitch/bearing are fully driven programmatically (see navMode /
  // glideStep below) — MapLibre's own touch-pitch and touch/drag-rotate
  // gesture handlers aren't needed and, inside a mobile WebView, imprecise
  // touch input can spuriously trigger them (a tap misread as a two-finger
  // tilt/rotate), snapping the camera back to flat pitch/0 bearing right
  // after it tilts into the live-tracking 3D view. Panning (dragPan) stays
  // enabled since that's the deliberate way to disengage auto-follow.
  map.touchPitch.disable();
  map.dragRotate.disable();
  map.touchZoomRotate.disableRotation();

  // ── School marker (added first so the bus marker below always renders
  // on top of it when they overlap — e.g. the bus parked right at the
  // school — instead of the two silently fighting over which is on top) ──
  var schEl = document.createElement('div');
  schEl.innerHTML = '<div style="font-size:26px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4))">🏫</div>';
  var schMarker = new maplibregl.Marker({element:schEl, anchor:'bottom'})
    .setLngLat([SCH_LON, SCH_LAT])
    .setPopup(new maplibregl.Popup({offset:10, closeButton:false}).setText('${SCH_NAME}'))
    .addTo(map);
  // Open by default — OSM has no local street names around the school at
  // this zoom level (rural/industrial area), so the popup is the only place
  // an area name shows up unless the user taps the marker themselves.
  schMarker.togglePopup();

  // ── Bus marker (label + vehicle icon, initially hidden) ────────
  // A custom flat-vector icon (Uber/Ola-style) instead of the 🚌 emoji —
  // emoji glyphs render inconsistently (different art, size, quality)
  // across Android/iOS/font versions. Matches the same recognizable
  // windows/wheels bus silhouette used for the BusIcon component in the
  // info card and action button, just drawn nose-up (top-down view) so it
  // makes sense to rotate toward the direction of travel. Added AFTER the
  // school marker above, and with a higher z-index, so it always renders
  // on top when the two happen to overlap on screen.
  var busEl = document.createElement('div');
  busEl.style.cssText = 'text-align:center;display:inline-block;visibility:hidden;pointer-events:none;z-index:10';
  busEl.innerHTML =
    '<div id="bus-label" style="background:#1565C0;color:#fff;font-size:12px;font-weight:900;'+
    'padding:3px 10px;border-radius:7px;margin-bottom:5px;white-space:nowrap;'+
    'box-shadow:0 2px 6px rgba(0,0,0,0.35);border:2px solid #fff;'+
    'letter-spacing:0.5px;display:block;min-width:52px;text-align:center"></div>'+
    '<div style="position:relative;width:40px;height:48px;margin:0 auto">'+
      '<div style="position:absolute;left:50%;bottom:0;width:24px;height:7px;'+
        'transform:translateX(-50%);border-radius:50%;'+
        'background:radial-gradient(ellipse,rgba(0,0,0,0.4) 0%,rgba(0,0,0,0) 70%)"></div>'+
      '<div id="bus-emoji" style="position:absolute;left:50%;top:0;width:34px;height:42px;'+
        'transform:translateX(-50%) rotate(0deg);transform-origin:50% 65%;'+
        'filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35))">'+
        '<svg width="34" height="42" viewBox="0 0 34 42" xmlns="http://www.w3.org/2000/svg">'+
          '<rect x="4" y="2" width="26" height="36" rx="9" fill="'+BUS_ICON_COLOR+'" stroke="#FFFFFF" stroke-width="2.2"/>'+
          '<rect x="8" y="7" width="18" height="8" rx="2.5" fill="#BBDEFB"/>'+
          '<rect x="7" y="18" width="8" height="6" rx="1.5" fill="#FFE0B2"/>'+
          '<rect x="19" y="18" width="8" height="6" rx="1.5" fill="#FFE0B2"/>'+
          '<rect x="6" y="27" width="22" height="3.5" rx="1.75" fill="#D84315"/>'+
          '<circle cx="11" cy="36" r="3" fill="#212121" stroke="#fff" stroke-width="1"/>'+
          '<circle cx="23" cy="36" r="3" fill="#212121" stroke="#fff" stroke-width="1"/>'+
        '</svg>'+
      '</div>'+
    '</div>';
  var busMarker = new maplibregl.Marker({element:busEl, anchor:'bottom'})
    .setLngLat([SCH_LON, SCH_LAT]).addTo(map);

  // ── State ─────────────────────────────────────────────────────
  var currentLat = SCH_LAT, currentLon = SCH_LON;
  var currentBearing = 0;
  var firstFix = true, navMode = false;
  var stopMarkers = {};
  var mapReady = false, pendingRoute = null, pendingStop = null;
  var NAV_PITCH = 50, NAV_ZOOM = 16;

  // User panning disengages auto-follow; "Bus location" button re-engages it
  map.on('dragstart', function(){ navMode = false; });

  map.on('load', function() {
    mapReady = true;
    map.addSource('route', {
      type: 'geojson',
      data: {type:'Feature',properties:{},geometry:{type:'LineString',coordinates:[]}}
    });
    // White casing behind the blue line
    map.addLayer({
      id:'route-casing', type:'line', source:'route',
      layout:{'line-join':'round','line-cap':'round'},
      paint:{'line-color':'#FFFFFF','line-width':9,'line-opacity':0.5}
    });
    map.addLayer({
      id:'route-line', type:'line', source:'route',
      layout:{'line-join':'round','line-cap':'round'},
      paint:{'line-color':'#1565C0','line-width':5,'line-opacity':0.92}
    });
    if (pendingRoute) { drawRoute(pendingRoute); pendingRoute = null; }
    if (pendingStop)  { highlightMyStop(pendingStop); pendingStop = null; }
  });

  // ── Compass heading between two GPS points ────────────────────
  function computeHeading(lat1, lon1, lat2, lon2) {
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
    var x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180)
          - Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  // ── Bearing low-pass filter ────────────────────────────────────
  // Raw per-segment heading from dense OSRM coordinates is noisy — tiny
  // zig-zags in the road geometry make consecutive headings jump several
  // degrees frame to frame. Real nav apps (Uber/Google Maps) smooth this
  // with an exponential moving average before driving the camera/icon.
  var smoothedBearing = null;
  var BEARING_SMOOTHING = 0.25; // lower = smoother but more lag
  function smoothBearing(rawBearing) {
    if (smoothedBearing == null) { smoothedBearing = rawBearing; return smoothedBearing; }
    var delta = ((rawBearing - smoothedBearing) + 540) % 360 - 180; // shortest arc
    smoothedBearing = (smoothedBearing + delta * BEARING_SMOOTHING + 360) % 360;
    return smoothedBearing;
  }

  // ── Rotate bus icon to face direction of travel ────────────────
  // DOM markers don't rotate with the map, so we rotate the icon
  // manually: offset = (travelBearing - mapBearing) converted from
  // geographic bearing (CW from N) to screen angle. The SVG bus icon is
  // drawn nose-up by default, so no extra offset is needed (unlike the
  // old 🚌 emoji, which faced right).
  var busEmojiEl = null;
  var emojiAngle = 0; // unbounded accumulated angle avoids wrap-around spin
  function rotateBusEmoji(travelBearing) {
    if (!busEmojiEl) busEmojiEl = document.getElementById('bus-emoji');
    if (!busEmojiEl) return;
    // map.getBearing() is read AFTER jumpTo so it reflects the current frame bearing
    var target = (travelBearing - map.getBearing() + 720) % 360;
    // Rotate by shortest arc to avoid spinning through 360°
    var delta = ((target - emojiAngle % 360) + 540) % 360 - 180;
    emojiAngle += delta;
    busEmojiEl.style.transform = 'translateX(-50%) rotate(' + emojiAngle + 'deg)';
  }

  // ── Fetch a road-following path from OSRM ──────────────────────
  // Straight-line interpolation cuts across buildings/blocks, which looks
  // wrong on a map — the bus should only ever appear to move along real
  // roads. A hard timeout falls back to a straight 2-point line quickly
  // instead of leaving the bus frozen if the public OSRM server hangs.
  // osrmController is only aborted from resetMap() (switching buses) —
  // NOT on every new fix, see the note on processNextFix() below for why.
  var osrmController = null;
  // A one-way road system (e.g. a campus loop driveway) can force OSRM's
  // shortest *legal* route between two nearby points to loop all the way
  // around a block, even for a short GPS hop — that reads on the map as the
  // bus icon spinning in a circle instead of taking a small step forward.
  // If the road distance blows past the straight-line distance by more than
  // this multiple, the route isn't useful to animate.
  var OSRM_DETOUR_RATIO_MAX = 4;
  async function getOsrmPath(fromLat, fromLon, toLat, toLon) {
    var ctrl = new AbortController();
    osrmController = ctrl;
    var timer = setTimeout(function(){ ctrl.abort(); }, 4000);
    try {
      var url = 'https://router.project-osrm.org/route/v1/driving/'
                + fromLon+','+fromLat+';'+toLon+','+toLat
                + '?overview=full&geometries=geojson';
      var res  = await fetch(url, {signal: ctrl.signal});
      var data = await res.json();
      clearTimeout(timer);
      if (osrmController === ctrl) osrmController = null;
      if (data.code === 'Ok' && data.routes && data.routes[0]) {
        var dlat = toLat - fromLat, dlon = (toLon - fromLon) * Math.cos(fromLat * Math.PI / 180);
        var straightM = Math.sqrt(dlat*dlat + dlon*dlon) * 111320;
        var roadM = data.routes[0].distance;
        if (roadM <= straightM * OSRM_DETOUR_RATIO_MAX) {
          return data.routes[0].geometry.coordinates.map(function(c){
            return {lat: c[1], lon: c[0]};
          });
        }
        // else: disproportionate detour — fall through to the straight
        // 2-point line below rather than animating the loop.
      }
    } catch(e) {
      clearTimeout(timer);
    }
    return [{lat:fromLat, lon:fromLon}, {lat:toLat, lon:toLon}];
  }

  // ── Called from RN with each GPS fix ───────────────────────────
  // The marker glides along the real road path from wherever it currently
  // sits to the new fix, timed to fill the actual gap between fixes (so
  // it's continuously in motion, never frozen for most of the poll
  // interval), while always landing exactly on the true live position.
  var lastFixTime = null;
  var glideFrame  = null;
  var glidePath   = null;  // array of {lat,lon} road points for the current glide
  var glideDists  = null;  // cumulative distance along glidePath, same length
  var glideStartTime, glideDuration;
  var glideToken  = 0;     // bumped by resetMap() to abandon in-flight work from the old bus
  var osrmBusy    = false; // an OSRM fetch is currently in flight
  var pendingFix  = null;  // {lat, lon, duration} — latest fix waiting for its turn
  var GLIDE_MIN_MS = 3000;   // floor — stays smooth even on fast WS updates
  // Cap — was 34s, matching the old 30s poll interval. Budget GPS trackers
  // often only report a genuinely new fix every 60-180s regardless of how
  // often we poll, so real gaps well over a minute are common. Letting the
  // glide duration stretch to match those long gaps made the bus visibly
  // crawl in slow motion; capping it here trades a bit of pacing accuracy
  // for movement that always looks reasonably brisk when it does happen.
  var GLIDE_MAX_MS = 15000;
  var RESYNC_GAP_MS = 90000; // app backgrounded/resumed — don't crawl to catch up

  function pathDistances(path) {
    var dists = [0];
    for (var i = 1; i < path.length; i++) {
      var dlat = path[i].lat - path[i-1].lat;
      var dlon = (path[i].lon - path[i-1].lon) * Math.cos(path[i-1].lat * Math.PI / 180);
      dists.push(dists[i-1] + Math.sqrt(dlat*dlat + dlon*dlon));
    }
    return dists;
  }

  function glideStep() {
    // Use Date.now(), NOT requestAnimationFrame's own timestamp argument —
    // that one is performance.now()-based (ms since page load) while
    // glideStartTime is Date.now()-based (ms since epoch); mixing the two
    // previously blew up the interpolated position into nonsense
    // coordinates far off the map, making the bus marker vanish.
    var t = Math.min((Date.now() - glideStartTime) / glideDuration, 1);
    var totalDist = glideDists[glideDists.length - 1];

    if (totalDist === 0) {
      currentLat = glidePath[glidePath.length-1].lat;
      currentLon = glidePath[glidePath.length-1].lon;
    } else {
      var target = t * totalDist;
      var seg = glidePath.length - 2;
      for (var i = 1; i < glidePath.length; i++) {
        if (glideDists[i] >= target) { seg = i - 1; break; }
      }
      var segLen  = glideDists[seg+1] - glideDists[seg];
      var segFrac = segLen > 0 ? (target - glideDists[seg]) / segLen : 0;
      currentLat = glidePath[seg].lat + (glidePath[seg+1].lat - glidePath[seg].lat) * segFrac;
      currentLon = glidePath[seg].lon + (glidePath[seg+1].lon - glidePath[seg].lon) * segFrac;

      var rawBearing = computeHeading(
        glidePath[seg].lat, glidePath[seg].lon, glidePath[seg+1].lat, glidePath[seg+1].lon
      );
      currentBearing = smoothBearing(rawBearing);
    }

    busMarker.setLngLat([currentLon, currentLat]);
    rotateBusEmoji(currentBearing);
    if (navMode) map.jumpTo({center:[currentLon, currentLat], bearing:currentBearing, pitch:NAV_PITCH});

    if (t < 1) glideFrame = requestAnimationFrame(glideStep);
    else glideFrame = null;
  }

  function updateBusPos(lat, lon) {
    var now = Date.now();

    if (firstFix) {
      firstFix = false;
      lastFixTime = now;
      currentLat = lat; currentLon = lon;
      busMarker.setLngLat([lon, lat]);
      busEl.style.visibility = 'visible';
      rotateBusEmoji(currentBearing); // give the icon a defined orientation right away
      navMode = true;
      map.easeTo({center:[lon,lat], zoom:NAV_ZOOM, pitch:NAV_PITCH, bearing:0, duration:1000});
      return;
    }

    var dlat = lat - currentLat, dlon = (lon - currentLon) * Math.cos(currentLat * Math.PI / 180);
    var movedMeters = Math.sqrt(dlat*dlat + dlon*dlon) * 111320;
    // Parked/idle (or the GPS hardware just hasn't reported a new fix yet —
    // budget trackers often report far less often than we poll) — skip
    // animation, and deliberately do NOT touch lastFixTime here. If it were
    // updated on every poll attempt regardless of whether the position
    // actually changed, a real gap of e.g. 90s (three 30s polls, only the
    // last one carrying new data) would get measured as just the ~30s since
    // the last poll attempt — understating the true gap and throwing off
    // the glide timing below.
    //
    // Threshold is 8m, not a few meters — budget GPS trackers commonly
    // drift 3-8m even while genuinely stationary (multipath/urban canyon
    // noise). A tighter threshold let that noise register as "the bus
    // moved" on every poll, each time triggering a short glide toward a
    // random nearby point — visible as the icon vibrating/shaking in
    // place, worse now that polling checks in twice as often.
    if (movedMeters < 8) return;

    var prevFixTime = lastFixTime;
    lastFixTime = now;

    var gapMs = prevFixTime ? (now - prevFixTime) : 12000;
    var duration = gapMs > RESYNC_GAP_MS
      ? GLIDE_MIN_MS
      : Math.min(Math.max(gapMs * 0.92, GLIDE_MIN_MS), GLIDE_MAX_MS);

    // Queue this fix rather than racing it against any OSRM fetch already in
    // flight. Aborting-and-restarting on every new fix meant that if fixes
    // ever arrived faster than the public OSRM server could respond, every
    // single fetch kept getting cancelled before finishing and the bus
    // marker would stall completely. Coalescing to "only the latest pending
    // fix matters" guarantees every fetch that starts is allowed to finish.
    pendingFix = { lat: lat, lon: lon, duration: duration };
    processNextFix();
  }

  async function processNextFix() {
    if (osrmBusy || !pendingFix) return;
    var target = pendingFix;
    pendingFix = null;
    osrmBusy = true;
    var myToken = glideToken;

    var path = await getOsrmPath(currentLat, currentLon, target.lat, target.lon);

    osrmBusy = false;
    if (myToken !== glideToken) return; // bus was switched mid-fetch — abandon this result

    // Patch path start to wherever the marker actually is now (it may have
    // kept moving along the previous glide during this async round-trip).
    path[0] = {lat: currentLat, lon: currentLon};

    glidePath  = path;
    glideDists = pathDistances(path);
    glideStartTime = Date.now();
    glideDuration   = target.duration;

    if (glideFrame) cancelAnimationFrame(glideFrame);
    glideFrame = requestAnimationFrame(glideStep);

    processNextFix(); // pick up whichever fix arrived while this fetch was in flight
  }

  function updateBusLabel(number, routeName) {
    var el = document.getElementById('bus-label');
    if (el) el.textContent = number;
  }

  // ── Draw route + stop markers ─────────────────────────────────
  async function drawRoute(stops) {
    if (!mapReady) { pendingRoute = stops; return; }
    if (!stops || !stops.length) return;

    Object.values(stopMarkers).forEach(function(s){ s.marker.remove(); });
    stopMarkers = {};

    stops.forEach(function(stop, i) {
      var first = i===0, last = i===stops.length-1;
      var clr = first?'#43A047':last?'#E53935':'#1565C0';
      var sz  = (first||last)?'16px':'11px';
      var el  = document.createElement('div');
      el.style.cssText = 'width:'+sz+';height:'+sz+';border-radius:50%;background:'+clr+
                         ';border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);cursor:pointer';
      var m = new maplibregl.Marker({element:el, anchor:'center'})
        .setLngLat([parseFloat(stop.longitude), parseFloat(stop.latitude)])
        .setPopup(new maplibregl.Popup({offset:10}).setHTML(
          '<b>'+stop.stop_name+'</b>'+(stop.arrival_time?'<br><small>⏰ '+stop.arrival_time+'</small>':'')
        ))
        .addTo(map);
      stopMarkers[stop.stop_name] = {marker:m, el:el};
    });

    try {
      var coords = stops.map(function(s){return s.longitude+','+s.latitude;}).join(';');
      var res  = await fetch('https://router.project-osrm.org/route/v1/driving/'+coords+'?overview=full&geometries=geojson');
      var data = await res.json();
      if (data.code==='Ok' && data.routes && data.routes[0]) {
        map.getSource('route').setData({type:'Feature',properties:{},geometry:data.routes[0].geometry});
        return;
      }
    } catch(e){}

    map.getSource('route').setData({
      type:'Feature', properties:{},
      geometry:{type:'LineString',
        coordinates:stops.map(function(s){return[parseFloat(s.longitude),parseFloat(s.latitude)];})}
    });
  }

  // ── Highlight user's stop in yellow ───────────────────────────
  function highlightMyStop(stopName) {
    if (!stopName) return;
    if (!mapReady) { pendingStop = stopName; return; }
    var lower = stopName.toLowerCase().trim();
    Object.keys(stopMarkers).forEach(function(name){
      var n = name.toLowerCase().trim();
      if (n===lower||n.indexOf(lower)!==-1||lower.indexOf(n)!==-1) {
        var el = stopMarkers[name].el;
        el.style.background = '#FFD600';
        el.style.border = '3px solid #EF6C00';
        el.style.width = '20px'; el.style.height = '20px';
        stopMarkers[name].marker.getPopup()
          .setHTML('<b>📍 Your Stop</b><br>'+name);
      }
    });
  }

  // ── Reset all state when switching buses ──────────────────────
  function resetMap() {
    if (glideFrame) { cancelAnimationFrame(glideFrame); glideFrame = null; }
    if (osrmController) { osrmController.abort(); osrmController = null; }
    glideToken++; // invalidate any in-flight OSRM fetch from the previous bus
    osrmBusy = false;
    pendingFix = null;
    busEl.style.visibility = 'hidden';
    busMarker.setLngLat([SCH_LON, SCH_LAT]);
    currentLat = SCH_LAT; currentLon = SCH_LON;
    currentBearing = 0; emojiAngle = 0; firstFix = true; navMode = false;
    smoothedBearing = null;
    Object.values(stopMarkers).forEach(function(s){ s.marker.remove(); });
    stopMarkers = {};
    if (mapReady) map.getSource('route').setData(
      {type:'Feature',properties:{},geometry:{type:'LineString',coordinates:[]}}
    );
    var el = document.getElementById('bus-label');
    if (el) el.textContent = '';
    map.easeTo({center:[SCH_LON,SCH_LAT],zoom:13,pitch:0,bearing:0,duration:800});
  }

  // ── Action buttons (called via injectJavaScript) ──────────────
  function centerOnBus() {
    if (!firstFix) {
      navMode = true;
      map.easeTo({center:[currentLon,currentLat],zoom:NAV_ZOOM,pitch:NAV_PITCH,bearing:currentBearing,duration:800});
    }
  }
  function panToCoords(lat, lon) {
    navMode = false;
    map.easeTo({center:[lon,lat],zoom:16,pitch:0,bearing:0,duration:800});
  }

  var satelliteOn = false;
  function toggleMapType() {
    satelliteOn = !satelliteOn;
    map.setLayoutProperty('raster-tiles', 'visibility', satelliteOn ? 'none' : 'visible');
    map.setLayoutProperty('satellite-tiles', 'visibility', satelliteOn ? 'visible' : 'none');
    map.setLayoutProperty('satellite-labels', 'visibility', satelliteOn ? 'visible' : 'none');
  }
<\/script>
</body>
</html>`;

// Stable object reference for the WebView's `source` prop. BusTrackScreen
// re-renders on every GPS fix (setBusPosition/setLiveActive/etc.), and
// `source={{ html: MAP_HTML }}` written inline in JSX would create a brand
// new object every one of those renders — some react-native-webview/RN
// bridge versions treat that as "the content changed" and silently reload
// the WebView, wiping out all the in-page glide/animation state each time.
const MAP_SOURCE = { html: MAP_HTML };

// ── Vector bus icon (replaces the 🚌 emoji, which renders inconsistently
// across Android/iOS/font versions and looked out of place next to the
// map's own vector marker) ──────────────────────────────────────────────
function BusIcon({ size = 34, color = BUS_CLR, style }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" style={style}>
      <Rect x="4" y="7" width="32" height="23" rx="7" fill={color} stroke="#FFFFFF" strokeWidth="1.6" />
      <Rect x="7.5" y="11.5" width="9" height="7.5" rx="1.8" fill="#BBDEFB" />
      <Rect x="18.5" y="11.5" width="9" height="7.5" rx="1.8" fill="#BBDEFB" />
      <Rect x="29.5" y="11.5" width="3.5" height="7.5" rx="1.8" fill="#BBDEFB" />
      <Rect x="4" y="23.5" width="32" height="3.5" fill="#D84315" />
      <Circle cx="11.5" cy="32.5" r="3.6" fill="#212121" stroke="#fff" strokeWidth="1.1" />
      <Circle cx="28.5" cy="32.5" r="3.6" fill="#212121" stroke="#fff" strokeWidth="1.1" />
    </Svg>
  );
}

// Per-user device-local preference — keyed by user id so a shared/school
// device with multiple accounts logging in doesn't leak one student's
// default bus onto another's session.
const defaultBusKey = (userId) => `@jmd_default_bus_${userId}`;

// ── Blinking live dot ─────────────────────────────────────────────────────────
function LiveDot({ active }) {
  const blink = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(blink, { toValue: 0.15, duration: 600, useNativeDriver: true }),
      Animated.timing(blink, { toValue: 1,    duration: 600, useNativeDriver: true }),
    ]));
    active ? a.start() : (a.stop(), blink.setValue(1));
    return () => a.stop();
  }, [active]);
  return (
    <Animated.View style={[
      dot.circle,
      { backgroundColor: active ? '#43A047' : '#9E9E9E', opacity: active ? blink : 1 },
    ]} />
  );
}
const dot = StyleSheet.create({
  circle: { width: ms(9), height: ms(9), borderRadius: ms(5) },
});

// ── "Xs ago" ticker — isolated so its 1s interval doesn't re-render the whole screen ──
function UpdatedAgo({ lastUpdatedAt }) {
  const [secondsAgo, setSecondsAgo] = useState(null);
  useEffect(() => {
    if (!lastUpdatedAt) { setSecondsAgo(null); return; }
    setSecondsAgo(Math.floor((Date.now() - lastUpdatedAt) / 1000));
    const t = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdatedAt) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [lastUpdatedAt]);

  if (secondsAgo == null) return null;
  const isStale = secondsAgo > 90;
  const label = secondsAgo < 60 ? `${secondsAgo}s ago` : `${Math.floor(secondsAgo / 60)}m ago`;
  return (
    <Text style={[styles.updatedTxt, isStale && styles.updatedStale]}>{label}</Text>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function BusTrackScreen({ navigation }) {
  const [busInfo,          setBusInfo]          = useState(null);
  const [busStops,         setBusStops]         = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [refreshing,       setRefreshing]       = useState(false);
  const [busError,         setBusError]         = useState(null);
  const [webLoading,       setWebLoading]       = useState(true);
  const [satelliteView,    setSatelliteView]    = useState(false);

  const [liveActive,       setLiveActive]       = useState(false);
  const [busPosition,      setBusPosition]      = useState(null);
  const [userLocation,     setUserLocation]     = useState(null);
  const [busStatus,        setBusStatus]        = useState('idle');

  const [lastUpdatedAt,    setLastUpdatedAt]    = useState(null);
  const [userBusStop,      setUserBusStop]      = useState(null);
  const [pickupStop,       setPickupStop]       = useState(null);

  // Bus switcher state
  const [allBuses,         setAllBuses]         = useState([]);
  const [assignedDeviceId, setAssignedDeviceId] = useState(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [showBusPicker,    setShowBusPicker]    = useState(false);
  const [defaultDeviceId,  setDefaultDeviceId]  = useState(null);
  const [userId,           setUserId]           = useState(null);

  const webviewRef    = useRef(null);
  const userLocRef    = useRef(null);
  const notifAppr     = useRef(false);
  const notifArr      = useRef(false);
  const webLoadingRef = useRef(true);
  const lastPosRef    = useRef(null);
  const lastMoveAtRef = useRef(0);

  useEffect(() => { userLocRef.current    = userLocation; }, [userLocation]);
  useEffect(() => { webLoadingRef.current = webLoading;   }, [webLoading]);

  // ── Load info + stops for a specific deviceId ─────────────────────────────
  const loadBusData = useCallback(async (deviceId) => {
    setBusError(null);
    try {
      const [info, stops] = await Promise.all([
        busAPI.getInfo(deviceId),
        busAPI.getStops(deviceId),
      ]);
      setBusInfo(info);
      setBusStops(stops || []);
    } catch (err) {
      setBusError(err.message || 'Failed to load bus data');
    }
  }, []);

  // ── Initial setup — runs once ─────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);

      const u = await getUser();
      setUserId(u?.id ?? null);

      // Bus list (for the picker), assigned bus, and this student's saved
      // default are all independent — fetch in parallel.
      const [busesResult, assignedResult, serverDefault, cachedDefault] = await Promise.allSettled([
        busAPI.getBusList(),
        busAPI.getAssigned(),
        busAPI.getDefaultBus(),
        u?.id ? AsyncStorage.getItem(defaultBusKey(u.id)) : Promise.resolve(null),
      ]);

      if (busesResult.status === 'fulfilled' && Array.isArray(busesResult.value)) {
        setAllBuses(busesResult.value);
      }

      let deviceId = ONELAP_CONFIG.DEFAULT_DEVICE_ID;
      if (assignedResult.status === 'fulfilled') {
        const assigned = assignedResult.value;
        if (assigned?.onelap_device_id) {
          deviceId = assigned.onelap_device_id;
          setAssignedDeviceId(assigned.onelap_device_id);
        }
        if (assigned?.pickup_lat && assigned?.pickup_lng) {
          setPickupStop({
            name: assigned.pickup_stop_name ?? 'Your Stop',
            lat:  assigned.pickup_lat,
            lng:  assigned.pickup_lng,
          });
        }
      }

      // A student's own saved choice always wins over the DB assignment/global
      // fallback — that's the whole point of letting them set one. The server
      // copy is the source of truth (also used server-side, e.g. in the
      // attendance notification's bus number); the AsyncStorage copy only
      // matters as a same-device fallback when the server call fails
      // (offline, cold start racing the network, etc).
      const serverDeviceId = serverDefault.status === 'fulfilled' && serverDefault.value?.onelap_device_id;
      if (serverDeviceId) {
        deviceId = serverDeviceId;
        if (u?.id) AsyncStorage.setItem(defaultBusKey(u.id), String(serverDeviceId)).catch(() => {});
      } else if (cachedDefault.status === 'fulfilled' && cachedDefault.value) {
        // AsyncStorage only stores strings; onelap_device_id is a number
        // everywhere else in this screen, so it has to be converted back.
        deviceId = Number(cachedDefault.value);
      }
      setDefaultDeviceId(deviceId);

      setSelectedDeviceId(deviceId);
      await loadBusData(deviceId);
      setLoading(false);
    })();
  }, [loadBusData]);

  // ── Manual refresh ────────────────────────────────────────────────────────
  const onRefresh = useCallback(async () => {
    if (!selectedDeviceId) return;
    setRefreshing(true);
    await loadBusData(selectedDeviceId);
    setRefreshing(false);
  }, [selectedDeviceId, loadBusData]);

  // ── Switch to a different bus ─────────────────────────────────────────────
  const handleBusChange = useCallback(async (deviceId) => {
    setShowBusPicker(false);
    if (deviceId === selectedDeviceId) return;

    // Reset tracking state
    setBusPosition(null);
    setLiveActive(false);
    setLastUpdatedAt(null);
    setBusStatus('idle');
    notifAppr.current = false;
    notifArr.current  = false;
    lastPosRef.current = null;
    lastMoveAtRef.current = 0;

    // Reset map
    webviewRef.current?.injectJavaScript(`resetMap(); true;`);

    // Load new bus
    setSelectedDeviceId(deviceId);
    setRefreshing(true);
    await loadBusData(deviceId);
    setRefreshing(false);

    // Remember this choice — next time the screen opens (on this device or
    // any other), it loads straight into this bus instead of resetting to
    // the assigned/global default. Saved server-side so it's also what the
    // attendance notification's bus number falls back to when there's no
    // official assignment; AsyncStorage stays as a same-device offline cache.
    setDefaultDeviceId(deviceId);
    busAPI.setDefaultBus(deviceId);
    if (userId) {
      AsyncStorage.setItem(defaultBusKey(userId), String(deviceId)).catch(() => {});
    }
  }, [selectedDeviceId, loadBusData, userId]);

  // ── Load user's assigned bus stop for map highlight ───────────────────────
  useEffect(() => {
    getUser().then(u => { if (u?.bus_stop) setUserBusStop(u.bus_stop); });
  }, []);

  // ── Permissions + location ────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      // Still needed even though this screen no longer fires local proximity
      // notifications itself — bus alerts now come from the backend as real
      // Expo pushes (see busProximityNotifier.js), and those still need OS
      // notification permission granted to display.
      await requestNotificationPermission();
      const locOk = await requestLocationPermission();
      if (locOk) {
        const loc = await getCurrentLocation();
        if (loc) setUserLocation(loc);
      }
    })();
  }, []);

  // ── Proximity status label ────────────────────────────────────────────────
  // Actual bus-approaching/bus-arrived notifications are now sent server-side
  // (busProximityNotifier.js) so they still fire with the app closed. This
  // stays purely as an immediate, free in-app status label while the screen
  // is open — notifAppr/notifArr just dedupe repeated setBusStatus calls.
  const checkProximity = useCallback((distM) => {
    if (distM <= ARRIVED_THRESHOLD && !notifArr.current) {
      notifArr.current = notifAppr.current = true;
      setBusStatus('arrived');
    } else if (distM <= APPROACHING_THRESHOLD && !notifAppr.current) {
      notifAppr.current = true;
      setBusStatus('approaching');
    } else if (distM > APPROACHING_THRESHOLD) {
      notifAppr.current = false;
      notifArr.current  = false;
      setBusStatus('idle');
    }
  }, []);

  // ── Live position polling ─────────────────────────────────────────────────
  // REST-only via the backend proxy (no direct OneLap connection from the
  // client — that would require shipping OneLap admin credentials in the app
  // bundle, which is never safe to do).
  useEffect(() => {
    if (!busInfo) return;
    let cleaned = false, timer = null;
    const deviceId = busInfo.onelap_device_id ?? ONELAP_CONFIG.DEFAULT_DEVICE_ID;

    const handlePos = (pos) => {
      if (cleaned || !pos || pos.latitude == null) return;
      // Track confirmed GPS displacement separately from the raw speed field —
      // budget trackers can report nonzero/noisy speed while genuinely
      // stationary (multipath/urban canyon noise), which would otherwise show
      // "Bus is Moving" even though the marker (correctly) isn't animating,
      // since the WebView applies its own 8m anti-jitter threshold.
      const prevPos = lastPosRef.current;
      const movedMeters = prevPos
        ? distanceBetween(prevPos.latitude, prevPos.longitude, pos.latitude, pos.longitude)
        : Infinity;
      if (movedMeters >= 8) lastMoveAtRef.current = Date.now();
      setBusPosition(pos);
      setLiveActive(true);
      setLastUpdatedAt(Date.now());
      lastPosRef.current = pos;
      // If the WebView hasn't finished loading MAP_HTML yet, updateBusPos()
      // doesn't exist in its JS context — injecting it here would silently
      // no-op and this fix would be lost forever (unlike updateBusLabel/
      // drawRoute/highlightMyStop below, which all correctly wait). The
      // "WebView finished loading" effect further down replays whatever
      // lastPosRef holds once it's actually safe to inject.
      if (!webLoadingRef.current) {
        webviewRef.current?.injectJavaScript(
          `updateBusPos(${pos.latitude}, ${pos.longitude}); true;`
        );
      }
      const loc = userLocRef.current;
      if (loc) {
        const d = distanceBetween(loc.latitude, loc.longitude, pos.latitude, pos.longitude);
        checkProximity(d);
      }
    };

    const poll = async () => { if (!cleaned) handlePos(await getBusPosition(deviceId)); };
    poll();
    timer = setInterval(poll, POLL_INTERVAL_MS);

    return () => { cleaned = true; clearInterval(timer); };
  }, [busInfo, checkProximity]);

  // ── Replay the last known position once the WebView is actually ready ────
  // Covers the fix that would otherwise be silently dropped by handlePos
  // above if it arrived while webLoading was still true.
  useEffect(() => {
    if (webLoading || !lastPosRef.current) return;
    const pos = lastPosRef.current;
    webviewRef.current?.injectJavaScript(
      `updateBusPos(${pos.latitude}, ${pos.longitude}); true;`
    );
  }, [webLoading]);

  // ── Inject bus label when WebView + busInfo ready ─────────────────────────
  useEffect(() => {
    if (!busInfo || webLoading) return;
    const number = busInfo.bus_number ?? '';
    const route  = busInfo.route_name ?? '';
    webviewRef.current?.injectJavaScript(
      `updateBusLabel(${JSON.stringify(number)}, ${JSON.stringify(route)}); true;`
    );
  }, [busInfo, webLoading]);

  // ── Inject route stops when WebView + stops ready ─────────────────────────
  useEffect(() => {
    if (!busStops.length || webLoading) return;
    webviewRef.current?.injectJavaScript(
      `drawRoute(${JSON.stringify(busStops)}); true;`
    );
  }, [busStops, webLoading]);

  // ── Highlight user's stop only when viewing their assigned bus ────────────
  useEffect(() => {
    if (!userBusStop || !busStops.length || webLoading) return;
    if (selectedDeviceId !== assignedDeviceId) return;
    webviewRef.current?.injectJavaScript(
      `highlightMyStop(${JSON.stringify(userBusStop)}); true;`
    );
  }, [userBusStop, busStops, webLoading, selectedDeviceId, assignedDeviceId]);

  // ── Map action button handlers ────────────────────────────────────────────
  const handleBusLocation = useCallback(() => {
    webviewRef.current?.injectJavaScript(`centerOnBus(); true;`);
  }, []);

  const handleMyLocation = useCallback(() => {
    if (!userLocation) return;
    webviewRef.current?.injectJavaScript(
      `panToCoords(${userLocation.latitude}, ${userLocation.longitude}); true;`
    );
  }, [userLocation]);

  const handleDropPoint = useCallback(() => {
    if (!pickupStop) return;
    webviewRef.current?.injectJavaScript(
      `panToCoords(${pickupStop.lat}, ${pickupStop.lng}); true;`
    );
  }, [pickupStop]);

  const handleToggleMapType = useCallback(() => {
    setSatelliteView(v => !v);
    webviewRef.current?.injectJavaScript(`toggleMapType(); true;`);
  }, []);

  // ── Derived display values ────────────────────────────────────────────────
  const speed    = busPosition?.speed ?? 0;
  // Require both a plausible speed reading AND a confirmed GPS displacement
  // within the last couple of polls — speed alone can be noisy/phantom on
  // budget trackers while the marker itself hasn't actually moved.
  const isMoving = speed > 2 && (Date.now() - lastMoveAtRef.current) < POLL_INTERVAL_MS * 2;
  const isOtherBus = assignedDeviceId && selectedDeviceId !== assignedDeviceId;

  const statusLabel = {
    arrived:     { text: 'Bus Arrived at Your Stop', color: '#C62828' },
    approaching: { text: 'Bus is Approaching!',      color: '#E65100' },
    idle: {
      text:  liveActive
        ? isMoving ? 'Bus is Moving' : 'Bus Stopped'
        : 'Tracking Inactive',
      color: liveActive ? (isMoving ? '#2E7D32' : '#5D4037') : '#757575',
    },
  }[busStatus];

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={BUS_CLR} />
        <LinearGradient colors={[BUS_CLR, '#E65100']} style={styles.header}>
          <BackButton onPress={() => navigation.goBack()} />
          <Text style={styles.headerTitle}>Bus Track</Text>
          <View style={{ width: s(44) }} />
        </LinearGradient>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BUS_CLR} />
          <Text style={styles.centerTxt}>Loading bus details…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={BUS_CLR} />

      {/* Header */}
      <LinearGradient colors={[BUS_CLR, '#E65100']} style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Bus Track</Text>
        <TouchableOpacity style={[styles.navBtn, styles.refreshBtn]} onPress={onRefresh} activeOpacity={0.7}>
          {refreshing
            ? <ActivityIndicator size="small" color="#FFF" />
            : <Text style={styles.navIcon}>↻</Text>}
        </TouchableOpacity>
      </LinearGradient>

      <View style={styles.body}>

        {/* Bus Info Card */}
        <View style={styles.card}>
          <View style={styles.busRow}>
            <BusIcon size={ms(34)} style={{ marginTop: ms(2) }} />
            <View style={{ flex: 1 }}>
              {/* Bus number + badge + change button in one row */}
              <View style={styles.busTopRow}>
                <View style={styles.busNumberCol}>
                  <Text style={styles.busNumberLabel}>BUS NUMBER</Text>
                  <View style={styles.busNumberRow}>
                    <Text style={styles.busNumber} numberOfLines={1}>{busInfo?.bus_number ?? '—'}</Text>
                    {isOtherBus && (
                      <View style={styles.otherBusBadge}><Text style={styles.otherBusBadgeTxt}>Other</Text></View>
                    )}
                  </View>
                </View>
                <TouchableOpacity onPress={() => setShowBusPicker(true)} activeOpacity={0.7} style={styles.changeBusBtn}>
                  <Text style={styles.changeBusTxt}>Change</Text>
                </TouchableOpacity>
              </View>
              {busInfo?.route_name ? (
                <Text style={styles.busRoute} numberOfLines={1}>{busInfo.route_name}</Text>
              ) : null}
              {(busInfo?.driver_name || busInfo?.driver_phone) ? (
                <View style={styles.driverRow}>
                  {busInfo?.driver_name ? (
                    <Text style={styles.busDriver}>{busInfo.driver_name}</Text>
                  ) : null}
                  {busInfo?.driver_phone ? (
                    <TouchableOpacity onPress={() => Linking.openURL(`tel:${busInfo.driver_phone}`)}>
                      <Text style={styles.busPhone}>📞 {busInfo.driver_phone}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.statusRow}>
            <LiveDot active={liveActive} />
            <Text style={[styles.statusTxt, { color: statusLabel.color }]}>
              {statusLabel.text.toUpperCase()}
            </Text>
            <UpdatedAgo lastUpdatedAt={lastUpdatedAt} />
          </View>
        </View>

        {/* Route Map Card */}
        <View style={styles.mapCard}>

          <View style={styles.mapHeader}>
            <Text style={styles.mapTitle}>🗺️  Route Map</Text>
            <View style={styles.liveBadge}>
              <View style={[styles.liveDot, { backgroundColor: liveActive ? '#43A047' : '#9E9E9E' }]} />
              <Text style={[styles.liveBadgeTxt, { color: liveActive ? '#2E7D32' : '#9E9E9E' }]}>
                {liveActive ? 'LIVE' : 'OFFLINE'}
              </Text>
            </View>
          </View>

          <View style={styles.mapBody}>
            <WebView
              ref={webviewRef}
              source={MAP_SOURCE}
              style={StyleSheet.absoluteFill}
              javaScriptEnabled
              domStorageEnabled
              originWhitelist={['*']}
              onLoadStart={() => setWebLoading(true)}
              onLoadEnd={() => setWebLoading(false)}
              onShouldStartLoadWithRequest={(req) =>
                req.url.startsWith('about:') ||
                req.url.startsWith('file://') ||
                req.url.startsWith('https://')
              }
            />
            {webLoading && (
              <View style={styles.webLoader}>
                <ActivityIndicator size="large" color={BUS_CLR} />
                <Text style={styles.webLoaderTxt}>Loading map…</Text>
              </View>
            )}
            {!webLoading && (
              <TouchableOpacity
                style={styles.mapTypeBtn}
                onPress={handleToggleMapType}
                activeOpacity={0.75}
              >
                <Text style={styles.mapTypeIcon}>{satelliteView ? '🗺️' : '🛰️'}</Text>
                <Text style={styles.mapTypeTxt}>{satelliteView ? 'Map' : 'Satellite'}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Three action buttons */}
          <View style={styles.mapActions}>
            <TouchableOpacity
              style={[styles.mapActionBtn, !liveActive && styles.mapActionBtnDisabled]}
              onPress={handleBusLocation}
              activeOpacity={0.75}
            >
              <BusIcon size={ms(15)} color={!liveActive ? '#BDBDBD' : BUS_CLR} />
              <Text style={[styles.mapActionTxt, !liveActive && styles.mapActionTxtDisabled]}>
                Bus location
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.mapActionBtn, !userLocation && styles.mapActionBtnDisabled]}
              onPress={handleMyLocation}
              activeOpacity={0.75}
            >
              <Text style={styles.mapActionIcon}>📍</Text>
              <Text style={[styles.mapActionTxt, !userLocation && styles.mapActionTxtDisabled]}>
                My location
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.mapActionBtn, !pickupStop && styles.mapActionBtnDisabled]}
              onPress={handleDropPoint}
              activeOpacity={0.75}
            >
              <Text style={styles.mapActionIcon}>🏁</Text>
              <Text style={[styles.mapActionTxt, !pickupStop && styles.mapActionTxtDisabled]}>
                Dropping point
              </Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>

      {/* ── Bus Picker Modal ─────────────────────────────────────────────────── */}
      <Modal
        visible={showBusPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBusPicker(false)}
      >
        <View style={styles.pickerOverlay}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setShowBusPicker(false)}
          />
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHandle} />
            <View style={styles.pickerHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pickerTitle}>Select Bus to Track</Text>
                <Text style={styles.pickerSubtitle}>Your pick is remembered as your default</Text>
              </View>
              <TouchableOpacity onPress={() => setShowBusPicker(false)} hitSlop={s(10)}>
                <Text style={styles.pickerClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={allBuses}
              keyExtractor={b => String(b.onelap_device_id)}
              renderItem={({ item }) => {
                const isActive  = item.onelap_device_id === selectedDeviceId;
                const isDefault = item.onelap_device_id === defaultDeviceId;
                return (
                  <TouchableOpacity
                    style={[styles.pickerItem, isActive && styles.pickerItemActive]}
                    onPress={() => handleBusChange(item.onelap_device_id)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={styles.pickerBusRow}>
                        <Text style={[styles.pickerBusNum, isActive && styles.pickerBusNumActive]}>
                          {item.bus_number}
                        </Text>
                        {isDefault && (
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultBadgeTxt}>★ Default</Text>
                          </View>
                        )}
                      </View>
                      {item.route_name ? (
                        <Text style={styles.pickerRoute} numberOfLines={1}>{item.route_name}</Text>
                      ) : null}
                    </View>
                    {isActive && <Text style={styles.pickerCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#F0F0F0' }} />}
              ListEmptyComponent={
                <View style={styles.pickerEmpty}>
                  <Text style={styles.pickerEmptyTxt}>No buses found</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F5F5' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ms(16),
    paddingVertical: ms(14),
  },
  navBtn:      { width: s(44), height: s(44), alignItems: 'center', justifyContent: 'center' },
  refreshBtn: {
    borderRadius: s(22),
  },
  navIcon:     { fontSize: fs(26), color: '#FFFFFF', fontWeight: '600' },
  headerTitle: { fontSize: fs(22), fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },

  // Body
  body: { flex: 1, padding: ms(12), gap: ms(10) },

  // Bus info card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: ms(14),
    padding: ms(12),
    ...SHADOWS.md,
  },

  busRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: ms(10),
    marginBottom: ms(10),
  },

  // Bus number row: number + badge + change button
  busTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: ms(2),
  },
  busNumberCol:   { flexShrink: 1 },
  busNumberLabel: { fontSize: fs(10), fontWeight: '700', color: '#9E9E9E', letterSpacing: 0.6, marginBottom: ms(2) },
  busNumberRow:   { flexDirection: 'row', alignItems: 'center', gap: ms(6), flexWrap: 'wrap' },
  busNumber:      { fontSize: fs(20), fontWeight: '800', color: '#1A237E' },

  otherBusBadge: {
    backgroundColor: '#FFF3E0',
    borderRadius: ms(5),
    paddingHorizontal: ms(6),
    paddingVertical: ms(2),
  },
  otherBusBadgeTxt: { fontSize: fs(10), fontWeight: '700', color: '#E65100' },
  changeBusBtn: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    borderRadius: ms(14),
    borderWidth: 1,
    borderColor: '#FFD8A8',
    paddingHorizontal: ms(10),
    paddingVertical: ms(5),
  },
  changeBusTxt:   { fontSize: fs(11), fontWeight: '700', color: BUS_CLR },

  busRoute:  { fontSize: fs(12), fontWeight: '600', color: BUS_CLR, marginBottom: ms(2) },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: ms(10), flexWrap: 'wrap' },
  busDriver: { fontSize: fs(12), color: '#424242' },
  busPhone:  { fontSize: fs(12), fontWeight: '700', color: BUS_CLR },

  // Status row
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(7),
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: ms(8),
  },
  statusTxt:    { fontSize: fs(11), fontWeight: '800', letterSpacing: 1, flex: 1 },
  updatedTxt:   { fontSize: fs(10), color: '#9E9E9E', fontWeight: '500' },
  updatedStale: { color: '#E53935' },

  // Map card
  mapCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: ms(16),
    overflow: 'hidden',
    ...SHADOWS.md,
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ms(16),
    paddingVertical: ms(13),
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  mapTitle:    { fontSize: fs(15), fontWeight: '800', color: '#1A237E' },
  liveBadge:   { flexDirection: 'row', alignItems: 'center', gap: ms(5) },
  liveDot:     { width: ms(7), height: ms(7), borderRadius: ms(4) },
  liveBadgeTxt:{ fontSize: fs(11), fontWeight: '800', letterSpacing: 0.8 },

  mapBody: { flex: 1, position: 'relative', backgroundColor: '#F5F5F5' },

  // WebView loading overlay
  webLoader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    gap: ms(12),
  },
  webLoaderTxt: { fontSize: fs(13), color: '#9E9E9E' },

  // Satellite/street toggle — floats over the top-right corner of the map
  mapTypeBtn: {
    position: 'absolute',
    top: ms(10),
    right: ms(10),
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(5),
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: ms(10),
    paddingHorizontal: ms(10),
    paddingVertical: ms(7),
    ...SHADOWS.md,
  },
  mapTypeIcon: { fontSize: ms(14) },
  mapTypeTxt:  { fontSize: fs(11), fontWeight: '700', color: '#1A237E' },

  // Three map action buttons
  mapActions: {
    flexDirection: 'row',
    gap: ms(8),
    paddingHorizontal: ms(12),
    paddingVertical: ms(10),
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    backgroundColor: '#FFFFFF',
  },
  mapActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: ms(5),
    paddingVertical: ms(10),
    backgroundColor: '#F5F7FF',
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: '#DDE3FF',
  },
  mapActionBtnDisabled: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E8E8E8',
  },
  mapActionIcon: { fontSize: ms(15) },
  mapActionTxt: {
    fontSize: fs(11),
    fontWeight: '700',
    color: '#1A237E',
  },
  mapActionTxtDisabled: { color: '#BDBDBD' },

  // Bus picker modal
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: ms(20),
    borderTopRightRadius: ms(20),
    maxHeight: '75%',
    paddingBottom: ms(24),
  },
  pickerHandle: {
    width: ms(40),
    height: ms(4),
    backgroundColor: '#E0E0E0',
    borderRadius: ms(2),
    alignSelf: 'center',
    marginTop: ms(10),
    marginBottom: ms(4),
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ms(20),
    paddingVertical: ms(14),
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  pickerTitle: { fontSize: fs(16), fontWeight: '800', color: '#1A237E' },
  pickerSubtitle: { fontSize: fs(11), color: '#9E9E9E', marginTop: ms(2) },
  pickerClose: { fontSize: fs(18), color: '#9E9E9E', fontWeight: '600' },

  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ms(20),
    paddingVertical: ms(14),
  },
  pickerItemActive: { backgroundColor: '#FFF8F0' },

  pickerBusRow: { flexDirection: 'row', alignItems: 'center', gap: ms(8), marginBottom: ms(2) },
  pickerBusNum: { fontSize: fs(15), fontWeight: '800', color: '#1A237E' },
  pickerBusNumActive: { color: BUS_CLR },
  pickerRoute:  { fontSize: fs(12), color: '#757575', fontWeight: '500' },

  defaultBadge: {
    backgroundColor: '#FFF3E0',
    borderRadius: ms(5),
    paddingHorizontal: ms(6),
    paddingVertical: ms(2),
  },
  defaultBadgeTxt: { fontSize: fs(10), fontWeight: '700', color: BUS_CLR },

  pickerCheck: { fontSize: fs(18), color: BUS_CLR, fontWeight: '800', marginLeft: ms(8) },

  pickerEmpty: { padding: ms(32), alignItems: 'center' },
  pickerEmptyTxt: { fontSize: fs(14), color: '#9E9E9E' },

  // Loading / error shared
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', gap: ms(12) },
  centerTxt: { fontSize: fs(14), color: '#9E9E9E' },
});
