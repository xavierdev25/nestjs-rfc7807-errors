import { GetTransactionHandler } from '../get-transaction.handler';
import { GetTransactionQuery } from '../get-transaction.query';
import { TransactionRepositoryPort } from '../../../../domain/ports/transaction.repository.port';
import { TransactionEntity } from '../../../../domain/entities/transaction.entity';
import {
  TransactionStatus,
  TransactionType,
} from '../../../../domain/value-objects/transaction-status.enum';
import { TransactionNotFoundError } from '../../../../domain/errors/transaction-not-found.error';

describe('GetTransactionHandler', () => {
  let handler: GetTransactionHandler;
  let mockRepository: jest.Mocked<TransactionRepositoryPort>;

  beforeEach(() => {
    mockRepository = {
      save: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
    };

    handler = new GetTransactionHandler(mockRepository);
  });

  it('should return the transaction DTO when found', async () => {
    const entity = new TransactionEntity();
    entity.id = 'tx-found';
    entity.tenantId = 'tenant-1';
    entity.userId = 'user-1';
    entity.type = TransactionType.PAYMENT;
    entity.status = TransactionStatus.COMPLETED;
    entity.amountInCents = 9999;
    entity.currency = 'USD';
    entity.description = 'Found transaction';
    entity.metadata = { ref: 'test' };
    entity.externalId = 'PAY-123';
    entity.failureReason = null;
    entity.createdAt = new Date('2026-01-01');
    entity.updatedAt = new Date('2026-01-02');

    mockRepository.findById.mockResolvedValue(entity);

    const result = await handler.execute(new GetTransactionQuery('tx-found'));

    expect(result.id).toBe('tx-found');
    expect(result.status).toBe(TransactionStatus.COMPLETED);
    expect(result.amount).toBe(9999);
    expect(result.currency).toBe('USD');
    expect(result.externalId).toBe('PAY-123');
  });

  it('should throw TransactionNotFoundError when not found', async () => {
    mockRepository.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new GetTransactionQuery('non-existent')),
    ).rejects.toThrow(TransactionNotFoundError);
  });

  it('should call repository with the correct ID', async () => {
    mockRepository.findById.mockResolvedValue(null);

    try {
      await handler.execute(new GetTransactionQuery('my-tx-id'));
    } catch {
      // Expected
    }

    expect(mockRepository.findById).toHaveBeenCalledWith('my-tx-id');
  });
});
