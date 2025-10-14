import { HttpsProxySocket } from './HttpsProxySocket.js';
import { ProxyAgent } from './ProxyAgent';
import * as http from 'node:http';

/**
 * Construct an agent for http(s) requests. Mostly for testing purposes.
 *
 * @param proxy - the proxy to use
 * @param options - to set additional TLS options for https requests, e.g. rejectUnauthorized
 */
export function createProxyAgent(proxy: HttpsProxySocket, options?: http.AgentOptions) {
  return new ProxyAgent(proxy, options);
}
