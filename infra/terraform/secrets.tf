# Secrets Manager entries. The application reads these at deploy time instead of
# baking credentials into images/env files. Real secret VALUES are injected by
# the CD pipeline (TF_VAR_* from the CI secret store) — never committed here.

resource "aws_secretsmanager_secret" "database" {
  name        = "${var.project}/${var.environment}/database"
  description = "PostgreSQL credentials for the enterprise-demo app"
  tags        = local.tags
}

resource "aws_secretsmanager_secret_version" "database" {
  secret_id = aws_secretsmanager_secret.database.id
  secret_string = jsonencode({
    username = var.db_username
    password = var.db_password
  })
}

resource "aws_secretsmanager_secret" "jwt" {
  name        = "${var.project}/${var.environment}/jwt"
  description = "JWT signing secret"
  tags        = local.tags
}

resource "aws_secretsmanager_secret_version" "jwt" {
  secret_id     = aws_secretsmanager_secret.jwt.id
  secret_string = var.jwt_secret
}

variable "db_username" {
  type    = string
  default = "app_user"
}

variable "db_password" {
  type      = string
  sensitive = true
  default   = "change-me-via-TF_VAR_db_password"
}

variable "jwt_secret" {
  type      = string
  sensitive = true
  default   = "change-me-via-TF_VAR_jwt_secret"
}
