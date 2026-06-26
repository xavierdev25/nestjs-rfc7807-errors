# Transactional Outbox messaging: a main queue with long-polling and an attached
# Dead Letter Queue (redrive). Mirrors the consumer's expectations in
# apps/enterprise-demo (sqs-consumer long-polls the main queue; poison messages
# land in the DLQ after maxReceiveCount).

resource "aws_sqs_queue" "outbox_dlq" {
  name                      = "${var.outbox_queue_name}-dlq"
  message_retention_seconds = 1209600 # 14 days
  tags                      = local.tags
}

resource "aws_sqs_queue" "outbox" {
  name                       = var.outbox_queue_name
  visibility_timeout_seconds = 30
  receive_wait_time_seconds  = 20 # enable long polling
  message_retention_seconds  = 345600 # 4 days

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.outbox_dlq.arn
    maxReceiveCount     = 5
  })

  tags = local.tags
}

# Let the DLQ only accept redrives from its source queue.
resource "aws_sqs_queue_redrive_allow_policy" "outbox_dlq" {
  queue_url = aws_sqs_queue.outbox_dlq.id

  redrive_allow_policy = jsonencode({
    redrivePermission = "byQueue"
    sourceQueueArns   = [aws_sqs_queue.outbox.arn]
  })
}
