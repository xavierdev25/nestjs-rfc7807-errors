import { CreateTransactionHandler } from '../create-transaction.handler';
import { CreateTransactionCommand } from '../create-transaction.command';
import { TransactionEntity } from '../../../../domain/entities/transaction.entity';
import {
  TransactionStatus,
  TransactionType,
} from '../../../../domain/value-objects/transaction-status.enum';
import { TenantAwareEntityManager } from '../../../../../../shared/database/rls/tenant-aware.entity-manager';
import { OutboxService } from '../../../../../../shared/outbox/outbox.service';

describe('CreateTransactionHandler', () => {
  let handler: CreateTransactionHandler;
  let mockTenantManager: any;
  let mockOutboxService: any;
  let mockRepository: any;

  beforeEach(() => {
    mockRepository = {
      save: jest.fn(),
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

    handler = new CreateTransactionHandler(
      mockTenantManager,
      mockOutboxService,
    );
  });

  it('should create a transaction in PENDING status', async () => {
    const command = new CreateTransactionCommand(
      'tenant-1',
      'user-1',
      TransactionType.PAYMENT,
      5000,
      'usd',
      'Test payment',
      { orderId: 'ORD-123' },
    );

    const savedEntity = new TransactionEntity();
    savedEntity.id = 'generated-uuid';
    savedEntity.tenantId = 'tenant-1';
    savedEntity.userId = 'user-1';
    savedEntity.type = TransactionType.PAYMENT;
    savedEntity.status = TransactionStatus.PENDING;
    savedEntity.amountInCents = 5000;
    savedEntity.currency = 'USD';
    savedEntity.description = 'Test payment';
    savedEntity.metadata = { orderId: 'ORD-123' };
    savedEntity.externalId = null;
    savedEntity.failureReason = null;
    savedEntity.createdAt = new Date();
    savedEntity.updatedAt = new Date();

    mockRepository.save.mockResolvedValue(savedEntity);

    const result = await handler.execute(command);

    expect(mockTenantManager.executeInTenantContext).toHaveBeenCalledTimes(1);
    expect(mockRepository.save).toHaveBeenCalledTimes(1);
    expect(mockOutboxService.saveEvent).toHaveBeenCalledTimes(1);
    expect(mockOutboxService.saveEvent).toHaveBeenCalledWith(
      expect.anything(),
      'generated-uuid',
      'Transaction',
      'TransactionCreatedEvent',
      expect.objectContaining({
        amountInCents: 5000,
        currency: 'USD',
        type: TransactionType.PAYMENT,
      }),
    );
    expect(result.id).toBe('generated-uuid');
    expect(result.status).toBe(TransactionStatus.PENDING);
    expect(result.amount).toBe(5000);
    expect(result.currency).toBe('USD');
    expect(result.description).toBe('Test payment');
  });

  it('should uppercase the currency code', async () => {
    const command = new CreateTransactionCommand(
      'tenant-1',
      'user-1',
      TransactionType.REFUND,
      1000,
      'eur',
    );

    mockRepository.save.mockImplementation(async (tx) => {
      expect(tx.currency).toBe('EUR');
      tx.id = 'uuid';
      tx.createdAt = new Date();
      tx.updatedAt = new Date();
      return tx;
    });

    await handler.execute(command);
    expect(mockRepository.save).toHaveBeenCalledTimes(1);
  });

  it('should default description and metadata to null', async () => {
    const command = new CreateTransactionCommand(
      'tenant-1',
      'user-1',
      TransactionType.RESERVATION,
      2000,
      'USD',
    );

    mockRepository.save.mockImplementation(async (tx) => {
      expect(tx.description).toBeNull();
      expect(tx.metadata).toBeNull();
      tx.id = 'uuid';
      tx.createdAt = new Date();
      tx.updatedAt = new Date();
      return tx;
    });

    await handler.execute(command);
    expect(mockRepository.save).toHaveBeenCalledTimes(1);
  });

  it('should set externalId and failureReason to null initially', async () => {
    const command = new CreateTransactionCommand(
      'tenant-1',
      'user-1',
      TransactionType.PAYMENT,
      3000,
      'USD',
    );

    mockRepository.save.mockImplementation(async (tx) => {
      expect(tx.externalId).toBeNull();
      expect(tx.failureReason).toBeNull();
      tx.id = 'uuid';
      tx.createdAt = new Date();
      tx.updatedAt = new Date();
      return tx;
    });

    await handler.execute(command);
  });

  it('should propagate outbox errors, rolling back transaction', async () => {
    const command = new CreateTransactionCommand(
      'tenant-1',
      'user-1',
      TransactionType.PAYMENT,
      3000,
      'USD',
    );

    mockRepository.save.mockImplementation(async (tx) => {
      tx.id = 'uuid';
      tx.createdAt = new Date();
      tx.updatedAt = new Date();
      return tx;
    });

    mockOutboxService.saveEvent.mockRejectedValue(
      new Error('Outbox save failed'),
    );

    await expect(handler.execute(command)).rejects.toThrow(
      'Outbox save failed',
    );
  });
});
