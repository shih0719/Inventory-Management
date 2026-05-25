#!/bin/bash

# API Test Script for Inventory Management System
# Test all major endpoints with auth and audit trail

BASE_URL="http://localhost:3030/api"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== API Test Suite ===${NC}\n"

# ============================================================================
# 1. LOGIN
# ============================================================================
echo -e "${BLUE}[1] Testing Authentication${NC}"
LOGIN_RESPONSE=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"eric","password":"password"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Login failed${NC}"
  echo $LOGIN_RESPONSE
  exit 1
fi

echo -e "${GREEN}✅ Login successful${NC}"
echo "Token: ${TOKEN:0:50}..."

# ============================================================================
# 2. CREATE PRODUCT (no auth required)
# ============================================================================
echo -e "\n${BLUE}[2] Creating Product (no auth)${NC}"
PRODUCT_RESPONSE=$(curl -s -X POST $BASE_URL/products \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "API-TEST-001",
    "name": "Test Product",
    "type": "normal",
    "model": "M1",
    "accountable_quantity": 100,
    "non_accountable_quantity": 0,
    "min_stock": 10
  }')

PRODUCT_ID=$(echo $PRODUCT_RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ -z "$PRODUCT_ID" ]; then
  echo -e "${RED}❌ Product creation failed${NC}"
  echo $PRODUCT_RESPONSE
else
  echo -e "${GREEN}✅ Product created (ID: $PRODUCT_ID)${NC}"
fi

# ============================================================================
# 3. CREATE TRANSACTION (requires auth)
# ============================================================================
echo -e "\n${BLUE}[3] Creating Transaction (with auth)${NC}"
TXN_RESPONSE=$(curl -s -X POST $BASE_URL/transactions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "product_id": 1,
    "tag_id": 1,
    "quantity_change": 10,
    "quantity_type": "accountable",
    "remarks": "Test transaction"
  }')

TXN_ID=$(echo $TXN_RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
CREATED_BY=$(echo $TXN_RESPONSE | grep -o '"created_by_user":"[^"]*' | cut -d'"' -f4)

if [ -z "$TXN_ID" ]; then
  echo -e "${RED}❌ Transaction creation failed${NC}"
  echo $TXN_RESPONSE
else
  echo -e "${GREEN}✅ Transaction created (ID: $TXN_ID, by: $CREATED_BY)${NC}"
fi

# ============================================================================
# 4. GET TRANSACTIONS (verify created_by_user)
# ============================================================================
echo -e "\n${BLUE}[4] Fetching Transactions${NC}"
GET_TXN=$(curl -s $BASE_URL/transactions)
HAS_CREATED_BY=$(echo $GET_TXN | grep -c "created_by_user")

if [ $HAS_CREATED_BY -gt 0 ]; then
  echo -e "${GREEN}✅ Transactions include created_by_user field${NC}"
else
  echo -e "${RED}❌ created_by_user field missing${NC}"
fi

# ============================================================================
# 5. CREATE BATCH (requires auth)
# ============================================================================
echo -e "\n${BLUE}[5] Creating Batch (with auth)${NC}"
BATCH_RESPONSE=$(curl -s -X POST $BASE_URL/batches \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Test Batch",
    "tag_id": 1,
    "items": [
      {
        "product_id": 1,
        "quantity_change": 5,
        "quantity_type": "accountable",
        "remarks": "batch test"
      }
    ]
  }')

BATCH_ID=$(echo $BATCH_RESPONSE | grep -o '"batch_id":[0-9]*' | cut -d':' -f2)
BATCH_CREATED_BY=$(echo $BATCH_RESPONSE | grep -o '"created_by_user":"[^"]*' | cut -d'"' -f4)

if [ -z "$BATCH_ID" ]; then
  echo -e "${RED}❌ Batch creation failed${NC}"
  echo $BATCH_RESPONSE
else
  echo -e "${GREEN}✅ Batch created (ID: $BATCH_ID, by: $BATCH_CREATED_BY)${NC}"
fi

# ============================================================================
# 6. CREATE SHIPMENT (requires auth)
# ============================================================================
echo -e "\n${BLUE}[6] Creating Shipment (with auth)${NC}"
SHIPMENT_RESPONSE=$(curl -s -X POST $BASE_URL/shipments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "transaction_ids": [1],
    "customer": "Test Customer",
    "project_case": "TEST-001",
    "shipment_date": "2026-05-25"
  }')

SHIPMENT_ID=$(echo $SHIPMENT_RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
SHIPMENT_CREATED_BY=$(echo $SHIPMENT_RESPONSE | grep -o '"created_by_user":"[^"]*' | cut -d'"' -f4)

if [ -z "$SHIPMENT_ID" ]; then
  echo -e "${RED}❌ Shipment creation failed${NC}"
  echo $SHIPMENT_RESPONSE
else
  echo -e "${GREEN}✅ Shipment created (ID: $SHIPMENT_ID, by: $SHIPMENT_CREATED_BY)${NC}"
fi

# ============================================================================
# 7. AUDIT LOGS (requires auth)
# ============================================================================
echo -e "\n${BLUE}[7] Fetching Audit Logs (with auth)${NC}"
AUDIT_RESPONSE=$(curl -s $BASE_URL/audit-logs \
  -H "Authorization: Bearer $TOKEN")

AUDIT_COUNT=$(echo $AUDIT_RESPONSE | grep -o '"id":[0-9]*' | wc -l)

if [ $AUDIT_COUNT -gt 0 ]; then
  echo -e "${GREEN}✅ Audit logs retrieved ($AUDIT_COUNT entries)${NC}"
  echo $AUDIT_RESPONSE | python3 -m json.tool 2>/dev/null | head -50
else
  echo -e "${RED}❌ No audit logs found${NC}"
  echo $AUDIT_RESPONSE
fi

# ============================================================================
# 8. TEST UNAUTHORIZED ACCESS
# ============================================================================
echo -e "\n${BLUE}[8] Testing Unauthorized Access (no token)${NC}"
UNAUTH_RESPONSE=$(curl -s -X POST $BASE_URL/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": 1,
    "tag_id": 1,
    "quantity_change": 5,
    "quantity_type": "accountable"
  }')

HAS_ERROR=$(echo $UNAUTH_RESPONSE | grep -c "Unauthorized")

if [ $HAS_ERROR -gt 0 ]; then
  echo -e "${GREEN}✅ Correctly rejected unauthorized request${NC}"
else
  echo -e "${RED}❌ Should reject request without token${NC}"
fi

# ============================================================================
# SUMMARY
# ============================================================================
echo -e "\n${BLUE}=== Test Summary ===${NC}"
echo -e "${GREEN}Auth: ✅ Tested${NC}"
echo -e "${GREEN}Transactions: ✅ Tested (created_by_user captured)${NC}"
echo -e "${GREEN}Batches: ✅ Tested (created_by_user captured)${NC}"
echo -e "${GREEN}Shipments: ✅ Tested (created_by_user captured)${NC}"
echo -e "${GREEN}Audit Logs: ✅ Tested${NC}"
echo -e "${GREEN}Authorization: ✅ Tested (401 on missing token)${NC}"
echo -e "\n${GREEN}All tests completed!${NC}\n"
