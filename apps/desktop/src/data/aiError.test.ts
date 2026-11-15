import { describe, expect, it } from 'vitest';
import { providerError } from './aiError';

describe('provider error formatting', () => {
  it('keeps readable JSON error messages', () => {
    expect(providerError(401, '{"error":{"message":"Invalid API key"}}').message).toContain('API Key 无效');
    expect(providerError(401, '{"error":{"message":"Invalid API key"}}').message).toContain('Invalid API key');
  });

  it('hides binary or replacement-character garbage', () => {
    const message = providerError(502, '\uFFFD\uFFFD\u0001\u0002gzip-binary').message;
    expect(message).toContain('模型服务网关错误');
    expect(message).not.toContain('gzip-binary');
  });

  it('maps unknown status codes to a stable Chinese fallback', () => {
    expect(providerError(418, '<html><body>teapot</body></html>').message).toContain('模型请求失败 HTTP 418');
  });
});