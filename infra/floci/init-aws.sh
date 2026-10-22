#!/bin/sh
set -eu

BUCKET="${S3_BUCKET:-ninar-audio}"
WEB_ORIGIN="${NINAR_WEB_ORIGIN:-http://localhost:3000}"

awslocal s3api create-bucket --bucket "$BUCKET" >/dev/null 2>&1 || true
printf '{"CORSRules":[{"AllowedMethods":["PUT"],"AllowedOrigins":["%s"],"AllowedHeaders":["*"],"ExposeHeaders":["ETag"]}]}' "$WEB_ORIGIN" >/tmp/ninar-cors.json
awslocal s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration file:///tmp/ninar-cors.json >/dev/null

awslocal sqs create-queue --queue-name analyses-dlq >/dev/null
DLQ_URL="$(awslocal sqs get-queue-url --queue-name analyses-dlq --query QueueUrl --output text)"
DLQ_ARN="$(awslocal sqs get-queue-attributes --queue-url "$DLQ_URL" --attribute-names QueueArn --query Attributes.QueueArn --output text)"
ANALYSES_URL="$(awslocal sqs create-queue --queue-name analyses --query QueueUrl --output text)"
ANALYSES_ARN="$(awslocal sqs get-queue-attributes --queue-url "$ANALYSES_URL" --attribute-names QueueArn --query Attributes.QueueArn --output text)"
printf '{"RedrivePolicy":"{\\"deadLetterTargetArn\\":\\"%s\\",\\"maxReceiveCount\\":\\"5\\"}","VisibilityTimeout":"900"}\n' "$DLQ_ARN" >/tmp/analyses-attributes.json
awslocal sqs set-queue-attributes --queue-url "$ANALYSES_URL" --attributes file:///tmp/analyses-attributes.json >/dev/null

printf '{"QueueConfigurations":[{"Id":"analysis-created","QueueArn":"%s","Events":["s3:ObjectCreated:*"],"Filter":{"Key":{"FilterRules":[{"Name":"prefix","Value":"analyses/"}]}}}]}' "$ANALYSES_ARN" >/tmp/ninar-notifications.json
awslocal s3api put-bucket-notification-configuration --bucket "$BUCKET" --notification-configuration file:///tmp/ninar-notifications.json >/dev/null

echo "Floci S3/SQS ready: ninar-audio, analyses, analyses-dlq and S3-to-SQS notifications"
