#!/usr/bin/env python3
"""Build Howe Sound water taxi destination pages + the destinations.html hub.

One template, one data entry per destination. Shared chrome (head icons, nav,
page CSS, footer, booking widget) is sliced out of porteau-cove.html so the
pages always match the hand-built ones.

Distances/times come from the same route data as js/trip-planner.js
(Squamish dock, 18 kn cruise). Prices are NOT printed here because the
planner's fare formula is still an approximation; CTAs deep-link to the
planner (/?from=squamish&to=<id>#planner) for a live estimate.

Run:  python3 scripts/build_destinations.py   (then update sitemap via --sitemap)
"""
import html, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://squamishwatertaxi.com"
SRC = (ROOT / "porteau-cove.html").read_text()

HEAD_ICONS = SRC[SRC.index('  <link rel="icon"'):SRC.index("  <title>")]
STYLE = SRC[SRC.index("  <style>"):SRC.index("</head>")]
NAV = SRC[SRC.index("  <!-- Navigation -->"):SRC.index("  <!-- Hero Section -->")]
FOOTER = SRC[SRC.index("  <!-- Footer -->"):SRC.index("</body>")]

# id matches LOCATIONS in js/trip-planner.js; nm/min = route from Squamish.
DESTS = [
    {
        "id": "anvil", "slug": "water-taxi-anvil-island", "name": "Anvil Island",
        "nm": 16.5, "min": 55, "lat": 49.5146, "lon": -123.3014,
        "img": "blog-howe-sound-golden-light.jpg",
        "title": "Water Taxi to Anvil Island | Leading Peak Hike Drop-Off",
        "desc": "Private water taxi from Squamish to Anvil Island in Howe Sound. Drop-off and pick-up for the Leading Peak hike, cabins and day trips. About 55 minutes, up to 6 passengers.",
        "tagline": "Boat access to the Leading Peak trail and the island's shoreline, straight from Squamish or any Howe Sound launch",
        "why": ("No ferry runs to Anvil Island", "Anvil has no road connection and no scheduled ferry service. A private water taxi is the simplest way out for hikers, cabin owners and anyone who wants a day on one of Howe Sound's most recognizable islands."),
        "about": "Anvil Island sits in the middle of upper Howe Sound, its sharp summit easy to pick out from the Sea to Sky Highway. The island's high point, Leading Peak, is a steep climb with views straight down the fjord. It's a hike most people only ever look at from the road.",
        "doing": "Most trips are hiker drop-offs for Leading Peak. Plan a full day and pick a pick-up time with plenty of buffer. Cabin owners use us for supply runs and guest transfers, and some groups simply want a picnic on a quiet beach.",
        "perfect": "Peak-baggers, photographers, cabin owners moving people and gear, and anyone chasing a Howe Sound island most visitors never set foot on.",
        "plan": "Tell us your group size, how much gear you're bringing and when you want to be picked up. We confirm the landing spot for the day's tide and weather. Bring water. There are no services on the island.",
        "faqs": [
            ("How do you get to Anvil Island?", "By private boat. There's no road and no scheduled ferry. Squamish Water Taxi runs drop-offs and pick-ups from Squamish (about 16.5 nautical miles, roughly 55 minutes) or from other Howe Sound launches like Porteau Cove."),
            ("Can you drop us off for the Leading Peak hike?", "Yes. That's the most popular Anvil Island trip. We drop you at the shore in the morning and come back at the time you choose. Leave generous time for the climb and the descent."),
            ("How many people fit on the water taxi?", "Up to 6 passengers per trip, with room for day packs. Let us know about bulky gear or dogs when you book."),
        ],
        "related": ["ekins", "mcnab", "artaban"],
    },
    {
        "id": "mcnab", "slug": "water-taxi-mcnab-creek", "name": "McNab Creek",
        "nm": 16.6, "min": 55, "lat": 49.5656, "lon": -123.3993,
        "img": "blog-howe-sound-dusk-view.jpg",
        "title": "Water Taxi to McNab Creek | Howe Sound West Shore Access",
        "desc": "Water taxi from Squamish to McNab Creek on the west shore of Howe Sound. Boat-only access for residents, contractors, hikers and gear. About 55 minutes, up to 6 passengers.",
        "tagline": "Boat-only access to the west shore of Howe Sound, for people, gear and supplies",
        "why": ("The west shore has no highway", "McNab Creek is on the far side of Howe Sound, with no road link to the Sea to Sky Highway. Everything that goes there, people and supplies alike, goes by boat."),
        "about": "McNab Creek flows into Howe Sound on its quiet western shoreline, across the water from Porteau Cove. It's a working coastline of cabins and properties, with mountains rising straight behind it. It feels remote even though it's in plain view of the highway.",
        "doing": "Resident and owner transfers, contractor and crew runs, supply drops, and hikers or explorers heading into the west-shore backcountry. We can run scheduled round trips or one-way transfers.",
        "perfect": "Property owners, work crews, and adventurers who want to start a trip somewhere the crowds can't drive to.",
        "plan": "Tell us how many people are going and what gear is coming. For work trips, mention the load size so we can plan the boat. We confirm the landing for tide and wind on the day.",
        "faqs": [
            ("How do you get to McNab Creek?", "By boat. There's no road connection from the Sea to Sky Highway. Squamish Water Taxi runs from Squamish (about 16.6 nautical miles, roughly 55 minutes), and from Porteau Cove directly across the Sound, which is a much shorter hop."),
            ("Can you carry tools, supplies or gear?", "Yes, within the boat's limits. Tell us the size and weight when you book and we'll confirm it fits along with your passengers."),
            ("Do you do regular or repeat runs?", "Yes. Owners and crews often book repeat transfers. Call (604) 849-8898 to set up a schedule."),
        ],
        "related": ["ekins", "anvil", "porteau"],
    },
    {
        "id": "ekins", "slug": "water-taxi-ekins-point", "name": "Ekins Point",
        "nm": 17.2, "min": 57, "lat": 49.5369, "lon": -123.3782,
        "img": "blog-howe-sound-sunset-silhouette.jpg",
        "title": "Water Taxi to Ekins Point | Howe Sound Cabin Transfers",
        "desc": "Water taxi from Squamish to Ekins Point on the west side of Howe Sound. Cabin owner, guest and supply transfers by boat. About an hour, up to 6 passengers.",
        "tagline": "Cabin, guest and supply transfers to the west side of Howe Sound, with no ferry schedule to work around",
        "why": ("Your schedule, not a ferry's", "Ekins Point is on the roadless west side of Howe Sound, north of Gambier Island. A private water taxi gets you and your guests there when it suits you. There's no waiting on a ferry and no extra stops."),
        "about": "Ekins Point looks out over the upper Sound toward Anvil Island. It's a quiet stretch of waterfront where cabins are reached by water, and the trip in is part of the appeal: fjord walls, seals on the rocks and eagles overhead.",
        "doing": "Weekend cabin arrivals, guest pick-ups, grocery and supply runs, and end-of-season closing trips. We can meet you in Squamish, Porteau Cove or other Howe Sound launches.",
        "perfect": "Cabin owners, families heading out for the weekend, and guests who'd rather not work out boat logistics themselves.",
        "plan": "Tell us the number of people, how much luggage or supplies you have, and your preferred departure time. Friday-evening and Sunday runs book up first in summer.",
        "faqs": [
            ("How do you get to Ekins Point?", "By boat. It's on the west side of Howe Sound with no road access. From Squamish it's about 17 nautical miles, roughly an hour. From Porteau Cove it's quicker."),
            ("Can you pick up guests for us?", "Yes. Give us their names and arrival time, and we'll meet them at the launch and bring them out."),
            ("What about weather?", "Howe Sound can get windy, especially in the afternoon. We watch the forecast and will suggest a better time if conditions are poor. Safety comes first."),
        ],
        "related": ["anvil", "mcnab", "artaban"],
    },
    {
        "id": "artaban", "slug": "water-taxi-gambier-island", "name": "Gambier Island (Camp Artaban)",
        "short": "Gambier Island", "nm": 18.1, "min": 60, "lat": 49.4757, "lon": -123.354,
        "img": "squamish-rib-boat-howe-sound.jpg",
        "title": "Water Taxi to Gambier Island & Camp Artaban from Squamish",
        "desc": "Private water taxi from Squamish to Gambier Island and Camp Artaban in Howe Sound. Camp drop-offs, cabin transfers and day trips. About an hour, up to 6 passengers.",
        "tagline": "Door-to-dock transfers to Howe Sound's biggest island, including Camp Artaban drop-offs",
        "why": ("Skip the Horseshoe Bay detour", "Getting to Gambier from Squamish usually means driving to Horseshoe Bay and lining up a boat from there. We go straight down the Sound from Squamish instead, in about an hour."),
        "about": "Gambier Island is the largest island in Howe Sound. It's a mix of cabins, camps and forest with no bridge or car ferry. Camp Artaban sits on the island's south side and is one of the island's best-known destinations.",
        "doing": "Camp drop-offs and pick-ups for campers, families and staff, cabin owner transfers, and day trips to explore the island's bays.",
        "perfect": "Families heading to camp, cabin owners coming from the Sea to Sky, and groups who want to skip the drive to the city.",
        "plan": "Tell us which part of Gambier you're heading to (Camp Artaban or another bay), how many people are going and how much luggage you have. Camp start and end days fill quickly, so book early.",
        "faqs": [
            ("How do you get to Gambier Island from Squamish?", "By private boat. Squamish Water Taxi goes straight down Howe Sound from Squamish to Camp Artaban, about 18 nautical miles or roughly an hour. There's no drive to Horseshoe Bay."),
            ("Do you drop off at Camp Artaban?", "Yes. Camp Artaban is one of our mapped destinations. We also go to other Gambier bays. Just tell us where you're headed."),
            ("Can we bring luggage for a week at camp?", "Yes. Tell us how many bags you have when you book so we can plan the space alongside your passengers (up to 6)."),
        ],
        "related": ["smittys", "anvil", "horseshoe"],
    },
    {
        "id": "smittys", "slug": "water-taxi-gibsons", "name": "Gibsons (Smitty's Oyster House)",
        "short": "Gibsons", "nm": 25.6, "min": 85, "lat": 49.3987, "lon": -123.5025,
        "img": "howe-sound-sunset.jpg",
        "title": "Squamish to Gibsons by Boat | Water Taxi to the Sunshine Coast",
        "desc": "Water taxi from Squamish to Gibsons on the Sunshine Coast. Skip the BC Ferries lineup and lunch at Smitty's Oyster House. About 85 minutes, up to 6 passengers.",
        "tagline": "Squamish to the Sunshine Coast with no ferry lineup. Lunch at Smitty's Oyster House on the Gibsons waterfront",
        "why": ("No ferry lineup", "Driving from Squamish to Gibsons means a trip to Horseshoe Bay and a BC Ferries sailing. By water taxi you leave from Squamish on your own schedule and come in right at the Gibsons waterfront."),
        "about": "Gibsons is the gateway to the Sunshine Coast: a harbour town with a working marina, galleries and seafood restaurants along the water. Smitty's Oyster House on the harbour is a favourite stop and makes a great lunch destination.",
        "doing": "Lunch runs to Smitty's, one-way transfers for people heading up the Sunshine Coast, and full Howe Sound days that end with a meal in Gibsons. The route runs the length of the Sound, past Anvil and Gambier.",
        "perfect": "Day-trippers looking for a memorable lunch, groups celebrating something, and anyone whose ferry plans fell through.",
        "plan": "Book a round trip with time ashore, or go one way. Tell us your group size and how long you want in Gibsons. For dinner returns we'll watch the evening light and conditions.",
        "faqs": [
            ("Can you take a boat from Squamish to Gibsons?", "Yes. Squamish Water Taxi runs private trips from Squamish to the Gibsons waterfront, about 25.6 nautical miles or roughly 85 minutes at cruising speed, with no BC Ferries lineup."),
            ("Can we do a lunch trip to Smitty's Oyster House?", "That's one of our favourite trips. We run you down the Sound, you have lunch on the Gibsons waterfront, and we bring you home."),
            ("Is it faster than the ferry?", "Usually, from Squamish. The ferry route means driving to Horseshoe Bay, waiting in line and then sailing. The water taxi goes direct from Squamish."),
        ],
        "related": ["artaban", "horseshoe", "vancouver"],
    },
    {
        "id": "britannia", "slug": "water-taxi-britannia-beach", "name": "Britannia Beach",
        "nm": 6.6, "min": 22, "lat": 49.6167, "lon": -123.2064,
        "img": "squamish-mountain-sunset.jpg",
        "title": "Water Taxi Squamish to Britannia Beach | Howe Sound Boat Transfer",
        "desc": "Water taxi between Squamish and Britannia Beach on Howe Sound. Quick scenic transfers, pick-ups and backup transport during Highway 99 closures. About 20 minutes.",
        "tagline": "A 20-minute run down the Sound between Squamish and Britannia Beach",
        "why": ("When the highway isn't an option", "When Highway 99 closes or backs up, the water is still open. A water taxi between Squamish and Britannia Beach keeps people moving, and on a calm day it's a far better view than the dashboard."),
        "about": "Britannia Beach is the highway village just south of Squamish, home to the Britannia Mine Museum and a stretch of Howe Sound shoreline under steep granite walls. It's the closest stop on the Sound to Squamish.",
        "doing": "Short transfers and pick-ups, backup transport during highway closures, and the first leg of longer Howe Sound trips. It's also a quick scenic run for visitors who want a taste of the Sound.",
        "perfect": "Locals dealing with a highway closure, visitors combining the mine museum with time on the water, and anyone who wants a short, scenic hop.",
        "plan": "Tell us your pick-up point and time. For closure-related trips, call (604) 849-8898 and we'll tell you honestly what's possible that day.",
        "faqs": [
            ("How long is the boat from Squamish to Britannia Beach?", "About 6.6 nautical miles, roughly 20 minutes at cruising speed, depending on conditions."),
            ("Do you run during Highway 99 closures?", "When conditions allow, yes. Call us as early as you can. See our guide to <a href=\"blog/emergency-marine-service-highway-99-closures.html\">marine transport during Highway 99 closures</a>."),
            ("Can we keep going past Britannia?", "Of course. Britannia is the first stop on the way to Porteau Cove, the islands and beyond. Plan any route on the <a href=\"index.html#planner\">trip planner</a>."),
        ],
        "related": ["porteau", "lionsbay", "anvil"],
    },
    {
        "id": "lionsbay", "slug": "water-taxi-lions-bay", "name": "Lions Bay",
        "nm": 17.1, "min": 57, "lat": 49.4583, "lon": -123.2364,
        "img": "blog-howe-sound-view-from-the-chief.jpg",
        "title": "Water Taxi to Lions Bay from Squamish | Howe Sound Boat Transfer",
        "desc": "Water taxi between Squamish and Lions Bay on Howe Sound. Private transfers, highway-closure backup and scenic trips along the fjord. About an hour, up to 6 passengers.",
        "tagline": "Private transfers along the east shore of Howe Sound between Squamish and Lions Bay",
        "why": ("The scenic way down the corridor", "Lions Bay sits on the busiest, twistiest stretch of the Sea to Sky Highway. By boat you trade traffic for granite walls, waterfalls and open water, and the water stays open when the highway doesn't."),
        "about": "Lions Bay is a small village on the east shore of lower Howe Sound, tucked under the peaks it's named after. Its small marina and waterfront make it a useful pick-up point between Squamish and Horseshoe Bay.",
        "doing": "Resident transfers, pick-ups for hikers coming off the Lions trails, highway-closure backup, and scenic runs up to Squamish for visitors staying in the village.",
        "perfect": "Lions Bay residents, hikers who want a different way home, and visitors who'd rather see the fjord from the water.",
        "plan": "Tell us your pick-up time and group size, and we'll confirm the meeting point on the Lions Bay waterfront for the day's conditions.",
        "faqs": [
            ("How long is the boat from Squamish to Lions Bay?", "About 17 nautical miles, roughly an hour at cruising speed."),
            ("Can you pick us up after a hike?", "Yes. Give us your expected finish time and we'll set a pick-up window. Call us if you're running late."),
            ("Do you go further south?", "Yes. Horseshoe Bay and downtown Vancouver are both on our route map. See the <a href=\"index.html#planner\">trip planner</a>."),
        ],
        "related": ["horseshoe", "britannia", "vancouver"],
    },
    {
        "id": "horseshoe", "slug": "water-taxi-horseshoe-bay", "name": "Horseshoe Bay",
        "nm": 22.3, "min": 74, "lat": 49.3757, "lon": -123.2719,
        "img": "blog-howe-sound-golden-light.jpg",
        "title": "Squamish to Horseshoe Bay by Boat | Private Water Taxi",
        "desc": "Private water taxi between Squamish and Horseshoe Bay. Connect with BC Ferries, skip Highway 99 traffic, or start a Howe Sound day trip. About 75 minutes, up to 6 passengers.",
        "tagline": "From the top of Howe Sound to the BC Ferries terminal at the bottom, on your schedule",
        "why": ("Connect without the drive", "Horseshoe Bay is where Howe Sound meets the ferries to Nanaimo, Bowen Island and the Sunshine Coast. A water taxi from Squamish gets you there without the highway."),
        "about": "Horseshoe Bay is the West Vancouver village at the mouth of Howe Sound. It has a busy ferry terminal, a marina, waterfront restaurants and views across to Bowen Island. It's the southern end of our everyday route.",
        "doing": "Ferry connections, transfers between Squamish and the North Shore, highway-closure backup, and the start or finish of a full-length Howe Sound trip.",
        "perfect": "Travellers catching a ferry, people moving between the North Shore and Squamish, and groups doing the whole Sound in one day.",
        "plan": "If you're catching a ferry, tell us your sailing time and we'll plan in a buffer. We confirm the meeting spot in the Horseshoe Bay marina area when you book.",
        "faqs": [
            ("How long is the boat from Squamish to Horseshoe Bay?", "About 22 nautical miles, roughly 75 minutes at cruising speed, depending on conditions."),
            ("Can we connect with a BC Ferries sailing?", "Yes. Tell us your sailing and we'll plan to arrive with time to spare. Weather can affect timing, so leave some buffer."),
            ("Is a water taxi faster than driving?", "On a clear day, driving is usually quicker. When there's a closure, heavy traffic, or a reason to enjoy the trip, the water taxi wins."),
        ],
        "related": ["vancouver", "lionsbay", "smittys"],
    },
    {
        "id": "vancouver", "slug": "water-taxi-squamish-to-vancouver", "name": "Vancouver",
        "nm": 32.3, "min": 108, "lat": 49.2934, "lon": -123.1206,
        "img": "blog-squamish-aurora-chief.jpg",
        "title": "Squamish to Vancouver by Boat | Private Water Taxi Charter",
        "desc": "Private boat from Squamish to downtown Vancouver through Howe Sound and English Bay. Charters, event transfers and highway-closure backup. About 1 hour 50 minutes, up to 6 passengers.",
        "tagline": "Through Howe Sound and English Bay, from the Squamish waterfront to downtown Vancouver",
        "why": ("The Sea to Sky, done by sea", "Squamish to Vancouver by boat is the full length of Howe Sound plus a run across to downtown. It's a trip few people ever make. It works as a memorable charter, an event transfer, or a way through when Highway 99 is closed."),
        "about": "The route follows the whole fjord south past Britannia, Porteau Cove, the islands and Horseshoe Bay, then crosses into English Bay toward downtown. We confirm the downtown meeting point when you book.",
        "doing": "One-way and return charters, special-occasion trips into the city, transfers for events, and backup transport when the highway is shut.",
        "perfect": "Groups marking a big occasion, people with city plans who'd rather skip the drive, and anyone who has always wanted to travel the Sea to Sky by water.",
        "plan": "This is our longest standard route, so weather matters most here. Book with some flexibility, and we'll confirm the timing and the downtown dock the day before.",
        "faqs": [
            ("Can you take a boat from Squamish to Vancouver?", "Yes. Squamish Water Taxi runs private trips from Squamish through Howe Sound to downtown Vancouver, about 32 nautical miles or roughly 1 hour 50 minutes at cruising speed."),
            ("Where do you drop off in Vancouver?", "We confirm a downtown meeting point when you book, based on the day's conditions and where you're headed."),
            ("Is this weather-dependent?", "Yes, more than any of our other routes, because it crosses open water at the mouth of the Sound. We'll suggest a different time if the forecast is poor."),
        ],
        "related": ["horseshoe", "lionsbay", "smittys"],
    },
]

