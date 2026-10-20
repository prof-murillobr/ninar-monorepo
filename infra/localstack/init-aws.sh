#!/bin/sh
set -eu

awslocal s3api create-bucket --bucket ninar-audio >/dev/null 2>&1 || true
printf '{"CORSRules":[{"AllowedMethods":["PUT"],"AllowedOrigins":["http://localhost:3000"],"AllowedHeaders":["*"]}]}' >/tmp/ninar-cors.json
awslocal s3api put-bucket-cors --bucket ninar-audio --cors-configuration file:///tmp/ninar-cors.json >/dev/null
awslocal sqs create-queue --queue-name analyses-dlq >/dev/null
DLQ_URL="$(awslocal sqs get-queue-url --queue-name analyses-dlq --query QueueUrl --output text)"
DLQ_ARN="$(awslocal sqs get-queue-attributes --queue-url "$DLQ_URL" --attribute-names QueueArn --query Attributes.QueueArn --output text)"
ANALYSES_URL="$(awslocal sqs create-queue --queue-name analyses --query QueueUrl --output text)"
printf '{"RedrivePolicy":"{\\"deadLetterTargetArn\\":\\"%s\\",\\"maxReceiveCount\\":\\"5\\"}","VisibilityTimeout":"900"}\n' "$DLQ_ARN" >/tmp/analyses-attributes.json
awslocal sqs set-queue-attributes --queue-url "$ANALYSES_URL" --attributes file:///tmp/analyses-attributes.json >/dev/null
echo "LocalStack S3/SQS ready: ninar-audio, analyses and analyses-dlq"
