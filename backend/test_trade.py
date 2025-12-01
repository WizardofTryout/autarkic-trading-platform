import requests
import sys

BASE_URL = "http://127.0.0.1:8000"

def test_trade():
    print("Testing Trade Execution...")
    
    payload = {
        "symbol": "BTC/USDT",
        "side": "buy",
        "amount": 100.0
    }
    
    try:
        resp = requests.post(f"{BASE_URL}/api/v1/trade/execute", json=payload)
        if resp.status_code == 200:
            data = resp.json()
            print(f"Trade Response: {data}")
            if data.get("status") == "filled":
                print("✅ Trade Verification Passed")
            else:
                print("❌ Trade Verification Failed: Status not filled")
                sys.exit(1)
        else:
            print(f"Failed to execute trade: {resp.text}")
            sys.exit(1)
    except Exception as e:
        print(f"Failed to connect: {e}")
        sys.exit(1)

if __name__ == "__main__":
    test_trade()
