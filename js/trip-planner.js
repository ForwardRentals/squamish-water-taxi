/* ==========================================================================
   Squamish Water Taxi - Trip Planner / Fare Estimator
   Real satellite map (Leaflet + Esri World Imagery, no API key needed) with
   a draggable boat marker and a route line that follows a hand-placed
   "channel spine" tracing the real navigable water down Howe Sound, so it
   curves the way an actual boat route would instead of cutting straight
   across headlands.

   IMPORTANT (Jeremy): the pricing constants below are placeholder numbers,
   not a published rate. Tune BASE_FEE / RATE_PER_NM / EXTRA_PAX_FEE /
   MIN_FARE / ROUND_TRIP_MULTIPLIER to match your real per-trip pricing
   whenever you have it. Everything on the page is labeled "rough estimate,
   not a quote" on purpose so it never contradicts a real quote you give
   over the phone.
   ========================================================================== */

(function () {
  "use strict";

  if (typeof L === "undefined") return; // Leaflet failed to load

  /* ---- Channel spine: real, plausible mid-channel waypoints tracing the
     navigable water from Squamish down to Vancouver, passing east of Anvil
     Island (~49.53, -123.309) and rounding Point Atkinson (~49.34, -123.25)
     into English Bay - so routes drawn between any two stops curve along
     the water instead of running in a straight line. ---- */
  var SPINE = [
    { id: "squamish", lat: 49.7016, lon: -123.1558 },
    { lat: 49.6698, lon: -123.226 },
    { id: "britannia", lat: 49.6167, lon: -123.2064 },
    { lat: 49.5983, lon: -123.2316 },
    { id: "porteau", lat: 49.5666, lon: -123.2422 },
    { lat: 49.5243, lon: -123.2651 },
    { lat: 49.4926, lon: -123.2727 },
    { id: "lionsbay", lat: 49.4583, lon: -123.2364 },
    { lat: 49.4078, lon: -123.2576 },
    { id: "horseshoe", lat: 49.3757, lon: -123.2719 },
    { lat: 49.3305, lon: -123.283 },
    { lat: 49.3155, lon: -123.2082 },
    { lat: 49.2881, lon: -123.1734 },
    { id: "vancouver", lat: 49.2934, lon: -123.1206 }
  ];

  var spineIndexById = {};
  SPINE.forEach(function (p, i) {
    if (p.id) spineIndexById[p.id] = i;
  });

  /* ---- Locations: the six main-channel stops plus spur destinations.
     A spur location gives spineJunction (the SPINE index its side-trip
     branches off from) and spur (verified [lat,lon] waypoints running
     from that junction out to the destination, junction not repeated). */
  var LOCATIONS = [
    { id: "squamish", name: "Squamish", lat: 49.7016, lon: -123.1558 },
    { id: "britannia", name: "Britannia Beach", lat: 49.6167, lon: -123.2064 },
    { id: "porteau", name: "Porteau Cove", lat: 49.5666, lon: -123.2422 },
    { id: "lionsbay", name: "Lions Bay", lat: 49.4583, lon: -123.2364 },
    { id: "horseshoe", name: "Horseshoe Bay", lat: 49.3757, lon: -123.2719 },
    { id: "vancouver", name: "Vancouver", lat: 49.2934, lon: -123.1206 },
    {
      id: "mcnab",
      name: "McNab Creek",
      lat: 49.5656,
      lon: -123.3993,
      spineJunction: 4, // Porteau Cove
      spur: [[49.5828, -123.2762], [49.5682, -123.3699]]
    },
    {
      id: "anvil",
      name: "Anvil Island",
      lat: 49.5146,
      lon: -123.3014,
      spineJunction: 5,
      spur: [[49.5289, -123.3235], [49.5174, -123.3206]],
      highlight: "Hike Leading Peak"
    },
    {
      id: "ekins",
      name: "Ekins Point",
      lat: 49.5369,
      lon: -123.3782,
      spineJunction: 5,
      spur: [[49.5289, -123.3235]]
    },
    {
      id: "artaban",
      name: "Camp Artaban",
      lat: 49.4757,
      lon: -123.354,
      spineJunction: 6,
      spur: [[49.4928, -123.3086], [49.4796, -123.3394]]
    },
    {
      id: "echolake",
      name: "Echo Lake Trailhead",
      lat: 49.7194,
      lon: -123.1883,
      spineJunction: 0, // Squamish - route follows the Squamish River upstream
      spur: [[49.7042, -123.1645], [49.7094, -123.1711], [49.7139, -123.1772]],
      highlight: "Hike up to Echo Lake"
    },
    {
      id: "smittys",
      name: "Smitty's, Gibsons",
      lat: 49.3987,
      lon: -123.5025,
      spineJunction: 6, // same southern Gambier channel junction as Camp Artaban
      spur: [[49.4353, -123.4451], [49.406, -123.5048]],
      highlight: "Lunch at Smitty's Oyster House"
    }
  ];

  /* ---- Fare estimate constants (placeholders - see note above) ---- */
  var BASE_FEE = 120;
  var RATE_PER_NM = 9;
  var EXTRA_PAX_FEE = 25;
  var INCLUDED_PAX = 3;
  var MAX_PAX = 6;
  var MIN_FARE = 95;
  var ROUND_TRIP_MULTIPLIER = 1.85;
  var CRUISE_SPEED_KNOTS = 18;
  var BOAT_ANIM_MS = 900;
  var SNAP_THRESHOLD_PX = 50;

  var prefersReducedMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function haversineNm(lat1, lon1, lat2, lon2) {
    var R_NM = 3440.065;
    var toRad = function (d) { return (d * Math.PI) / 180; };
    var dLat = toRad(lat2 - lat1);
    var dLon = toRad(lon2 - lon1);
    var a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R_NM * c;
  }

  function pathDistanceNm(waypoints) {
    var total = 0;
    for (var i = 1; i < waypoints.length; i++) {
      total += haversineNm(waypoints[i - 1][0], waypoints[i - 1][1], waypoints[i][0], waypoints[i][1]);
    }
    return total;
  }

  function byId(id) {
    for (var i = 0; i < LOCATIONS.length; i++) {
      if (LOCATIONS[i].id === id) return LOCATIONS[i];
    }
    return null;
  }

  /* Ordered [lat,lon] chain from this location's SPINE junction out to the
     location itself. Main-channel stops (no spur/spineJunction) just
     resolve to their own spine point. */
  function locationChain(loc) {
    if (loc.spineJunction === undefined) {
      var idx = spineIndexById[loc.id];
      return [[SPINE[idx].lat, SPINE[idx].lon]];
    }
    var chain = [[SPINE[loc.spineJunction].lat, SPINE[loc.spineJunction].lon]];
    loc.spur.forEach(function (p) { chain.push(p); });
    chain.push([loc.lat, loc.lon]);
    return chain;
  }

  function junctionIndex(loc) {
    return loc.spineJunction === undefined ? spineIndexById[loc.id] : loc.spineJunction;
  }

  /* Hand-verified direct water links between nearby spur destinations that
     don't need a detour back out to the main channel spine to reach each
     other (e.g. McNab Creek and Ekins Point sit either side of the same
     open bay). Keyed "idA|idB", waypoints ordered idA -> idB. */
  var DIRECT_CONNECTORS = {
    "mcnab|ekins": [[49.5514, -123.3912]]
  };

  function directConnector(fromId, toId) {
    var forward = DIRECT_CONNECTORS[fromId + "|" + toId];
    if (forward) return forward.slice();
    var backward = DIRECT_CONNECTORS[toId + "|" + fromId];
    if (backward) return backward.slice().reverse();
    return null;
  }

  function routeWaypoints(fromId, toId) {
    var connector = directConnector(fromId, toId);
    if (connector) {
      var fromLoc = byId(fromId);
      var toLoc = byId(toId);
      return [[fromLoc.lat, fromLoc.lon]].concat(connector, [[toLoc.lat, toLoc.lon]]);
    }

    var from = byId(fromId);
    var to = byId(toId);
    var i1 = junctionIndex(from);
    var i2 = junctionIndex(to);
    var lo = Math.min(i1, i2);
    var hi = Math.max(i1, i2);
    var mainSeg = SPINE.slice(lo, hi + 1).map(function (p) { return [p.lat, p.lon]; });
    if (i1 > i2) mainSeg.reverse();

    var fromChain = locationChain(from); // junction -> from
    var toChain = locationChain(to); // junction -> to

    var fromSpur = fromChain.slice(1).reverse(); // from -> ...  (excludes its own junction point)
    var toSpur = toChain.slice(1); // ... -> to (excludes its own junction point)

    return fromSpur.concat(mainSeg, toSpur);
  }

  /* ---- State ---- */
  var state = {
    fromId: "squamish",
    toId: null,
    pax: 1,
    tripType: "one-way"
  };

  /* ---- DOM refs ---- */
  var mapEl = document.getElementById("route-map");
  var fromRow = document.getElementById("from-row");
  var mapInstructions = document.getElementById("map-instructions");
  var farePlaceholder = document.getElementById("fare-placeholder");
  var fareContent = document.getElementById("fare-content");

  if (!mapEl) return; // not on this page

  /* ---- Map setup ---- */
  var map = L.map(mapEl, {
    minZoom: 9,
    maxZoom: 16,
    zoomSnap: 0.5,
    doubleClickZoom: false // double-click/double-tap on a pin is used to set "From" instead
  });

  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 17,
    attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics"
  }).addTo(map);

  var bounds = L.latLngBounds(LOCATIONS.map(function (l) { return [l.lat, l.lon]; }));
  map.fitBounds(bounds, { padding: [50, 50] });

  setTimeout(function () { map.invalidateSize(); }, 200);

  var routeLine = L.polyline([], {
    color: "#fbbf24",
    weight: 3,
    dashArray: "8 8",
    opacity: 0
  }).addTo(map);

  var dragLine = L.polyline([], {
    color: "#fde68a",
    weight: 2,
    dashArray: "4 6",
    opacity: 0
  }).addTo(map);

  /* ---- Pins ---- */
  var pinMarkers = {};
  LOCATIONS.forEach(function (loc) {
    var marker = L.marker([loc.lat, loc.lon], {
      icon: L.divIcon({ className: "gold-pin-icon", iconSize: [16, 16], iconAnchor: [8, 8] }),
      title: loc.name,
      keyboard: true
    }).addTo(map);

    marker.bindTooltip(loc.name, {
      permanent: true,
      direction: "right",
      offset: [10, 0],
      className: "pin-label-tooltip"
    });

    // The DOM always fires two "click" events before a "dblclick", so a
    // dblclick listener here would fire after handlePinClick had already
    // run twice - too late to tell the difference. Instead, time the
    // clicks ourselves and treat a second click on the same pin within
    // the window as a double-click.
    marker.on("click", function () { handlePinOrDoubleClick(loc.id); });

    pinMarkers[loc.id] = marker;
  });

  var DOUBLE_CLICK_MS = 350;
  var lastPinClick = { id: null, time: 0 };

  function handlePinOrDoubleClick(id) {
    var now = Date.now();
    var isDoubleClick = lastPinClick.id === id && now - lastPinClick.time < DOUBLE_CLICK_MS;
    lastPinClick.id = id;
    lastPinClick.time = now;

    if (isDoubleClick) {
      handlePinDoubleClick(id);
    } else {
      handlePinClick(id);
    }
  }

  function handlePinClick(id) {
    if (id === state.fromId) return;
    state.toId = id;
    render();
  }

  /* Double-click/double-tap a pin to start the trip from there instead -
     the quick way to change "From" without hunting for the pill row.
     Clears "To" too, since the old destination no longer makes sense
     once the starting point changes. */
  function handlePinDoubleClick(id) {
    state.fromId = id;
    if (state.toId === id) state.toId = null;
    render();
  }

  /* ---- Boat marker ---- */
  var boatSvg =
    '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1c1305" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round">' +
    '<circle r="12" cx="12" cy="12" fill="#fbbf24" stroke="none"/>' +
    '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1" transform="translate(0,-1)"/>' +
    '<path d="M12 3v8" transform="translate(0,-1)"/>' +
    '<path d="M8 6l4-3 4 3" transform="translate(0,-1)"/>' +
    "</svg>";

  var boat = L.marker([byId(state.fromId).lat, byId(state.fromId).lon], {
    icon: L.divIcon({ className: "boat-marker-icon", html: boatSvg, iconSize: [28, 28], iconAnchor: [14, 14] }),
    draggable: true,
    autoPan: true
  }).addTo(map);

  boat.on("dragstart", function () {
    dragLine.setStyle({ opacity: 0.85 });
  });

  boat.on("drag", function (e) {
    var pos = e.target.getLatLng();
    var from = byId(state.fromId);
    dragLine.setLatLngs([[from.lat, from.lon], [pos.lat, pos.lng]]);
  });

  boat.on("dragend", function (e) {
    dragLine.setStyle({ opacity: 0 });
    var pos = e.target.getLatLng();
    var target = nearestByPixel(pos, state.fromId);
    if (target) state.toId = target.id;
    render();
  });

  function nearestByPixel(latlng, excludeId) {
    var p = map.latLngToContainerPoint(latlng);
    var best = null;
    var bestDist = Infinity;
    LOCATIONS.forEach(function (loc) {
      if (loc.id === excludeId) return;
      var lp = map.latLngToContainerPoint([loc.lat, loc.lon]);
      var d = Math.hypot(lp.x - p.x, lp.y - p.y);
      if (d < bestDist) {
        bestDist = d;
        best = loc;
      }
    });
    return bestDist <= SNAP_THRESHOLD_PX ? best : null;
  }

  function animateBoatTo(lat, lon) {
    if (prefersReducedMotion) {
      boat.setLatLng([lat, lon]);
      return;
    }
    var start = boat.getLatLng();
    var startTime = null;

    function step(ts) {
      if (!startTime) startTime = ts;
      var t = Math.min(1, (ts - startTime) / BOAT_ANIM_MS);
      var ease = 1 - Math.pow(1 - t, 3);
      boat.setLatLng([
        start.lat + (lat - start.lat) * ease,
        start.lng + (lon - start.lng) * ease
      ]);
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ---- Build "From" pills ---- */
  LOCATIONS.forEach(function (loc) {
    var pill = document.createElement("button");
    pill.type = "button";
    pill.className = "pin-pill";
    pill.textContent = loc.name;
    pill.dataset.id = loc.id;
    pill.addEventListener("click", function () {
      state.fromId = loc.id;
      if (state.toId === loc.id) state.toId = null;
      render();
    });
    fromRow.appendChild(pill);
  });

  /* ---- Passenger stepper & trip type toggle ---- */
  var paxMinus = document.getElementById("pax-minus");
  var paxPlus = document.getElementById("pax-plus");
  if (paxMinus) {
    paxMinus.addEventListener("click", function () {
      state.pax = Math.max(1, state.pax - 1);
      render();
    });
    paxPlus.addEventListener("click", function () {
      state.pax = Math.min(MAX_PAX, state.pax + 1);
      render();
    });
  }

  var toggleBtns = document.querySelectorAll(".toggle-btn");
  toggleBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      toggleBtns.forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      state.tripType = btn.dataset.trip;
      render();
    });
  });

  /* ---- Fare formatting helpers ---- */
  function formatTime(hours) {
    var totalMin = Math.round(hours * 60);
    if (totalMin < 60) return totalMin + " min";
    var h = Math.floor(totalMin / 60);
    var m = totalMin % 60;
    return h + "h" + (m ? " " + m + "m" : "");
  }

  function computeFare(distanceNm, pax, tripType) {
    var oneWay = Math.max(BASE_FEE + distanceNm * RATE_PER_NM, MIN_FARE);
    var total = tripType === "round-trip" ? oneWay * ROUND_TRIP_MULTIPLIER : oneWay;
    var extraPax = Math.max(0, pax - INCLUDED_PAX);
    total += extraPax * EXTRA_PAX_FEE;
    return Math.round(total / 5) * 5;
  }

  /* ---- Render ---- */
  function render() {
    var pills = fromRow.querySelectorAll(".pin-pill");
    pills.forEach(function (p) {
      p.classList.toggle("active", p.dataset.id === state.fromId);
    });

    LOCATIONS.forEach(function (loc) {
      var el = pinMarkers[loc.id].getElement();
      if (!el) return;
      el.classList.toggle("is-from", loc.id === state.fromId);
      el.classList.toggle("is-to", loc.id === state.toId);
    });

    var from = byId(state.fromId);
    var to = state.toId ? byId(state.toId) : null;

    var target = to || from;
    animateBoatTo(target.lat, target.lon);

    if (to) {
      var waypoints = routeWaypoints(state.fromId, state.toId);
      routeLine.setLatLngs(waypoints);
      routeLine.setStyle({ opacity: 0.9 });
      mapInstructions.innerHTML =
        "Route set: <strong>" + from.name + "</strong> &rarr; <strong>" + to.name +
        "</strong>. Tap a new pin for a new destination, or double-tap a pin to start from there instead.";
    } else {
      routeLine.setStyle({ opacity: 0 });
      mapInstructions.innerHTML =
        "Boat is at <strong>" + from.name + "</strong>. Tap a pin for your destination, or double-tap a pin to start from there instead.";
    }

    if (!to) {
      farePlaceholder.style.display = "";
      fareContent.style.display = "none";
      return;
    }

    farePlaceholder.style.display = "none";
    fareContent.style.display = "";

    var distanceNm = pathDistanceNm(routeWaypoints(state.fromId, state.toId));
    var cruiseHours = distanceNm / CRUISE_SPEED_KNOTS;
    var displayHours = state.tripType === "round-trip" ? cruiseHours * 2 : cruiseHours;
    var fare = computeFare(distanceNm, state.pax, state.tripType);

    document.getElementById("fare-from").textContent = from.name;
    document.getElementById("fare-to").textContent = to.name;

    var highlightEl = document.getElementById("fare-highlight");
    if (highlightEl) {
      if (to.highlight) {
        highlightEl.textContent = to.highlight;
        highlightEl.style.display = "";
      } else {
        highlightEl.style.display = "none";
      }
    }
    document.getElementById("fare-distance").textContent =
      distanceNm.toFixed(1) + " nm" + (state.tripType === "round-trip" ? " (one-way)" : "");
    document.getElementById("fare-time").textContent = formatTime(displayHours) + " underway";
    document.getElementById("pax-count").textContent = state.pax;
    document.getElementById("fare-amount").textContent = "$" + fare.toLocaleString();

    var reqLink = document.getElementById("request-trip-link");
    if (reqLink) {
      var subject = "Water Taxi Trip Request: " + from.name + " to " + to.name;
      var body =
        "Hi! I'd like to request a water taxi trip.\n\n" +
        "From: " + from.name + "\n" +
        "To: " + to.name + "\n" +
        "Trip type: " + (state.tripType === "round-trip" ? "Round trip" : "One-way") + "\n" +
        "Passengers: " + state.pax + "\n" +
        "Rough online estimate: $" + fare.toLocaleString() + " (from squamishwatertaxi.com)\n\n" +
        "Preferred date/time: \n";
      reqLink.href =
        "mailto:squamishwatertaxi@gmail.com?subject=" +
        encodeURIComponent(subject) +
        "&body=" +
        encodeURIComponent(body);
    }
  }

  render();
})();
