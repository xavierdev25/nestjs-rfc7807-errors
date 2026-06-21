import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseModule } from '../../shared/database/database.module';
import { OutboxModule } from '../../shared/outbox/outbox.module';

// Domain
import { TransactionEntity } from './domain/entities/transaction.entity';
import { TRANSACTION_REPOSITORY } from './domain/ports/transaction.repository.port';
import { PAYMENT_GATEWAY } from './domain/ports/payment-gateway.port';

// Application — Command Handlers
import { CreateTransactionHandler } from './application/commands/create-transaction/create-transaction.handler';
import { ProcessTransactionHandler } from './application/commands/process-transaction/process-transaction.handler';

// Application — Query Handlers
import { GetTransactionHandler } from './application/queries/get-transaction/get-transaction.handler';
import { ListTransactionsHandler } from './application/queries/list-transactions/list-transactions.handler';

// Infrastructure — Adapters
import { TransactionController } from './infrastructure/controllers/transaction.controller';
import { TypeOrmTransactionRepository } from './infrastructure/repositories/typeorm-transaction.repository';
import { MockPaymentGatewayAdapter } from './infrastructure/adapters/mock-payment-gateway.adapter';

/**
 * All CQRS command and query handlers.
 */
const CommandHandlers = [CreateTransactionHandler, ProcessTransactionHandler];
const QueryHandlers = [GetTransactionHandler, ListTransactionsHandler];

/**
 * Transaction Module.
 *
 * Wires together the Hexagonal Architecture layers:
 * - Domain: entities, value objects, ports (interfaces)
 * - Application: CQRS command/query handlers, DTOs
 * - Infrastructure: controller, TypeORM repository, mock payment gateway
 *
 * Ports are bound to adapters via DI tokens (Dependency Inversion).
 */
@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([TransactionEntity]),
    DatabaseModule,
    OutboxModule,
  ],
  controllers: [TransactionController],
  providers: [
    // CQRS handlers
    ...CommandHandlers,
    ...QueryHandlers,

    // Port → Adapter bindings (DIP)
    {
      provide: TRANSACTION_REPOSITORY,
      useClass: TypeOrmTransactionRepository,
    },
    {
      provide: PAYMENT_GATEWAY,
      useClass: MockPaymentGatewayAdapter,
    },
  ],
})
export class TransactionModule {}
