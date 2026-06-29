# Centralized log destination for the app's structured JSON logs (JsonLogger).
# In a container deployment, the log driver / agent ships stdout here, where the
# correlation_id field makes requests greppable across services.

resource "aws_cloudwatch_log_group" "app" {
  name              = "/${var.project}/${var.environment}/app"
  retention_in_days = var.log_retention_days
  tags              = local.tags
}

resource "aws_cloudwatch_log_group" "relay" {
  name              = "/${var.project}/${var.environment}/outbox-relay"
  retention_in_days = var.log_retention_days
  tags              = local.tags
}
