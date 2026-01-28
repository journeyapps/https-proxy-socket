import * as socks from 'socks';
import * as tls from 'tls';
import { HttpsProxySocket } from './HttpsProxySocket.js';

interface Config {
  /** The journey apps cc egress token */
  auth: string;
  /** The journey apps cc egress proxy domain */
  proxy: string;
}

/**
 *  The patch should be called before instantiating the MongoClient
 *  @param config - The configuration for the proxy
 */
export function useProxyForMongo(config: Config) {
  let sockets: tls.TLSSocket[] = [];
  socks.SocksClient.createConnection = async (options, callback) => {
    const socket = await new HttpsProxySocket({ socket: options.existing_socket }, { auth: config.auth }).connect({
      host: options.destination.host,
      port: options.destination.port,
    });

    socket.on('timeout', () => {
      console.error('Socket timeout');
    });
    sockets.push(socket);
    return {
      socket,
    };
  };
  return {
    close: async () => {
      await Promise.all(
        sockets.map(
          (socket) =>
            new Promise<void>((resolve) => {
              socket.once('close', () => {
                resolve();
              });
              socket.destroySoon();
            }),
        ),
      );
      sockets = [];
    },
  };
}
