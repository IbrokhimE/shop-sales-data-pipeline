
import json
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen
from urllib.error import HTTPError, URLError

# ==========================================
# HISTORICAL WEATHER DATA PIPELINE
# ==========================================

ROOT = Path(__file__).resolve().parent.parent

SALES_FILE = ROOT / "docs" / "sales_data.json"

OUTPUT_FILE = (
    ROOT / "docs" / "historical_weather.json"
)

API_URL = (
    "https://archive-api.open-meteo.com/v1/archive"
)

LOCATIONS = {
    "Manchester": {
        "latitude": 53.4808,
        "longitude": -2.2426
    },
    "Birmingham": {
        "latitude": 52.4862,
        "longitude": -1.8904
    },
    "London": {
        "latitude": 51.5074,
        "longitude": -0.1278
    }
}


def load_sales_dates():
    """Read transaction dates from sales JSON."""

    with SALES_FILE.open(
        "r", encoding="utf-8"
    ) as file:
        sales = json.load(file)

    if not isinstance(sales, list):
        raise ValueError(
            "sales_data.json must contain a list"
        )

    dates = set()

    for row in sales:
        value = row.get("TransactionDate")

        if not value:
            continue

        try:
            parsed = date.fromisoformat(value)
            dates.add(parsed)
        except (ValueError, TypeError):
            print(f"Skipping invalid date: {value}")

    return sorted(dates)


def fetch_weather(city, start_date, end_date):
    """Retrieve historical daily weather."""

    location = LOCATIONS[city]

    params = {
        "latitude": location["latitude"],
        "longitude": location["longitude"],
        "start_date": start_date,
        "end_date": end_date,
        "daily": ",".join([
            "temperature_2m_mean",
            "temperature_2m_max",
            "temperature_2m_min",
            "precipitation_sum",
            "rain_sum",
            "weather_code"
        ]),
        "timezone": "Europe/London"
    }

    url = API_URL + "?" + urlencode(params)

    print(f"Fetching weather for {city}...")

    with urlopen(url, timeout=45) as response:
        return json.load(response)


def process_weather(city, response, sales_dates):
    """Keep weather matching sales dates."""

    daily = response.get("daily", {})

    dates = daily.get("time", [])

    fields = [
        "temperature_2m_mean",
        "temperature_2m_max",
        "temperature_2m_min",
        "precipitation_sum",
        "rain_sum",
        "weather_code"
    ]

    records = []

    for index, day in enumerate(dates):
        if day not in sales_dates:
            continue

        record = {
            "city": city,
            "date": day
        }

        for field in fields:
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
        print("Sales JSON file not found.")
        sys.exit(1)

    sales_dates = load_sales_dates()

    if not sales_dates:
        print("No valid sales dates available.")
        sys.exit(1)

    today = datetime.now(
        timezone.utc
    ).date()

    # Archive data may arrive a few days late.
    # Exclude the most recent 5 days for now.
    from datetime import timedelta

    cutoff = today - timedelta(days=5)

    available_dates = [
        day for day in sales_dates
        if day <= cutoff
    ]

    if not available_dates:
        print(
            "No sales dates old enough for "
            "historical weather retrieval."
        )

        # Preserve existing output if present.
        return

    start_date = available_dates[0].isoformat()
    end_date = available_dates[-1].isoformat()

    matching_dates = {
        day.isoformat()
        for day in available_dates
    }

    all_records = []

    for city in LOCATIONS:
        try:
            response = fetch_weather(
                city,
                start_date,
                end_date
            )

            records = process_weather(
                city,
                response,
                matching_dates
            )

            all_records.extend(records)

            print(
                f"{city}: {len(records)} "
                "matching weather records"
            )

        except (
            HTTPError,
            URLError,
            TimeoutError,
            ValueError
        ) as error:
            print(
                f"Weather retrieval failed "
                f"for {city}: {error}"
            )

            # Never publish incomplete output.
            sys.exit(1)

    output = {
        "source": "Open-Meteo Historical Weather API",
        "last_updated": datetime.now(
            timezone.utc
        ).isoformat(),
        "weather_records": all_records
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

    print(
        f"Saved {len(all_records)} "
        "historical weather records."
    )


if __name__ == "__main__":
    main()
