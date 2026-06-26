output "outbox_queue_url" {
  description = "URL the relay publishes to"
  value       = aws_sqs_queue.outbox.url
}

output "outbox_queue_arn" {
  value = aws_sqs_queue.outbox.arn
}

output "outbox_dlq_url" {
  description = "Dead Letter Queue URL"
  value       = aws_sqs_queue.outbox_dlq.url
}

output "database_secret_arn" {
  value = aws_secretsmanager_secret.database.arn
}

output "jwt_secret_arn" {
  value = aws_secretsmanager_secret.jwt.arn
}

output "app_log_group" {
  value = aws_cloudwatch_log_group.app.name
}
