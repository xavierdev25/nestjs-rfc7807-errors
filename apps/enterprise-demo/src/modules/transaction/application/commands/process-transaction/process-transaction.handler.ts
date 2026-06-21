import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { ProcessTransactionCommand } from './process-transaction.command';
import {
  TransactionRepositoryPort,
  TRANSACTION_REPOSITORY,
} from '../../../domain/ports/transaction.repository.port';
import {
  PaymentGatewayPort,
  PAYMENT_GATEWAY,
} from '../../../domain/ports/payment-gateway.port';
import { TransactionNotFoundError } from '../../../domain/errors/transaction-not-found.error';
import { TransactionResponseDto } from '../../dto/transaction-response.dto';
import { TenantAwareEntityManager } from '../../../../../shared/database/rls/tenant-aware.entity-manager';
import { OutboxService } from '../../../../../shared/outbox/outbox.service';
import { TransactionEntity } from '../../../domain/entities/transaction.entity';

/**
 * Handler for ProcessTransactionCommand.
 *
 * Transitions the transaction to PROCESSING, calls the payment gateway,
 * and marks it as COMPLETED or FAILED based on the result.
 */
@CommandHandler(ProcessTransactionCommand)
export class ProcessTransactionHandler implements ICommandHandler<
  ProcessTransactionCommand,
  TransactionResponseDto
> {
  private readonly logger = new Logger(ProcessTransactionHandler.name);
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: TransactionRepositoryPort,
    @Inject(PAYMENT_GATEWAY)
    private readonly paymentGateway: PaymentGatewayPort,
    private readonly tenantManager: TenantAwareEntityManager,
    private readonly outboxService: OutboxService,
  ) {}

  async execute(
    command: ProcessTransactionCommand,
  ): Promise<TransactionResponseDto> {
    this.logger.log(`Processing transaction: id=${command.transactionId}`);

    // Load the transaction
    const transaction = await this.transactionRepository.findById(
      command.transactionId,
    );

    if (!transaction) {
      throw new TransactionNotFoundError(command.transactionId);
    }

    // Transition to PROCESSING
    transaction.markAsProcessing();
    await this.tenantManager.executeInTenantContext(async (manager) => {
      const repo = manager.getRepository(TransactionEntity);
      await repo.save(transaction);

      await this.outboxService.saveEvent(
        manager,
        transaction.id,
        'Transaction',
        'TransactionProcessingEvent',
        { status: transaction.status },
      );
    });

    // Call the payment gateway
    try {
      const result = await this.paymentGateway.processPayment(transaction);

      if (result.success) {
        transaction.complete(result.externalId ?? 'no-external-id');
        this.logger.log(
          `Transaction completed: id=${transaction.id}, externalId=${result.externalId}`,
        );
      } else {
        transaction.fail(result.failureReason ?? 'Unknown payment failure');
        this.logger.warn(
          `Transaction failed: id=${transaction.id}, reason=${result.failureReason}`,
        );
      }
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : 'Payment gateway error';
      transaction.fail(reason);
      this.logger.error(
        `Transaction error: id=${transaction.id}, error=${reason}`,
      );
    }

    // Persist the final state
    const updated = await this.tenantManager.executeInTenantContext(
      async (manager) => {
        const repo = manager.getRepository(TransactionEntity);
        const saved = await repo.save(transaction);

        await this.outboxService.saveEvent(
          manager,
          saved.id,
          'Transaction',
          'TransactionProcessedEvent',
          {
            status: saved.status,
            externalId: saved.externalId,
            failureReason: saved.failureReason,
          },
        );

        return saved;
      },
    );

    return TransactionResponseDto.fromEntity(updated);
  }
}
