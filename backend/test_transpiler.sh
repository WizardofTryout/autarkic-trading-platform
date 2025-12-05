#!/bin/bash

# Test script for AI Transpiler endpoint
# This script tests the /api/v1/strategies/transpile endpoint

echo "🧪 Testing AI Transpiler Endpoint"
echo "=================================="
echo ""

# Configuration
BACKEND_URL="http://localhost:8000"
USERNAME="testuser"
PASSWORD="testpass"

echo "1️⃣  Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.access_token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed. Response:"
  echo $LOGIN_RESPONSE | jq
  echo ""
  echo "Please ensure:"
  echo "  - Backend is running (docker-compose up -d backend)"
  echo "  - User exists (username: $USERNAME)"
  exit 1
fi

echo "✅ Login successful"
echo ""

echo "2️⃣  Testing transpile endpoint..."
PINE_SCRIPT='//@version=5
indicator("My RSI", overlay=false)
rsi_val = ta.rsi(close, 14)
plot(rsi_val, color=color.blue, title="RSI")'

TRANSPILE_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/v1/strategies/transpile" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"pine_script\":$(echo "$PINE_SCRIPT" | jq -Rs .)}")

echo "Response:"
echo $TRANSPILE_RESPONSE | jq

# Check if response contains python_code
PYTHON_CODE=$(echo $TRANSPILE_RESPONSE | jq -r '.python_code')
STATUS=$(echo $TRANSPILE_RESPONSE | jq -r '.status')

if [ "$STATUS" == "success" ] && [ "$PYTHON_CODE" != "null" ]; then
  echo ""
  echo "✅ Transpilation successful!"
  echo ""
  echo "Generated Python Code:"
  echo "======================"
  echo "$PYTHON_CODE"
  echo ""
else
  echo ""
  echo "❌ Transpilation failed"
  echo "Response:"
  echo $TRANSPILE_RESPONSE | jq
  echo ""
  
  # Check for common errors
  DETAIL=$(echo $TRANSPILE_RESPONSE | jq -r '.detail')
  if [[ "$DETAIL" == *"API Key"* ]]; then
    echo "⚠️  API Key Error: Please add a Gemini API key in Settings"
  fi
fi

echo ""
echo "Test completed!"
