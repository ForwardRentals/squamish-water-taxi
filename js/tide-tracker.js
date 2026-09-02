/* ==========================================================================
   Squamish Water Taxi - Live Tide Tracker
   Pulls real, live predictions from the Canadian Hydrographic Service (CHS)
   Integrated Water Level System (IWLS) public API - no key required.
   Station: Point Atkinson (CHS code 07795), the official reference station
   at the mouth of Howe Sound. https://tides.gc.ca/en/stations/07795
   ========================================================================== */

(function () {
  "use strict";

  var STATION_ID = "5cebf1de3d0f4a073c4bb94c"; // Point Atkinson
  var API_BASE = "https://api-iwls.dfo-mpo.gc.ca/api/v1/stations/" + STATION_ID + "/data";

  var loadingEl = document.getElementById("tide-loading");
  var errorEl = document.getElementById("tide-error");
  var bodyEl = document.getElementById("tide-body");
  if (!loadingEl) return; // not on this page

  var currentValueEl = document.getElementById("tide-current-value");
  var trendEl = document.getElementById("tide-trend");
  var eventsEl = document.getElementById("tide-events");
  var chartSvg = document.getElementById("tide-chart");

  function isoNow() {
    return new Date().toISOString().replace(/\.\d+Z$/, "Z");
  }

  function isoPlusHours(hours) {
    return new Date(Date.now() + hours * 3600 * 1000).toISOString().replace(/\.\d+Z$/, "Z");
  }

  function fetchSeries(code, fromIso, toIso) {
    var url = API_BASE + "?time-series-code=" + code + "&from=" + fromIso + "&to=" + toIso;
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error("CHS API returned " + res.status);
      return res.json();
    });
  }

  function formatTime(dateObj) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Vancouver",
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    }).format(dateObj);
  }

  Promise.all([
    fetchSeries("wlp", isoNow(), isoPlusHours(36)), // continuous predicted curve
    fetchSeries("wlp-hilo", isoNow(), isoPlusHours(72)) // upcoming high/low events
  ])
    .then(function (results) {
      var curve = results[0];
      var events = results[1];

      if (!curve || !curve.length) throw new Error("No tide data returned");

      renderChart(curve, events);
      renderCurrent(curve);
      renderEvents(events);

      loadingEl.style.display = "none";
      bodyEl.style.display = "";
    })
    .catch(function (err) {
      loadingEl.style.display = "none";
      errorEl.style.display = "";
      errorEl.innerHTML =
        "Live tide data couldn't be loaded right now. You can check current conditions directly at " +
        '<a href="https://tides.gc.ca/en/stations/07795" target="_blank" rel="noopener noreferrer">tides.gc.ca (Point Atkinson)</a>.';
      // eslint-disable-next-line no-console
      console.error("Tide fetch failed:", err);
    });

  function renderCurrent(curve) {
    var now = Date.now();
    // Find the curve point closest to now
    var closest = curve[0];
    var closestDiff = Infinity;
    for (var i = 0; i < curve.length; i++) {
      var diff = Math.abs(new Date(curve[i].eventDate).getTime() - now);
      if (diff < closestDiff) {
        closestDiff = diff;
        closest = curve[i];
      }
    }

    currentValueEl.textContent = closest.value.toFixed(2);

    // Determine trend by comparing to a point ~20 min later in the series
    var idx = curve.indexOf(closest);
    var compareIdx = Math.min(curve.length - 1, idx + 4);
    var delta = curve[compareIdx].value - closest.value;

    if (Math.abs(delta) < 0.02) {
      trendEl.textContent = "Slack Tide";
    } else if (delta > 0) {
      trendEl.textContent = "↑ Rising";
    } else {
      trendEl.textContent = "↓ Falling";
    }
  }

  function renderEvents(events) {
    eventsEl.innerHTML = "";
    var upcoming = events
      .filter(function (e) { return new Date(e.eventDate).getTime() >= Date.now(); })
      .slice(0, 4);

    upcoming.forEach(function (e) {
      var d = new Date(e.eventDate);
      var card = document.createElement("div");
      card.className = "tide-event";
      card.innerHTML =
        '<div class="tide-event-type">' + "Tide" + "</div>" +
        '<div class="tide-event-time">' + formatTime(d) + "</div>" +
        '<div class="tide-event-height">' + e.value.toFixed(2) + " m</div>";
      eventsEl.appendChild(card);
    });

    // Label each as High/Low by comparing to neighbors in the full (unfiltered) list
    for (var i = 0; i < upcoming.length; i++) {
      var globalIdx = events.indexOf(upcoming[i]);
      var prevVal = globalIdx > 0 ? events[globalIdx - 1].value : null;
      var nextVal = globalIdx < events.length - 1 ? events[globalIdx + 1].value : null;
      var v = upcoming[i].value;
      var label = "Tide";
      if ((prevVal === null || v > prevVal) && (nextVal === null || v > nextVal)) label = "High";
      else if ((prevVal === null || v < prevVal) && (nextVal === null || v < nextVal)) label = "Low";
      var typeEl = eventsEl.children[i].querySelector(".tide-event-type");
      if (typeEl) typeEl.textContent = label + " Tide";
    }
  }

  function renderChart(curve, events) {
    var W = 900, H = 260, padL = 40, padR = 20, padT = 20, padB = 30;
    var innerW = W - padL - padR, innerH = H - padT - padB;

    var times = curve.map(function (p) { return new Date(p.eventDate).getTime(); });
    var values = curve.map(function (p) { return p.value; });
    var tMin = Math.min.apply(null, times), tMax = Math.max.apply(null, times);
    var vMin = Math.min.apply(null, values), vMax = Math.max.apply(null, values);
    var vPad = (vMax - vMin) * 0.15 || 0.2;
    vMin -= vPad;
    vMax += vPad;

    function xFor(t) { return padL + ((t - tMin) / (tMax - tMin || 1)) * innerW; }
    function yFor(v) { return padT + (1 - (v - vMin) / (vMax - vMin || 1)) * innerH; }

    var linePoints = curve.map(function (p) {
      return xFor(new Date(p.eventDate).getTime()) + "," + yFor(p.value);
    });
    var linePath = "M" + linePoints.join(" L");
    var areaPath =
      "M" + xFor(tMin) + "," + yFor(vMin) +
      " L" + linePoints.join(" L") +
      " L" + xFor(tMax) + "," + yFor(vMin) + " Z";

    var svgns = "http://www.w3.org/2000/svg";
    function el(tag, attrs) {
      var e = document.createElementNS(svgns, tag);
      for (var k in attrs) e.setAttribute(k, attrs[k]);
      return e;
    }

    chartSvg.innerHTML = "";
    chartSvg.setAttribute("viewBox", "0 0 " + W + " " + H);

    var defs = el("defs", {});
    var grad = el("linearGradient", { id: "tideAreaGradient", x1: "0", y1: "0", x2: "0", y2: "1" });
    var stop1 = el("stop", { offset: "0%", "stop-color": "#fbbf24", "stop-opacity": "0.35" });
    var stop2 = el("stop", { offset: "100%", "stop-color": "#fbbf24", "stop-opacity": "0" });
    grad.appendChild(stop1);
    grad.appendChild(stop2);
    defs.appendChild(grad);
    chartSvg.appendChild(defs);

    // Day-boundary gridlines
    var dayCursor = new Date(tMin);
    dayCursor.setMinutes(0, 0, 0);
    dayCursor.setHours(0);
    dayCursor = new Date(dayCursor.getTime() + 24 * 3600 * 1000);
    while (dayCursor.getTime() < tMax) {
      var gx = xFor(dayCursor.getTime());
      chartSvg.appendChild(el("line", {
        x1: gx, y1: padT, x2: gx, y2: H - padB,
        stroke: "#334155", "stroke-width": "1", "stroke-dasharray": "3 4"
      }));
      dayCursor = new Date(dayCursor.getTime() + 24 * 3600 * 1000);
    }

    // Area
    chartSvg.appendChild(el("path", { d: areaPath, fill: "url(#tideAreaGradient)", stroke: "none" }));

    // Animated wave texture, clipped to the chart area, sitting low inside the
    // shaded fill so it always reads as "water" no matter the curve's shape.
    var clipId = "tideClip";
    var clipPathEl = el("clipPath", { id: clipId });
    clipPathEl.appendChild(el("rect", { x: padL, y: padT, width: innerW, height: innerH }));
    defs.appendChild(clipPathEl);

    function buildWavePath(baseY, amp, phase, totalWidth) {
      var segW = 60;
      var startX = -140 + phase;
      var endX = totalWidth + 140;
      var d = "M" + startX + "," + baseY;
      var x = startX;
      var dir = 1;
      while (x < endX) {
        var midX = x + segW / 2;
        var nextX = x + segW;
        d += " Q" + midX + "," + (baseY + dir * amp) + " " + nextX + "," + baseY;
        dir *= -1;
        x = nextX;
      }
      return d;
    }

    var waveGroup = el("g", { "clip-path": "url(#" + clipId + ")" });
    var waveBaseY = H - padB - 5;

    var waveLayer1 = el("g", { class: "tide-wave-layer" });
    waveLayer1.appendChild(el("path", {
      d: buildWavePath(waveBaseY, 4, 0, W),
      fill: "none", stroke: "#fbbf24", "stroke-width": "1.5", opacity: "0.35", "stroke-linecap": "round"
    }));
    waveGroup.appendChild(waveLayer1);

    var waveLayer2 = el("g", { class: "tide-wave-layer-2" });
    waveLayer2.appendChild(el("path", {
      d: buildWavePath(waveBaseY - 6, 3, 30, W),
      fill: "none", stroke: "#fde68a", "stroke-width": "1", opacity: "0.22", "stroke-linecap": "round"
    }));
    waveGroup.appendChild(waveLayer2);

    chartSvg.appendChild(waveGroup);

    // Data line (glows gently via CSS)
    chartSvg.appendChild(el("path", {
      d: linePath, class: "tide-line", fill: "none", stroke: "#fbbf24", "stroke-width": "2.5"
    }));

    // "Now" marker
    var nowX = xFor(Date.now());
    if (nowX >= padL && nowX <= W - padR) {
      chartSvg.appendChild(el("line", {
        x1: nowX, y1: padT, x2: nowX, y2: H - padB,
        stroke: "#e2e8f0", "stroke-width": "1.5", "stroke-dasharray": "2 3", opacity: "0.6"
      }));
      var nowLabel = el("text", {
        x: nowX, y: padT - 6, fill: "#e2e8f0", "font-size": "11",
        "text-anchor": "middle", "font-weight": "600"
      });
      nowLabel.textContent = "Now";
      chartSvg.appendChild(nowLabel);
    }

    // High/low markers within the charted window
    events.forEach(function (e) {
      var t = new Date(e.eventDate).getTime();
      if (t < tMin || t > tMax) return;
      var x = xFor(t), y = yFor(e.value);
      chartSvg.appendChild(el("circle", { cx: x, cy: y, r: "4", fill: "#0f172a", stroke: "#fbbf24", "stroke-width": "2" }));
      var lbl = el("text", {
        x: x, y: y - 10, fill: "#fde68a", "font-size": "10.5",
        "text-anchor": "middle", "font-weight": "600"
      });
      lbl.textContent = e.value.toFixed(1) + "m";
      chartSvg.appendChild(lbl);
    });

    // Y-axis labels (min/mid/max)
    [vMin + vPad * 0.3, (vMin + vMax) / 2, vMax - vPad * 0.3].forEach(function (v) {
      var y = yFor(v);
      var lbl = el("text", { x: 4, y: y + 4, fill: "#64748b", "font-size": "10.5" });
      lbl.textContent = v.toFixed(1) + "m";
      chartSvg.appendChild(lbl);
    });
  }
})();
