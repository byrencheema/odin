import json
import time
import urllib.error
import urllib.request

API_URL = "http://localhost:8000/api/air/opensky"


def fetch_snapshot():
    with urllib.request.urlopen(API_URL, timeout=5) as response:
        payload = response.read()
        data = json.loads(payload.decode("utf-8"))
        return data


def log_snapshot(index, snapshot):
    print(
        f"[{index}] status={snapshot['data_status']} simulated={snapshot['is_simulated']} "
        f"count={snapshot['aircraft_count']} ts={snapshot['timestamp']}"
    )


def main(iterations: int = 5, delay: float = 1.0):
    for idx in range(1, iterations + 1):
        try:
            snapshot = fetch_snapshot()
            log_snapshot(idx, snapshot)
        except urllib.error.URLError as exc:
            print(f"[{idx}] URLError: {exc}")
        except Exception as exc:  # noqa: BLE001
            print(f"[{idx}] Unexpected error: {exc}")
        time.sleep(delay)


if __name__ == "__main__":
    main()

