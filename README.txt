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
choose Open. You can also just double-click index.html to look at the pages.)

The live site is at https://ahmedotem.github.io/Wedding/ (GitHub Pages).


MENU
----
Home · Travel & Stay · Wedding Weekend · Gallery · Registry · RSVP ........ FAQ · Contact (far right)

index.html          Home: our names, Our Story, timeline, Our Engagement photos, Registry, Wedding Party
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
gallery.html        All 74 engagement photos (tap to see full size)
registry.html       Registry (links to Zola)
rsvp.html           RSVP form (deadline June 1, 2027): guests start with their name, which is
                    looked up on the guest list; guests with a plus-one are asked about a guest.
                    Names not on the list can still RSVP (flagged in the sheet and the email)
thank-you.html      Shown after an RSVP, with a button to send another response and, for guests
                    coming without a guest, "Hoping to bring a +1? Please contact us"
faq.html            Common questions
contact.html        Contact Us: Briana and Ahmed's phone, email (and WhatsApp for Ahmed)
(details.html, events.html and things-to-do.html are old addresses that now forward to the new pages.)


WHERE RSVPs GO
--------------
RSVPs go to our Google Sheet through a Google Apps Script web app (its address is at the top of
js/rsvp.js). Each RSVP adds a row to the sheet's first tab and is emailed to Ahmed.
The guest list for the name lookup is the sheet's "Guests" tab (First name, Last name, Plus-one,
Other first names, Other last names, Notes). It lives only in Google Sheets, never on this site.

The private planner, budget and old RSVP files are in the folder next to this one,
"Wedding Website - private (do not upload)".


EDITING THE MAPS
----------------
js/places.js holds everything on both maps: the Things To Do places (name, town, note, drive
time, Google link, card photo), the Airbnbs (name, size, link, area, drawing) and the hotels
(name, description, phone, website, map spot). Edit the text there. Airbnb listings change, so
check the links now and then. Restaurants are listed most-reviewed first.
Tapping a card shows it on the map; tapping a pin lights up its card. Things To Do columns show
three cards; "Show more" lets the rest scroll inside the column (on phones it opens the list). The stay rows swipe on phones
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
images/things/, images/places/ and the event photos are free photos from Unsplash (each
photographer is listed in photo-sources.txt). Some Things To Do cards use a photo that sets the
mood rather than the exact spot.
To swap a photo, replace the file with another photo saved under the same name.


PUTTING CHANGES ONLINE
----------------------
This folder is the GitHub repository (through the GitHub Desktop app). The hidden .gitignore
file keeps serve.py, "Start Website.command" and Mac .DS_Store files off GitHub.
After any change: open GitHub Desktop, type a short summary, click "Commit to main", then
"Push origin". The live site updates about a minute later.
Never put the private folder, or any guest list, inside this folder.


CREDITS
-------
Engagement photos: Julia Karpyshyn Photography. Venue photos: courtesy of the Fontainebleau Inn.
Activity and place photos: Unsplash (see images/photo-sources.txt for every photographer).
Line drawings on the Airbnb and hotel cards: drawn for this site.
Fonts: Great Vibes, Bodoni Moda and Instrument Sans (SIL Open Font License, see fonts/).
Map: Leaflet (BSD license, see vendor/leaflet/LICENSE); map data © OpenStreetMap contributors.
