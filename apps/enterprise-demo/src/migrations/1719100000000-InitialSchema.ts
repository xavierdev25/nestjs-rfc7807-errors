import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial schema for the transactional core.
 *
 * Mirrors exactly what TypeORM `synchronize` used to produce for the
 * `TransactionEntity` and `OutboxEvent` entities (enum types, tables, primary
 * keys and the tenant-prefixed indexes), so switching `synchronize: false`
 * leaves the runtime behaviour identical — only now the schema is versioned.
 */
export class InitialSchema1719100000000 implements MigrationInterface {
  name = 'InitialSchema1719100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // uuid_generate_v4() backs the @PrimaryGeneratedColumn('uuid') defaults.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TYPE "public"."outbox_events_status_enum" AS ENUM (
        'PENDING', 'PUBLISHED', 'FAILED'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."transactions_status_enum" AS ENUM (
        'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."transactions_type_enum" AS ENUM (
        'PAYMENT', 'REFUND', 'RESERVATION'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "outbox_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "aggregateId" character varying(255) NOT NULL,
        "aggregateType" character varying(255) NOT NULL,
        "eventType" character varying(255) NOT NULL,
        "payload" jsonb NOT NULL,
        "status" "public"."outbox_events_status_enum" NOT NULL DEFAULT 'PENDING',
        "attempts" integer NOT NULL DEFAULT 0,
        "errorReason" text,
        "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
        "publishedAt" timestamp with time zone,
        CONSTRAINT "PK_outbox_events_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "type" "public"."transactions_type_enum" NOT NULL,
        "status" "public"."transactions_status_enum" NOT NULL DEFAULT 'PENDING',
        "amount_in_cents" integer NOT NULL,
        "currency" character varying(3) NOT NULL,
        "description" text,
        "metadata" jsonb,
        "external_id" character varying,
        "failure_reason" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "version" integer NOT NULL,
        CONSTRAINT "PK_transactions_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_tenant" ON "transactions" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_tenant_status" ON "transactions" ("tenant_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_tenant_created" ON "transactions" ("tenant_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_tenant_user" ON "transactions" ("tenant_id", "user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_transactions_tenant_user"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_transactions_tenant_created"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_transactions_tenant_status"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_transactions_tenant"`);
    await queryRunner.query(`DROP TABLE "transactions"`);
    await queryRunner.query(`DROP TABLE "outbox_events"`);
    await queryRunner.query(`DROP TYPE "public"."transactions_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."transactions_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."outbox_events_status_enum"`);
  }
}
