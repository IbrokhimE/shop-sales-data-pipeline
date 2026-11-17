
import json
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

# ==========================================
# HISTORICAL WEATHER DATA PIPELINE
# Recent + Archived Weather
# ==========================================

ROOT = Path(__file__).resolve().parent.parent

SALES_FILE = ROOT / "docs" / "sales_data.json"
OUTPUT_FILE = ROOT / "docs" / "historical_weather.json"

ARCHIVE_API = (
    "https://archive-api.open-meteo.com/v1/archive"
)

RECENT_API = (
    "https://historical-forecast-api.open-meteo.com/v1/forecast"
)

LOCATIONS = {
    "Manchester": (53.4808, -2.2426),
    "Birmingham": (52.4862, -1.8904),
    "London": (51.5074, -0.1278)
}

DAILY_FIELDS = [
    "temperature_2m_mean",
    "temperature_2m_max",
    "temperature_2m_min",
    "precipitation_sum",
    "rain_sum",
    "weather_code"
]


def load_sales_dates():
    with SALES_FILE.open("r", encoding="utf-8") as file:
        sales = json.load(file)

    if not isinstance(sales, list):
        raise ValueError("Sales JSON must be a list")

    dates = set()

    for row in sales:
        value = row.get("TransactionDate")

        if not value:
            continue

        try:
            dates.add(date.fromisoformat(value))
        except (ValueError, TypeError):
            print(f"Skipping invalid date: {value}")

    return sorted(dates)


def request_weather(api_url, city, start_date, end_date):
    latitude, longitude = LOCATIONS[city]

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "daily": ",".join(DAILY_FIELDS),
        "timezone": "Europe/London"
    }

    url = api_url + "?" + urlencode(params)

    request = Request(
        url,
        headers={"User-Agent": "ShopSalesAnalytics/1.0"}
    )

    with urlopen(request, timeout=45) as response:
        return json.load(response)


def process_weather(city, response, wanted_dates, source):
    daily = response.get("daily", {})

    dates = daily.get("time", [])

    if not dates:
        raise ValueError(
            f"No weather dates returned for {city}"
        )

    records = []

    for index, day in enumerate(dates):
        if day not in wanted_dates:
            continue

        record = {
            "city": city,
            "date": day,
            "data_source": source
        }

        for field in DAILY_FIELDS:
            values = daily.get(field, [])

            record[field] = (
                values[index]
                if index < len(values)
                else None
            )

        records.append(record)

    return records


def main():
    if not SALES_FILE.exists():
        print("Sales data file not found.")
        sys.exit(1)

    sales_dates = load_sales_dates()

    if not sales_dates:
        print("No valid sales dates found.")
        sys.exit(1)

    today = datetime.now(timezone.utc).date()

    # Archive data can lag behind recent dates.
    archive_cutoff = today - timedelta(days=5)

    # Only completed days are included.
    eligible_dates = [
        day for day in sales_dates
        if day < today
    ]

    if not eligible_dates:
        print(
            "No completed sales dates yet. "
            "Preserving existing weather data."
        )
        return

    archived_dates = [
        day for day in eligible_dates
        if day <= archive_cutoff
    ]

    recent_dates = [
        day for day in eligible_dates
        if day > archive_cutoff
    ]

    all_records = []

    for city in LOCATIONS:
        groups = [
            (
                "archive",
                ARCHIVE_API,
                archived_dates
            ),
            (
                "historical_forecast",
                RECENT_API,
                recent_dates
            )
        ]

        for source, api_url, dates in groups:
            if not dates:
                continue

            print(
                f"Fetching {source} weather "
                f"for {city}..."
            )

            try:
                response = request_weather(
                    api_url,
                    city,
                    min(dates),
                    max(dates)
                )

                records = process_weather(
                    city,
                    response,
                    {day.isoformat() for day in dates},
                    source
                )

                if len(records) != len(dates):
                    raise ValueError(
                        f"Incomplete weather dates for {city}"
                    )

                all_records.extend(records)

                print(
                    f"{city}: {len(records)} "
                    f"{source} records retrieved"
                )

            except (
                HTTPError,
                URLError,
                TimeoutError,
                ValueError
            ) as error:
                print(
                    f"Failed retrieving {city}: {error}"
                )
                print(
                    "Existing weather JSON preserved."
                )
                sys.exit(1)

    output = {
        "source": "Open-Meteo",
        "last_updated": datetime.now(
            timezone.utc
        ).isoformat(),
        "weather_records": sorted(
            all_records,
            key=lambda row: (
                row["date"],
                row["city"]
            )
        )
    }

    OUTPUT_FILE.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    temp_file = OUTPUT_FILE.with_suffix(
        ".json.tmp"
    )

    with temp_file.open(
        "w", encoding="utf-8"
    ) as file:
        json.dump(
            output,
            file,
            indent=2,
            ensure_ascii=False
        )

    temp_file.replace(OUTPUT_FILE)

    print(
        f"Successfully saved {len(all_records)} "
        "historical weather records."
    )


if __name__ == "__main__":
    main()
