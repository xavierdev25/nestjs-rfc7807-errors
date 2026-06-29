#!/bin/bash
# ==============================================================================
# Floci (AWS Local Emulator) Initialization Script
#
# Creates the required AWS resources in the local Floci emulator:
# - SQS queues (with dead-letter queues)
# - S3 buckets
#
# This script runs as an init container that waits for Floci to be healthy
# before provisioning resources.
# ==============================================================================

set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────────
FLOCI_ENDPOINT="${AWS_ENDPOINT_URL:-http://floci:4566}"
REGION="${AWS_DEFAULT_REGION:-us-east-1}"

export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-test}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-test}"
export AWS_DEFAULT_REGION="$REGION"

echo "🔧 [init-floci] Provisioning AWS resources on Floci at $FLOCI_ENDPOINT..."

# ─── Wait for Floci to be ready ──────────────────────────────────────────────
echo "⏳ [init-floci] Waiting for Floci to be healthy..."
MAX_RETRIES=30
RETRY_COUNT=0

until curl -sf "${FLOCI_ENDPOINT}/_floci/health" > /dev/null 2>&1 || \
      curl -sf "${FLOCI_ENDPOINT}/health" > /dev/null 2>&1 || \
      aws --endpoint-url="$FLOCI_ENDPOINT" sts get-caller-identity > /dev/null 2>&1; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ "$RETRY_COUNT" -ge "$MAX_RETRIES" ]; then
        echo "❌ [init-floci] Floci not ready after ${MAX_RETRIES} attempts. Exiting."
        exit 1
    fi
    echo "   Attempt $RETRY_COUNT/$MAX_RETRIES - waiting 2s..."
    sleep 2
done

echo "✅ [init-floci] Floci is healthy!"

# ==============================================================================
# 1. SQS Queues
# ==============================================================================

# Dead-Letter Queue for domain events
aws --endpoint-url="$FLOCI_ENDPOINT" sqs create-queue \
    --queue-name "domain-events-dlq" \
    --attributes '{
        "MessageRetentionPeriod": "1209600",
        "VisibilityTimeout": "30"
    }' \
    --region "$REGION" 2>/dev/null || true

DLQ_ARN=$(aws --endpoint-url="$FLOCI_ENDPOINT" sqs get-queue-attributes \
    --queue-url "${FLOCI_ENDPOINT}/000000000000/domain-events-dlq" \
    --attribute-names QueueArn \
    --query 'Attributes.QueueArn' \
    --output text \
    --region "$REGION" 2>/dev/null || echo "arn:aws:sqs:${REGION}:000000000000:domain-events-dlq")

echo "✅ [init-floci] Created SQS: domain-events-dlq"

# Domain Events Queue (with DLQ redrive policy)
aws --endpoint-url="$FLOCI_ENDPOINT" sqs create-queue \
    --queue-name "domain-events" \
    --attributes "{
        \"MessageRetentionPeriod\": \"345600\",
        \"VisibilityTimeout\": \"60\",
        \"RedrivePolicy\": \"{\\\"deadLetterTargetArn\\\":\\\"${DLQ_ARN}\\\",\\\"maxReceiveCount\\\":\\\"3\\\"}\"
    }" \
    --region "$REGION" 2>/dev/null || true

echo "✅ [init-floci] Created SQS: domain-events (with DLQ redrive, maxReceiveCount=3)"

# Dead-Letter Queue for transactions
aws --endpoint-url="$FLOCI_ENDPOINT" sqs create-queue \
    --queue-name "transactions-dlq" \
    --attributes '{
        "MessageRetentionPeriod": "1209600",
        "VisibilityTimeout": "30"
    }' \
    --region "$REGION" 2>/dev/null || true

TX_DLQ_ARN=$(aws --endpoint-url="$FLOCI_ENDPOINT" sqs get-queue-attributes \
    --queue-url "${FLOCI_ENDPOINT}/000000000000/transactions-dlq" \
    --attribute-names QueueArn \
    --query 'Attributes.QueueArn' \
    --output text \
    --region "$REGION" 2>/dev/null || echo "arn:aws:sqs:${REGION}:000000000000:transactions-dlq")

echo "✅ [init-floci] Created SQS: transactions-dlq"

# Transactions Queue (with DLQ redrive policy)
aws --endpoint-url="$FLOCI_ENDPOINT" sqs create-queue \
    --queue-name "transactions" \
    --attributes "{
        \"MessageRetentionPeriod\": \"345600\",
        \"VisibilityTimeout\": \"120\",
        \"RedrivePolicy\": \"{\\\"deadLetterTargetArn\\\":\\\"${TX_DLQ_ARN}\\\",\\\"maxReceiveCount\\\":\\\"5\\\"}\"
    }" \
    --region "$REGION" 2>/dev/null || true

echo "✅ [init-floci] Created SQS: transactions (with DLQ redrive, maxReceiveCount=5)"

# ==============================================================================
# 2. S3 Buckets
# ==============================================================================

aws --endpoint-url="$FLOCI_ENDPOINT" s3 mb "s3://enterprise-documents" \
    --region "$REGION" 2>/dev/null || true

echo "✅ [init-floci] Created S3: enterprise-documents"

aws --endpoint-url="$FLOCI_ENDPOINT" s3 mb "s3://enterprise-audit-logs" \
    --region "$REGION" 2>/dev/null || true

echo "✅ [init-floci] Created S3: enterprise-audit-logs"

# ==============================================================================
# 3. Verification
# ==============================================================================

echo ""
echo "📋 [init-floci] Resource Summary:"
echo "─────────────────────────────────────────"

echo "   SQS Queues:"
aws --endpoint-url="$FLOCI_ENDPOINT" sqs list-queues \
    --region "$REGION" \
    --query 'QueueUrls[]' \
    --output table 2>/dev/null || echo "   (list-queues unavailable)"

echo ""
echo "   S3 Buckets:"
aws --endpoint-url="$FLOCI_ENDPOINT" s3 ls \
    --region "$REGION" 2>/dev/null || echo "   (s3 ls unavailable)"

echo ""
echo "🎉 [init-floci] Floci resource provisioning complete!"
