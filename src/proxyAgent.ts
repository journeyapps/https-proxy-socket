import { HttpsProxySocket } from './HttpsProxySocket.js';
import agentBase from 'agent-base';
import * as tls from 'tls';

/**
 * Construct an agent for http(s) requests. Mostly for testing purposes.
 *
 * @param proxy - the proxy to use
 * @param options - to set additional TLS options for https requests, e.g. rejectUnauthorized
 */
export function proxyAgent(proxy: HttpsProxySocket, options?: tls.ConnectionOptions) {
  return agentBase(async (_, opts: any) => {
    const socket = await proxy.connect(opts);

    if (opts.secureEndpoint) {
      // Upgrade to TLS
      let tlsOptions: tls.ConnectionOptions = {
        socket: socket,
        servername: opts.servername || opts.host,
      };
      if (typeof opts.rejectUnauthorized != 'undefined') {
        // There's a difference between 'undefined' (equivalent of false) and "not set" (equivalent of true)
        tlsOptions.rejectUnauthorized = opts.rejectUnauthorized;
      }
      Object.assign(tlsOptions, options);
      const tlsSocket = tls.connect(tlsOptions);
      return tlsSocket;
    } else {
      socket.resume();
      return socket;
    }
  });
}
