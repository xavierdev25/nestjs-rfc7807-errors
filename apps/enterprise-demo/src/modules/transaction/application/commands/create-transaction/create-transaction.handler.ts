import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { CreateTransactionCommand } from './create-transaction.command';
import { TransactionEntity } from '../../../domain/entities/transaction.entity';
import {
  TransactionRepositoryPort,
  TRANSACTION_REPOSITORY,
} from '../../../domain/ports/transaction.repository.port';
import { TransactionStatus } from '../../../domain/value-objects/transaction-status.enum';
import { TransactionResponseDto } from '../../dto/transaction-response.dto';
import { TenantAwareEntityManager } from '../../../../../shared/database/rls/tenant-aware.entity-manager';
import { OutboxService } from '../../../../../shared/outbox/outbox.service';

/**
 * Handler for CreateTransactionCommand.
 *
 * Creates a new transaction entity in PENDING status and persists it.
 */
@CommandHandler(CreateTransactionCommand)
export class CreateTransactionHandler implements ICommandHandler<
  CreateTransactionCommand,
  TransactionResponseDto
> {
  private readonly logger = new Logger(CreateTransactionHandler.name);

  constructor(
    private readonly tenantManager: TenantAwareEntityManager,
    private readonly outboxService: OutboxService,
  ) {}

  async execute(
    command: CreateTransactionCommand,
  ): Promise<TransactionResponseDto> {
    this.logger.log(
      `Creating transaction: type=${command.type}, amount=${command.amountInCents} ${command.currency}`,
    );

    // Create the domain entity
    const transaction = new TransactionEntity();
    transaction.tenantId = command.tenantId;
    transaction.userId = command.userId;
    transaction.type = command.type;
    transaction.status = TransactionStatus.PENDING;
    transaction.amountInCents = command.amountInCents;
    transaction.currency = command.currency.toUpperCase();
    transaction.description = command.description ?? null;
    transaction.metadata = command.metadata ?? null;
    transaction.externalId = null;
    transaction.failureReason = null;

    // Perform database operations inside a single RLS-enforced transaction
    const saved = await this.tenantManager.executeInTenantContext(
      async (manager) => {
        const repo = manager.getRepository(TransactionEntity);
        const savedEntity = await repo.save(transaction);

        // Save Outbox Event
        await this.outboxService.saveEvent(
          manager,
          savedEntity.id,
          'Transaction',
          'TransactionCreatedEvent',
          {
            amountInCents: savedEntity.amountInCents,
            currency: savedEntity.currency,
            type: savedEntity.type,
            tenantId: savedEntity.tenantId,
            userId: savedEntity.userId,
          },
        );

        return savedEntity;
      },
    );

    this.logger.log(
      `Transaction created & event saved: id=${saved.id}, status=${saved.status}`,
    );

    return TransactionResponseDto.fromEntity(saved);
  }
}
