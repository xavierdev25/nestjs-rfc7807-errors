import { JsonLogger } from '../json.logger';
import { RequestContext } from '../../context/request-context';

describe('JsonLogger', () => {
  const logger = new JsonLogger();

  it('produces a structured entry with level, message and context', () => {
    const entry = logger.format('log', 'hello', ['MyContext']);
    expect(entry.level).toBe('log');
    expect(entry.message).toBe('hello');
    expect(entry.context).toBe('MyContext');
    expect(typeof entry.time).toBe('string');
  });

  it('captures the stack trace for error logs', () => {
    const entry = logger.format('error', 'boom', ['STACK-TRACE', 'Ctx']);
    expect(entry.context).toBe('Ctx');
    expect(entry.trace).toBe('STACK-TRACE');
  });

  it('enriches entries with correlationId/requestId/tenantId from the context', () => {
    const ctx = new RequestContext('corr-123');
    ctx.tenantId = 'tenant-9';

    const entry = RequestContext.run(ctx, () =>
      logger.format('log', 'scoped', ['Ctx']),
    );

    expect(entry.correlationId).toBe('corr-123');
    expect(entry.requestId).toBe(ctx.requestId);
    expect(entry.tenantId).toBe('tenant-9');
  });

  it('omits request fields when logging outside a request scope', () => {
    const entry = logger.format('warn', 'no-context', []);
    expect(entry.correlationId).toBeUndefined();
    expect(entry.tenantId).toBeUndefined();
  });
});