# Existing hand-built pages that also belong in the hub/related lists.
EXISTING = {
    "porteau": {"name": "Porteau Cove", "href": "porteau-cove.html", "nm": 10.0, "min": 33,
                "blurb": "Sunrise and sunset tours from the closest Howe Sound launch to Vancouver."},
    "echolake": {"name": "Echo Lake & Echo Falls", "href": "echo-falls.html", "nm": 1.7, "min": 6,
                 "blurb": "A river crossing to a trailhead with no road access."},
}
BY_ID = {d["id"]: d for d in DESTS}


def e(s):
    return html.escape(s, quote=True)


def link_for(i):
    if i in BY_ID:
        d = BY_ID[i]
        return d["slug"] + ".html", d.get("short", d["name"]), d["tagline"]
    x = EXISTING[i]
    return x["href"], x["name"], x["blurb"]


def strip_tags(s):
    return re.sub(r"<[^>]+>", "", s)


def fmt_min(m):
    return f"{m} min" if m < 60 else f"{m // 60} hr" + (f" {m % 60} min" if m % 60 else "")


def page(d):
    url = f"{SITE}/{d['slug']}.html"
    short = d.get("short", d["name"])
    planner = f"index.html?from=squamish&to={d['id']}#planner"
    schema = [
        {
            "@context": "https://schema.org", "@type": "TaxiService",
            "@id": url + "#service",
            "name": f"Water Taxi from Squamish to {short}",
            "serviceType": "Water taxi",
            "description": strip_tags(d["desc"]),
            "url": url,
            "areaServed": {"@type": "Place", "name": d["name"],
                           "geo": {"@type": "GeoCoordinates", "latitude": d["lat"], "longitude": d["lon"]}},
            "provider": {"@type": "LocalBusiness", "@id": f"{SITE}/#business", "name": "Squamish Water Taxi",
                         "telephone": "+1-604-849-8898", "email": "squamishwatertaxi@gmail.com", "url": SITE},
        },
        {
            "@context": "https://schema.org", "@type": "FAQPage",
            "mainEntity": [{"@type": "Question", "name": q,
                            "acceptedAnswer": {"@type": "Answer", "text": strip_tags(a)}} for q, a in d["faqs"]],
        },
        {
            "@context": "https://schema.org", "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/"},
                {"@type": "ListItem", "position": 2, "name": "Destinations", "item": SITE + "/destinations.html"},
                {"@type": "ListItem", "position": 3, "name": short, "item": url},
            ],
        },
    ]
    ld = "\n".join(f'  <script type="application/ld+json">\n{json.dumps(s, indent=2)}\n  </script>' for s in schema)
    style = STYLE.replace("url('assets/howe-sound-sunset.jpg')", f"url('assets/{d['img']}')")
    style = style.replace("  </style>", """    .trip-facts { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:1rem; margin:2rem 0; }
    .trip-fact { background:#0f172a; border:1px solid #1e293b; border-radius:.75rem; padding:1.25rem; text-align:center; }
    .trip-fact strong { display:block; color:#22d3ee; font-size:1.5rem; }
    .trip-fact span { color:#94a3b8; font-size:.9rem; }
    .crumbs { color:#64748b; font-size:.9rem; margin-bottom:1rem; }
    .crumbs a { color:#94a3b8; }
    .related-grid { display:grid; gap:1rem; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); margin:1.5rem 0 0; }
    .related-grid a { display:block; background:#0f172a; border:1px solid #1e293b; border-radius:.75rem; padding:1.25rem; color:#94a3b8; text-decoration:none; }
    .related-grid a strong { display:block; color:#22d3ee; margin-bottom:.35rem; }
    .related-grid a:hover { border-color:#22d3ee; }
  </style>""")
    faqs = "\n".join(f'      <div class="faq-item">\n        <h3>{e(q)}</h3>\n        <p>{a}</p>\n      </div>' for q, a in d["faqs"])
    rel = []
    for i in d["related"]:
        href, nm, blurb = link_for(i)
        rel.append(f'        <a href="{href}"><strong>{e(nm)}</strong>{e(blurb)}</a>')
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
{HEAD_ICONS}  <title>{e(d['title'])}</title>
  <meta name="description" content="{e(d['desc'])}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="{url}">
  <meta name="geo.region" content="CA-BC">
  <meta name="geo.position" content="{d['lat']};{d['lon']}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="{url}">
  <meta property="og:title" content="{e(d['title'])}">
  <meta property="og:description" content="{e(d['desc'])}">
  <meta property="og:image" content="{SITE}/assets/{d['img']}">
  <meta property="og:site_name" content="Squamish Water Taxi">
  <meta property="og:locale" content="en_CA">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{e(d['title'])}">
  <meta name="twitter:description" content="{e(d['desc'])}">
  <meta name="twitter:image" content="{SITE}/assets/{d['img']}">

