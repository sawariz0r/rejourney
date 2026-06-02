#!/usr/bin/env bash
# Apply CORS policy to the OVH Object Storage bucket used for replay recordings.
# This allows rejourney.co to fetch signed replay URLs directly from the browser.
#
# Requires AWS CLI configured with OVH S3-compatible credentials.
# Run once; re-run any time the CORS policy needs to be updated.
#
# Usage:
#   AWS_ACCESS_KEY_ID=<ovh-key> AWS_SECRET_ACCESS_KEY=<ovh-secret> bash apply-storage-endpoint-cors.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORS_FILE="${SCRIPT_DIR}/ovh-replay-cors.json"
BUCKET="rejourney-recordings-2"
ENDPOINT="https://s3.us-east-va.io.cloud.ovh.us"
REGION="us-east-va"

echo "Applying CORS policy to s3://${BUCKET} via ${ENDPOINT} ..."

aws --endpoint-url "${ENDPOINT}" \
  s3api put-bucket-cors \
  --bucket "${BUCKET}" \
  --cors-configuration "file://${CORS_FILE}" \
  --region "${REGION}"

echo "Done. Verifying ..."

aws --endpoint-url "${ENDPOINT}" \
  s3api get-bucket-cors \
  --bucket "${BUCKET}" \
  --region "${REGION}"

echo ""
echo "To test a signed URL, run:"
echo "  curl -I -H 'Origin: https://rejourney.co' '<SIGNED_OVH_URL>'"
echo "Look for: Access-Control-Allow-Origin: https://rejourney.co"
