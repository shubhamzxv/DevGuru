#!/usr/bin/env bash
# Makes the bucket com.shubham.devguru (Mumbai, ap-south-1) work as the public
# progress store for DevGuru login. Run from this folder:  bash setup.sh
# Needs AWS CLI v2, logged in as someone who may change the bucket.
# Safe to run again. Windows: run the same aws commands in PowerShell (see ../../docs/login.md).
set -euo pipefail
BUCKET=com.shubham.devguru
REGION=ap-south-1

# 1. Create the bucket if it does not exist yet.
if ! aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION"
fi

# 2. Owner owns every object; ACLs off (anonymous uploads cannot set ACLs).
aws s3api put-bucket-ownership-controls --bucket "$BUCKET" --ownership-controls file://ownership.json

# 3. Allow a public BUCKET POLICY (still block public ACLs).
aws s3api put-public-access-block --bucket "$BUCKET" --public-access-block-configuration file://public-access-block.json

# 4. Anyone may GET and PUT progress/*.json — nothing else (no list, no delete).
aws s3api put-bucket-policy --bucket "$BUCKET" --policy file://bucket-policy.json

# 5. Browsers on the site (and local dev) may call the bucket.
aws s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration file://cors.json

# 6. Keep old versions for 30 days, so an overwritten file can be restored.
aws s3api put-bucket-versioning --bucket "$BUCKET" --versioning-configuration Status=Enabled
aws s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" --lifecycle-configuration file://lifecycle.json

# 7. Encrypt at rest (S3 default, set explicitly).
aws s3api put-bucket-encryption --bucket "$BUCKET" --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

echo "Done. Test: curl -s -o /dev/null -w '%{http_code}\n' https://s3.$REGION.amazonaws.com/$BUCKET/progress/test.json  (403 = no such file, as expected)"