{ld}

  <link rel="stylesheet" href="css/styles.css">
{style}</head>
<body>
{NAV}  <!-- Hero Section -->
  <section class="echo-hero">
    <div class="echo-hero-bg"></div>
    <div class="echo-hero-content">
      <h1 class="echo-hero-title">Water Taxi to {e(short)}</h1>
      <p class="echo-hero-subtitle">{e(d['tagline'])}</p>
      <a href="{planner}" class="btn btn-primary">Get an Instant Estimate</a>
    </div>
  </section>

  <main class="section">
    <div class="container">
      <p class="crumbs"><a href="index.html">Home</a> &rsaquo; <a href="destinations.html">Destinations</a> &rsaquo; {e(short)}</p>

      <div class="trip-facts">
        <div class="trip-fact"><strong>{d['nm']} nm</strong><span>from Squamish</span></div>
        <div class="trip-fact"><strong>~{fmt_min(d['min'])}</strong><span>at cruising speed</span></div>
        <div class="trip-fact"><strong>Up to 6</strong><span>passengers</span></div>
        <div class="trip-fact"><strong>Private</strong><span>your schedule</span></div>
      </div>

      <div class="highlight-box">
        <h3>{e(d['why'][0])}</h3>
        <p>{e(d['why'][1])}</p>
      </div>

      <div class="info-grid">
        <div class="info-card">
          <h3>About {e(short)}</h3>
          <p>{e(d['about'])}</p>
        </div>
        <div class="info-card">
          <h3>Popular Trips</h3>
          <p>{e(d['doing'])}</p>
        </div>
        <div class="info-card">
          <h3>Perfect For</h3>
          <p>{e(d['perfect'])}</p>
        </div>
        <div class="info-card">
          <h3>Planning Your Trip</h3>
          <p>{e(d['plan'])}</p>
        </div>
      </div>

      <div class="echo-crosslink">
        <strong>What will it cost?</strong> Fares depend on your start point, group size and whether it's one way or a round trip. <a href="{planner}">Open the trip planner with {e(short)} already selected</a> for an instant estimate, or call <a href="tel:+16048498898">(604) 849-8898</a> for a firm quote.
      </div>

      <div class="section-header" style="margin-top: 3rem;">
        <h2 class="section-title">{e(short)} Water Taxi FAQ</h2>
      </div>
{faqs}

      <div class="section-header" style="margin-top: 3rem;">
        <h2 class="section-title">Nearby Destinations</h2>
      </div>
      <div class="related-grid">
{chr(10).join(rel)}
      </div>
      <p style="margin-top:1.5rem;color:#94a3b8;">See <a href="destinations.html" style="color:#22d3ee;">every Howe Sound water taxi destination</a>, or browse our <a href="tours.html" style="color:#22d3ee;">guided tours</a>.</p>

      <div style="text-align:center;margin-top:3rem;">
        <a href="{planner}" class="btn btn-primary">Plan a Trip to {e(short)}</a>
      </div>
    </div>
  </main>

