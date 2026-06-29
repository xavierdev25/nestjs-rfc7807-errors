import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { REDIS_CLIENT } from '../src/shared/redis/redis.constants';
import { SqsService } from '../src/shared/sqs/sqs.service';
import { NotificationConsumer } from '../src/modules/notification/notification.consumer';

/**
 * Cross-tenant isolation E2E.
 *
 * This is the test that was missing: it proves — against a REAL PostgreSQL
 * instance with the RLS policies provisioned on boot — that a transaction
 * created by one tenant is completely invisible to another. It requires the
 * Postgres service (provided by CI); it cannot run on SQLite because Row Level
 * Security is a PostgreSQL feature.
 */
describe('Tenant Isolation (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;

  // Stable UUIDs so they satisfy the uuid columns and the RLS uuid cast.
  const TENANT_A = '11111111-1111-1111-1111-111111111111';
  const USER_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const TENANT_B = '22222222-2222-2222-2222-222222222222';
  const USER_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  const tokenFor = (
    tenantId: string,
    userId: string,
    roles: string[] = ['user'],
  ): string =>
    jwt.sign({
      sub: userId,
      tenantId,
      email: `${userId}@example.com`,
      roles,
    });

  // Redis is mocked: cache always misses, lock always acquired/released so the
  // idempotency interceptor lets the request through; rate-limit counters
  // (incr/pexpire/pttl) are inert so they never throttle the suite.
  const redisMock = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    eval: jest.fn().mockResolvedValue(1),
    incr: jest.fn().mockResolvedValue(1),
    pexpire: jest.fn().mockResolvedValue(1),
    pttl: jest.fn().mockResolvedValue(60000),
    ping: jest.fn().mockResolvedValue('PONG'),
    on: jest.fn(),
    quit: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(REDIS_CLIENT)
      .useValue(redisMock)
      .overrideProvider(SqsService)
      .useValue({
        sendMessage: jest.fn().mockResolvedValue({ MessageId: 'mock-id' }),
        receiveMessages: jest.fn().mockResolvedValue([]),
        deleteMessage: jest.fn().mockResolvedValue({}),
      })
      .overrideProvider(NotificationConsumer)
      .useValue({ onModuleInit: jest.fn(), onModuleDestroy: jest.fn() })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    jwt = new JwtService({
      secret:
        process.env.JWT_SECRET ??
        'your-super-secret-jwt-key-change-in-production-2026',
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  const createTransactionAsTenantA = async (): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post('/transactions')
      .set('Authorization', `Bearer ${tokenFor(TENANT_A, USER_A)}`)
      .set('X-Idempotency-Key', `key-${Date.now()}-${Math.random()}`)
      .send({ type: 'PAYMENT', amount: 5000, currency: 'USD' })
      .expect(201);

    expect(res.body.id).toBeDefined();
    return res.body.id as string;
  };

  it('lets a tenant read its own transaction', async () => {
    const id = await createTransactionAsTenantA();

    const res = await request(app.getHttpServer())
      .get(`/transactions/${id}`)
      .set('Authorization', `Bearer ${tokenFor(TENANT_A, USER_A)}`)
      .expect(200);

    expect(res.body.id).toBe(id);
  });

  it('hides a transaction from a different tenant (404, no cross-tenant leak)', async () => {
    const id = await createTransactionAsTenantA();

    await request(app.getHttpServer())
      .get(`/transactions/${id}`)
      .set('Authorization', `Bearer ${tokenFor(TENANT_B, USER_B)}`)
      .expect(404);
  });

  it('never includes another tenant rows in the list endpoint', async () => {
    const id = await createTransactionAsTenantA();

    const res = await request(app.getHttpServer())
      .get('/transactions')
      .set('Authorization', `Bearer ${tokenFor(TENANT_B, USER_B)}`)
      .expect(200);

    const ids: string[] = res.body.data.map((t: { id: string }) => t.id);
    expect(ids).not.toContain(id);
  });

  it('rejects unauthenticated access', async () => {
    await request(app.getHttpServer()).get('/transactions').expect(401);
  });

  // ─── RBAC (authorization) ──────────────────────────────────────────────
  const SOME_UUID = '00000000-0000-0000-0000-0000000000ff';

  it('forbids a "user" role from the admin-only process endpoint (403)', async () => {
    await request(app.getHttpServer())
      .patch(`/transactions/${SOME_UUID}/process`)
      .set('Authorization', `Bearer ${tokenFor(TENANT_A, USER_A, ['user'])}`)
      .expect(403);
  });

  it('lets an "admin" role past RBAC on the process endpoint', async () => {
    // Passes RBAC, then the idempotency interceptor rejects the missing header
    // (400) — proving authorization let it through rather than a 403.
    await request(app.getHttpServer())
      .patch(`/transactions/${SOME_UUID}/process`)
      .set('Authorization', `Bearer ${tokenFor(TENANT_A, USER_A, ['admin'])}`)
      .expect(400);
  });

  // ─── Health probes (public, unauthenticated) ───────────────────────────
  it('exposes a public liveness probe', async () => {
    const res = await request(app.getHttpServer())
      .get('/health/live')
      .expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('reports readiness with DB + cache checks (DB is real Postgres)', async () => {
    const res = await request(app.getHttpServer())
      .get('/health/ready')
      .expect(200);
    expect(res.body.status).toBe('up');
    expect(res.body.checks.database.status).toBe('up');
    expect(res.body.checks.cache.status).toBe('up');
  });
});
