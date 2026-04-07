// backend/src/utils/gpf-fetch.ts
// Fetch helper for GPF API requests using Node.js built-in https module.
// Uses rejectUnauthorized: false to support self-signed certificates on
// IP-based HTTPS endpoints (e.g. https://200.94.158.81:65445).
// SSL bypass is intentionally scoped only to GPF requests.

import https from 'https';
import http from 'http';
import { URL } from 'url';

const insecureAgent = new https.Agent({ rejectUnauthorized: false });

/** Strips trailing slash from a base URL to avoid double-slash in path joins. */
export function normalizeGpfUrl(url: string): string {
  return url.replace(/\/$/, '');
}

type FetchInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Buffer;
};

interface GpfResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers: { get(name: string): string | null };
  /** Raw Set-Cookie values from the response (may be empty). */
  cookies: string[];
  text(): Promise<string>;
  json(): Promise<any>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/** Minimal fetch-compatible wrapper for GPF endpoints with SSL bypass. */
export function gpfFetch(urlStr: string, init: FetchInit = {}): Promise<GpfResponse> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const isHttps = url.protocol === 'https:';

    const options: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: init.method || 'GET',
      headers: init.headers,
      agent: isHttps ? insecureAgent : undefined
    };

    const transport = isHttps ? https : http;

    const req = (transport as typeof https).request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const status = res.statusCode ?? 0;

        const rawCookies = res.headers['set-cookie'] ?? [];

        resolve({
          ok: status >= 200 && status < 300,
          status,
          statusText: res.statusMessage ?? '',
          headers: {
            get: (name: string) => {
              const val = res.headers[name.toLowerCase()];
              if (!val) return null;
              return Array.isArray(val) ? val[0] : val;
            }
          },
          cookies: Array.isArray(rawCookies) ? rawCookies : [rawCookies],
          text: () => Promise.resolve(buf.toString('utf-8')),
          json: () => {
            try {
              return Promise.resolve(JSON.parse(buf.toString('utf-8')));
            } catch (e) {
              return Promise.reject(e);
            }
          },
          arrayBuffer: () => Promise.resolve(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer)
        });
      });
      res.on('error', reject);
    });

    req.on('error', reject);

    if (init.body) {
      req.write(init.body);
    }

    req.end();
  });
}
