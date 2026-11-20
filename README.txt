BRIANA & AHMED — WEDDING WEBSITE
=================================

Everything the site needs is in this folder: the pages, your photos, the fonts and the map code.
Nothing comes from Wix.


HOW TO OPEN IT
--------------
Double-click "Start Website.command".
A Terminal window opens and the site opens in your browser at http://localhost:8027
Keep that Terminal window open while you use the site. Close it to stop.

(The first time, macOS may ask whether to open it. If it refuses, right-click the file and
choose Open. You can also just double-click index.html to look at the pages, but RSVPs
only save when the site is opened with "Start Website.command".)


MENU
----
Home · Travel & Stay · Wedding Weekend · Gallery · Registry · RSVP ........ FAQ (far right)

index.html          Home: our names, Our Story, Our Engagement photos, Registry, Wedding Party (bottom)
travel.html         Travel & Stay: a Labor Day weekend note at the top, the Inn, Getting Here (by car /
                    by plane), Getting Around (then a link to Things To Do), Where to Stay (one map with
                    Airbnbs and hotels plus filters, the hotel-block note under the map, the Airbnbs on
                    Cayuta Lake highlighted on top, then Airbnbs on the left and hotels on the right,
                    with Ithaca and Watkins Glen side by side; tap a town to open its swipe row)
weekend.html        Wedding Weekend: weekend at a glance, wedding-day schedule, weekend events,
                    Things To Do (map, filters, and six categories, three to a row: Watkins Glen &
                    the water, Waterfalls & outdoors, Restaurants, Wineries & breweries, Shopping &
                    markets, Museums & rainy days; each shows three places, "Show more" opens the
                    rest, and "More" on a card opens its description and links)
gallery.html        All 37 engagement photos (tap to see full size)
registry.html       Registry (links to Zola)
rsvp.html           RSVP form (deadline June 1, 2027)
thank-you.html      Shown after an RSVP, with a button to send another response
faq.html            Common questions
(details.html, events.html and things-to-do.html are old addresses that now forward to the new pages.)


WHERE RSVPs GO
--------------
Everything private lives in the "private" folder. The website never shows it.

private/The Wedding.xlsx       Your planner, reorganized. Each RSVP is added to its
                               "RSVP Responses" tab, and the Guest List and Summary tabs count them.
private/RSVP responses.xlsx    Just the RSVPs, one row each.
private/responses.jsonl        A plain-text backup of every RSVP. Both Excel files are rebuilt
                               from it after every RSVP and each time the website starts.

Columns: Submitted, First Name, Last Name, Email, Attending, Dietary Restrictions,
Other Dietary Needs, Special Requests.

Tip: close The Wedding.xlsx in Excel while guests are sending RSVPs. If it's open, the RSVP is
still saved, and the planner catches up on the next RSVP or the next time you start the website.
Don't type in the "RSVP Responses" tab itself: it's rebuilt each time. Copy answers into the
Guest List tab instead (RSVP Status, # Attending, Dietary Needs).

Later this can be connected to Google Sheets instead, by changing one line at the top of js/rsvp.js.


EDITING THE MAPS
----------------
js/places.js holds everything on both maps: the Things To Do places (name, town, note, drive
time, Google link, card photo), the Airbnbs (name, size, link, area, drawing) and the hotels
(name, description, phone, website, map spot). Edit the text there. Airbnb listings change, so
check the links now and then. Restaurants are listed most-reviewed first.
Tapping a card shows it on the map; tapping a pin lights up its card. Things To Do columns show
three cards and scroll for more (on phones: a "Show more" button). The stay rows swipe on phones
and have arrow buttons on computers.

The card photos for Things To Do are in images/places/ (one per place, same name as in
places.js).


STILL TO FILL IN
----------------
- Wedding party: names and photos (2 bridesmaids, 2 groomsmen, flower girl, ring bearer) — index.html.
- Weekend events: times and places for the day tour, dinner and brunch — weekend.html.
- Hotel block and transportation block: details — travel.html.


PHOTOS
------
images/photo-sources.txt lists where every photo came from.
images/venue/ holds the Fontainebleau Inn photos (from the Inn's website, with their OK).
images/things/, images/places/ and the event photos are free photos from Unsplash (credited on
the page). Some Things To Do cards use a photo that sets the mood rather than the exact spot.
To swap a photo, replace the file with another photo saved under the same name.


BEFORE PUTTING THE SITE ONLINE
------------------------------
Do NOT upload the "private" folder: it holds your guest list, addresses, budget and
financial tabs, and your guests' answers. Also leave out serve.py and "Start Website.command".
Online, RSVPs will need the Google Sheets connection instead.


CREDITS
-------
Engagement photos: Julia Karpyshyn Photography. Venue photos: courtesy of the Fontainebleau Inn.
Activity and place photos: Unsplash (see images/photo-sources.txt for every photographer).
Line drawings on the Airbnb and hotel cards: drawn for this site.
Fonts: Great Vibes, Bodoni Moda and Instrument Sans (SIL Open Font License, see fonts/).
Map: Leaflet (BSD license, see vendor/leaflet/LICENSE); map data © OpenStreetMap contributors.
