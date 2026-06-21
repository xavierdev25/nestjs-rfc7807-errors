import { IdempotencyService, LockStatus } from '../idempotency.service';

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let mockRedis: Record<string, jest.Mock>;

  beforeEach(() => {
    mockRedis = {
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
    };

    service = new IdempotencyService(mockRedis as any);
  });

  describe('buildKey', () => {
    it('should build a scoped key', () => {
      const key = service.buildKey('tenant-1', 'user-1', 'client-key');
      expect(key).toBe('tenant-1:user-1:client-key');
    });
  });

  describe('acquireLock', () => {
    it('should return ACQUIRED when SET NX succeeds', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const result = await service.acquireLock('test-key');

      expect(result).toBe(LockStatus.ACQUIRED);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'idem:lock:test-key',
        'processing',
        'EX',
        30,
        'NX',
      );
    });

    it('should return ALREADY_LOCKED when SET NX fails', async () => {
      mockRedis.set.mockResolvedValue(null);

      const result = await service.acquireLock('test-key');

      expect(result).toBe(LockStatus.ALREADY_LOCKED);
    });

    it('should accept custom lock TTL', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await service.acquireLock('key', 60);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'idem:lock:key',
        'processing',
        'EX',
        60,
        'NX',
      );
    });
  });

  describe('releaseLock', () => {
    it('should delete the lock key', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.releaseLock('test-key');

      expect(mockRedis.del).toHaveBeenCalledWith('idem:lock:test-key');
    });
  });

  describe('storeResponse', () => {
    it('should store serialized response with TTL', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const response = { statusCode: 201, body: { id: 'tx-1' } };
      await service.storeResponse('key', response, 86400);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'idem:resp:key',
        JSON.stringify(response),
        'EX',
        86400,
      );
    });
  });

  describe('getStoredResponse', () => {
    it('should return parsed response when found', async () => {
      const stored = { statusCode: 200, body: { id: 'tx-1' } };
      mockRedis.get.mockResolvedValue(JSON.stringify(stored));

      const result = await service.getStoredResponse('key');

      expect(result).toEqual(stored);
    });

    it('should return null when not found', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.getStoredResponse('key');

      expect(result).toBeNull();
    });

    it('should return null and clean up corrupted data', async () => {
      mockRedis.get.mockResolvedValue('not-valid-json{{{');
      mockRedis.del.mockResolvedValue(1);

      const result = await service.getStoredResponse('key');

      expect(result).toBeNull();
      expect(mockRedis.del).toHaveBeenCalledWith('idem:resp:key');
    });
  });
});
