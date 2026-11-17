
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

# ==========================================
# TICKETMASTER LOCAL EVENTS PIPELINE
# ==========================================

API_URL = (
    "https://app.ticketmaster.com"
    "/discovery/v2/events.json"
)

API_KEY = os.environ.get("TICKETMASTER_API_KEY")

CITIES = [
    "Manchester",
    "Birmingham",
    "London"
]

OUTPUT_FILE = (
    Path(__file__).resolve().parent.parent
    / "docs"
    / "local_events.json"
)

EVENTS_PER_CITY = 20
DAYS_AHEAD = 30


def utc_now():
    return datetime.now(timezone.utc)


def load_existing_data():
    if OUTPUT_FILE.exists():
        with OUTPUT_FILE.open(
            "r", encoding="utf-8"
        ) as file:
            return json.load(file)

    return None


def fetch_events(city):
    now = utc_now()
    end = now + timedelta(days=DAYS_AHEAD)

    params = {
        "apikey": API_KEY,
        "city": city,
        "countryCode": "GB",
        "startDateTime": now.strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        ),
        "endDateTime": end.strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        ),
        "sort": "date,asc",
        "size": EVENTS_PER_CITY
    }

    url = API_URL + "?" + urlencode(params)

    request = Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "ShopSalesAnalytics/1.0"
        }
    )

    with urlopen(request, timeout=30) as response:
        data = json.load(response)

    raw_events = (
        data.get("_embedded", {}).get("events", [])
    )

    events = []

    for event in raw_events:
        dates = event.get("dates", {})
        start = dates.get("start", {})

        local_date = start.get("localDate")
        local_time = start.get("localTime")

        venues = (
            event.get("_embedded", {}).get("venues", [])
        )

        venue = venues[0] if venues else {}

        classifications = event.get(
            "classifications", []
        )

        classification = (
            classifications[0]
            if classifications else {}
        )

        segment = classification.get("segment", {})

        event_data = {
            "id": event.get("id"),
            "name": event.get("name"),
            "date": local_date,
            "time": local_time,
            "venue": venue.get("name"),
            "category": segment.get(
                "name", "Other"
            ),
            "url": event.get("url")
        }

        if event_data["name"] and local_date:
            events.append(event_data)

    events.sort(
        key=lambda event: (
            event["date"] or "",
            event["time"] or ""
        )
    )

    return events


def main():
    if not API_KEY:
        print(
            "TICKETMASTER_API_KEY is not configured."
        )
        print(
            "Waiting for Ticketmaster approval."
        )
        print(
            "Existing local_events.json will remain unchanged."
        )
        return

    existing = load_existing_data()

    city_results = []
    failed_cities = []

    for city in CITIES:
        print(f"Fetching events for {city}...")

        try:
            events = fetch_events(city)

            city_results.append({
                "city": city,
                "events": events
            })

            print(
                f"Retrieved {len(events)} events "
                f"for {city}"
            )

        except (HTTPError, URLError, TimeoutError,
                ValueError, KeyError) as error:
            print(
                f"Failed to fetch {city}: "
                f"{type(error).__name__}"
            )

            failed_cities.append(city)

    if failed_cities:
        print(
            "Some city requests failed. "
            "Preserving the existing JSON file."
        )
        sys.exit(1)

    output = {
        "source": "Ticketmaster Discovery API",
        "status": "connected",
        "last_updated": utc_now().isoformat(),
        "cities": city_results
    }

    OUTPUT_FILE.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    temporary_file = OUTPUT_FILE.with_suffix(
        ".json.tmp"
    )

    with temporary_file.open(
        "w", encoding="utf-8"
    ) as file:
        json.dump(
            output,
            file,
            indent=2,
            ensure_ascii=False
        )

    temporary_file.replace(OUTPUT_FILE)

    print("Local events JSON updated successfully.")
    print(f"Output: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
