import { HttpsProxySocket } from './HttpsProxySocket';
import * as agentBase from 'agent-base';
import * as tls from 'tls';

/**
 * Construct an agent for http(s) requests. Mostly for testing purposes.
 *
 * @param proxy
 */
export function agent(proxy: HttpsProxySocket) {
  return agentBase(async (req, opts: any) => {
    const socket = await proxy.connect(opts);

    if (opts.secureEndpoint) {
      // Upgrade to TLS
      let tlsOptions = {
        socket: socket,
        servername: opts.servername || opts.host,
        rejectUnauthorized: opts.rejectUnauthorized
      };
      const tlsSocket = tls.connect(tlsOptions);
      return tlsSocket;
    } else {
      return socket;
    }
  });
}