{FOOTER}</body>
</html>
"""


def hub():
    url = f"{SITE}/destinations.html"
    rows = []
    items = [(d["id"], d["nm"], d["min"]) for d in DESTS] + [(k, v["nm"], v["min"]) for k, v in EXISTING.items()]
    items.sort(key=lambda x: x[1])
    for i, nm, mn in items:
        href, name, blurb = link_for(i)
        rows.append(f'        <a href="{href}"><strong>{e(name)}</strong>{e(blurb)}<br><span style="color:#64748b;font-size:.85rem;">{nm} nm &middot; ~{fmt_min(mn)} from Squamish</span></a>')
    ld = {"@context": "https://schema.org", "@type": "ItemList", "name": "Howe Sound Water Taxi Destinations",
          "itemListElement": [{"@type": "ListItem", "position": n + 1, "url": f"{SITE}/{link_for(i)[0]}", "name": link_for(i)[1]}
                              for n, (i, _, _) in enumerate(items)]}
    style = STYLE.replace("  </style>", """    .related-grid { display:grid; gap:1rem; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); margin:1.5rem 0 0; }
    .related-grid a { display:block; background:#0f172a; border:1px solid #1e293b; border-radius:.75rem; padding:1.25rem; color:#94a3b8; text-decoration:none; }
    .related-grid a strong { display:block; color:#22d3ee; margin-bottom:.35rem; font-size:1.1rem; }
    .related-grid a:hover { border-color:#22d3ee; }
  </style>""")
    title = "Howe Sound Water Taxi Destinations | Islands, Trailheads & Towns"
    desc = "Every place Squamish Water Taxi goes: Anvil Island, Gambier Island, Gibsons, McNab Creek, Horseshoe Bay, Vancouver, Echo Lake and more, with distances and times from Squamish."
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
{HEAD_ICONS}  <title>{e(title)}</title>
  <meta name="description" content="{e(desc)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="{url}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="{url}">
  <meta property="og:title" content="{e(title)}">
  <meta property="og:description" content="{e(desc)}">
  <meta property="og:image" content="{SITE}/assets/howe-sound-sunset.jpg">
  <meta property="og:site_name" content="Squamish Water Taxi">
  <script type="application/ld+json">
{json.dumps(ld, indent=2)}
  </script>

  <link rel="stylesheet" href="css/styles.css">
{style}</head>
<body>
{NAV}  <section class="echo-hero">
    <div class="echo-hero-bg"></div>
    <div class="echo-hero-content">
      <h1 class="echo-hero-title">Where We Go</h1>
      <p class="echo-hero-subtitle">Private water taxi trips to Howe Sound's islands, trailheads, waterfront towns and roadless shorelines</p>
      <a href="index.html#planner" class="btn btn-primary">Plan Your Trip</a>
    </div>
  </section>

  <main class="section">
    <div class="container">
      <div class="section-header">
        <h2 class="section-title">Howe Sound Water Taxi Destinations</h2>
        <p class="section-subtitle">Distances and cruising times from the Squamish dock. We can also start from Porteau Cove, Britannia Beach or other launches.</p>
      </div>
      <div class="related-grid">
{chr(10).join(rows)}
      </div>
      <div class="echo-crosslink" style="margin-top:2.5rem;">
        <strong>Somewhere not listed?</strong> If it's on Howe Sound and a boat can land there safely, we can probably get you there. Call <a href="tel:+16048498898">(604) 849-8898</a> or try the <a href="index.html#planner">trip planner</a>.
      </div>
    </div>
  </main>

{FOOTER}</body>
</html>
"""


def main():
    for d in DESTS:
        (ROOT / f"{d['slug']}.html").write_text(page(d))
    (ROOT / "destinations.html").write_text(hub())
    sm = (ROOT / "sitemap.xml").read_text()
    add = ["destinations.html"] + [f"{d['slug']}.html" for d in DESTS]
    new = "".join(f"  <url>\n    <loc>{SITE}/{p}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n"
                  for p in add if f"{SITE}/{p}<" not in sm)
    if new:
        sm = sm.replace("</urlset>", new + "</urlset>")
        (ROOT / "sitemap.xml").write_text(sm)
    print(f"built {len(DESTS)} destination pages + hub")


if __name__ == "__main__":
    main()
