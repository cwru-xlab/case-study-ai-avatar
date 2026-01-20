#!/bin/bash

# Test script for Chat Storage API
# Make sure your dev server is running at localhost:3000

echo "🧪 Testing Chat Storage API..."
echo "================================"

# First, login to get authentication cookie
echo "Step 1: Logging in as admin..."
LOGIN_RESPONSE=$(curl -s -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}')

if [[ $LOGIN_RESPONSE == *"success"* ]]; then
  echo "✅ Login successful!"
else
  echo "❌ Login failed: $LOGIN_RESPONSE"
  exit 1
fi

echo ""
echo "Step 2: Testing Save Chat Session..."
SAVE_RESPONSE=$(curl -s -b cookies.txt -X POST http://localhost:3000/api/chat/save \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-session-'$(date +%s)'",
    "avatarId": "test-avatar-api",
    "avatarName": "API Test Avatar", 
    "userId": "test-user-api",
    "userName": "API Test User",
    "startTime": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'",
    "endTime": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'",
    "isKioskMode": false,
    "location": "API Test Suite",
    "messages": [
      {"role": "user", "content": "Hello there!", "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"},
      {"role": "assistant", "content": "Hi! How can I help you today?", "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"}
    ]
  }')

echo "Save Response: $SAVE_RESPONSE"

# Extract session ID from response
SESSION_ID=$(echo $SAVE_RESPONSE | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)
echo "Session ID: $SESSION_ID"

echo ""
echo "Step 3: Testing List Sessions..."
LIST_RESPONSE=$(curl -s -b cookies.txt http://localhost:3000/api/chat/list)
echo "List Response: $LIST_RESPONSE"

echo ""
echo "Step 4: Testing Get Session..."
if [ ! -z "$SESSION_ID" ]; then
  GET_RESPONSE=$(curl -s -b cookies.txt "http://localhost:3000/api/chat/get?sessionId=$SESSION_ID")
  echo "Get Response: $GET_RESPONSE"
else
  echo "⚠️  Skipping get test - no session ID"
fi

echo ""
echo "Step 5: Testing Delete Session..."
if [ ! -z "$SESSION_ID" ]; then
  DELETE_RESPONSE=$(curl -s -b cookies.txt -X DELETE "http://localhost:3000/api/chat/delete?sessionId=$SESSION_ID")
  echo "Delete Response: $DELETE_RESPONSE"
else
  echo "⚠️  Skipping delete test - no session ID"
fi

# Cleanup
rm -f cookies.txt

echo ""
echo "🎉 API testing complete!"
echo "Check your browser at http://localhost:3000/test-pages/test-chat-storage for UI testing" 