import { ProcessTransactionHandler } from '../process-transaction.handler';
import { ProcessTransactionCommand } from '../process-transaction.command';
import { TransactionRepositoryPort } from '../../../../domain/ports/transaction.repository.port';
import { PaymentGatewayPort } from '../../../../domain/ports/payment-gateway.port';
import { TransactionEntity } from '../../../../domain/entities/transaction.entity';
import {
  TransactionStatus,
  TransactionType,
} from '../../../../domain/value-objects/transaction-status.enum';
import { TransactionNotFoundError } from '../../../../domain/errors/transaction-not-found.error';
import { TenantAwareEntityManager } from '../../../../../../shared/database/rls/tenant-aware.entity-manager';
import { OutboxService } from '../../../../../../shared/outbox/outbox.service';

function createPendingTransaction(): TransactionEntity {
  const tx = new TransactionEntity();
  tx.id = 'tx-123';
  tx.tenantId = 'tenant-1';
  tx.userId = 'user-1';
  tx.type = TransactionType.PAYMENT;
  tx.status = TransactionStatus.PENDING;
  tx.amountInCents = 5000;
  tx.currency = 'USD';
  tx.description = null;
  tx.metadata = null;
  tx.externalId = null;
  tx.failureReason = null;
  tx.createdAt = new Date();
  tx.updatedAt = new Date();
  return tx;
}

describe('ProcessTransactionHandler', () => {
  let handler: ProcessTransactionHandler;
  let mockRepository: any;
  let mockGateway: jest.Mocked<PaymentGatewayPort>;
  let mockTenantManager: any;
  let mockOutboxService: any;

  beforeEach(() => {
    mockRepository = {
      findById: jest.fn(),
      save: jest.fn().mockImplementation(async (tx) => tx),
    };

    mockGateway = {
      processPayment: jest.fn(),
      refund: jest.fn(),
    };

    mockTenantManager = {
      executeInTenantContext: jest.fn().mockImplementation(async (cb) => {
        const manager = {
          getRepository: jest.fn().mockReturnValue(mockRepository),
        };
        return cb(manager);
      }),
    };

    mockOutboxService = {
      saveEvent: jest.fn(),
    };

    handler = new ProcessTransactionHandler(
      mockRepository,
      mockGateway,
      mockTenantManager,
      mockOutboxService,
    );
  });

  it('should throw TransactionNotFoundError if transaction does not exist', async () => {
    mockRepository.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new ProcessTransactionCommand('non-existent')),
    ).rejects.toThrow(TransactionNotFoundError);
  });

  it('should transition to PROCESSING then COMPLETED on payment success', async () => {
    const tx = createPendingTransaction();
    mockRepository.findById.mockResolvedValue(tx);
    mockGateway.processPayment.mockResolvedValue({
      success: true,
      externalId: 'PAY-ABC',
      processedAt: new Date(),
    });

    const result = await handler.execute(
      new ProcessTransactionCommand('tx-123'),
    );

    expect(mockTenantManager.executeInTenantContext).toHaveBeenCalledTimes(2); // PROCESSING + COMPLETED
    expect(mockOutboxService.saveEvent).toHaveBeenCalledTimes(2);
    expect(result.status).toBe(TransactionStatus.COMPLETED);
    expect(result.externalId).toBe('PAY-ABC');
  });

  it('should transition to FAILED on payment failure', async () => {
    const tx = createPendingTransaction();
    mockRepository.findById.mockResolvedValue(tx);
    mockGateway.processPayment.mockResolvedValue({
      success: false,
      failureReason: 'Card declined',
      processedAt: new Date(),
    });

    const result = await handler.execute(
      new ProcessTransactionCommand('tx-123'),
    );

    expect(result.status).toBe(TransactionStatus.FAILED);
    expect(result.failureReason).toBe('Card declined');
  });

  it('should transition to FAILED on payment gateway exception', async () => {
    const tx = createPendingTransaction();
    mockRepository.findById.mockResolvedValue(tx);
    mockGateway.processPayment.mockRejectedValue(new Error('Network timeout'));

    const result = await handler.execute(
      new ProcessTransactionCommand('tx-123'),
    );

    expect(result.status).toBe(TransactionStatus.FAILED);
    expect(result.failureReason).toBe('Network timeout');
  });

  it('should call processPayment with the transaction entity', async () => {
    const tx = createPendingTransaction();
    mockRepository.findById.mockResolvedValue(tx);
    mockGateway.processPayment.mockResolvedValue({
      success: true,
      externalId: 'PAY-XYZ',
      processedAt: new Date(),
    });

    await handler.execute(new ProcessTransactionCommand('tx-123'));

    expect(mockGateway.processPayment).toHaveBeenCalledWith(tx);
  });
});
