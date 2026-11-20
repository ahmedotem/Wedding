#!/bin/bash
# Double-click this file to open the wedding website on this Mac.
# RSVPs sent from the RSVP page are saved in the "private" folder:
#   private/The Wedding.xlsx (RSVP Responses tab) and private/RSVP responses.xlsx
cd "$(dirname "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then
  python3 serve.py
else
  echo "Python 3 is needed to run the website. Install it from https://www.python.org/downloads/ and try again."
  read -r -p "Press Return to close."
fi
