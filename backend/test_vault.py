import requests
import sys

BASE_URL = "http://127.0.0.1:8000"
MASTER_PASSWORD = "secure_master_password_123"

def test_vault():
    print("Testing Vault...")
    
    # 1. Check status
    try:
        resp = requests.get(f"{BASE_URL}/api/v1/auth/vault/status")
        status = resp.json()
        print(f"Initial Status: {status}")
    except Exception as e:
        print(f"Failed to connect: {e}")
        sys.exit(1)

    # 2. Initialize if needed
    if not status.get("initialized"):
        print("Initializing Vault...")
        resp = requests.post(f"{BASE_URL}/api/v1/auth/vault/init", json={"master_password": MASTER_PASSWORD})
        if resp.status_code == 200:
            print("Vault Initialized")
        else:
            print(f"Failed to initialize: {resp.text}")
            sys.exit(1)

    # 3. Unlock
    print("Unlocking Vault...")
    resp = requests.post(f"{BASE_URL}/api/v1/auth/vault/unlock", json={"master_password": MASTER_PASSWORD})
    if resp.status_code == 200:
        print("Vault Unlocked")
    else:
        print(f"Failed to unlock: {resp.text}")
        sys.exit(1)

    # 4. Verify Unlocked
    resp = requests.get(f"{BASE_URL}/api/v1/auth/vault/status")
    status = resp.json()
    if status.get("unlocked"):
        print("✅ Vault Verification Passed: Unlocked")
    else:
        print("❌ Vault Verification Failed: Still Locked")
        sys.exit(1)

if __name__ == "__main__":
    test_vault()
