import { IdempotencyService } from '../idempotency.service';

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let mockRedis: Record<string, jest.Mock>;

  beforeEach(() => {
    mockRedis = {
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      eval: jest.fn(),
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
    it('should return a unique token when SET NX succeeds', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const token = await service.acquireLock('test-key');

      expect(typeof token).toBe('string');
      expect(token).not.toBeNull();
      // SET idem:lock:test-key <token> EX 30 NX
      expect(mockRedis.set).toHaveBeenCalledWith(
        'idem:lock:test-key',
        token,
        'EX',
        30,
        'NX',
      );
    });

    it('should return null when the key is already locked', async () => {
      mockRedis.set.mockResolvedValue(null);

      const token = await service.acquireLock('test-key');

      expect(token).toBeNull();
    });

    it('should issue a different token on each acquisition', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const first = await service.acquireLock('key');
      const second = await service.acquireLock('key');

      expect(first).not.toEqual(second);
    });

    it('should accept custom lock TTL', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const token = await service.acquireLock('key', 60);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'idem:lock:key',
        token,
        'EX',
        60,
        'NX',
      );
    });
  });

  describe('releaseLock', () => {
    it('should compare-and-delete only the owned lock (returns true)', async () => {
      mockRedis.eval.mockResolvedValue(1);

      const released = await service.releaseLock('test-key', 'my-token');

      expect(released).toBe(true);
      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining('redis.call'),
        1,
        'idem:lock:test-key',
        'my-token',
      );
    });

    it('should not delete a lock owned by another acquisition (returns false)', async () => {
      mockRedis.eval.mockResolvedValue(0);

      const released = await service.releaseLock('test-key', 'stale-token');

      expect(released).toBe(false);
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
