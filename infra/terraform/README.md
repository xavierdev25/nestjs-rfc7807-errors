# Infrastructure as Code (Terraform)

Declarative definition of the cloud resources the system depends on. It targets
the **Floci** emulator locally (identical to LocalStack) and **real AWS** by
flipping a single variable — the resource definitions never change.

## Resources

| File                | Resources                                                    |
| ------------------- | ------------------------------------------------------------ |
| `sqs.tf`            | Outbox queue (long polling) + Dead Letter Queue + redrive    |
| `secrets.tf`        | Secrets Manager: DB credentials, JWT signing secret          |
| `observability.tf`  | CloudWatch log groups (app + outbox relay)                   |

## Usage — local (Floci)

```bash
cd infra/terraform
terraform init
terraform plan      # defaults point at http://localhost:4566 (Floci)
terraform apply -auto-approve
terraform output outbox_queue_url
```

## Usage — real AWS

```bash
terraform apply \
  -var 'aws_endpoint=' \
  -var 'environment=prod' \
  -var "db_password=$DB_PASSWORD" \
  -var "jwt_secret=$JWT_SECRET"
```

Secret **values** are supplied via `TF_VAR_*` from the CI secret store and are
never committed. Configure a remote state backend (S3 + DynamoDB lock) before
using this against shared environments.
