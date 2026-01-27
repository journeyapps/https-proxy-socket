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
  const sockets: tls.TLSSocket[] = [];
  const proxy: HttpsProxySocket = new HttpsProxySocket(`https://${config.proxy}`, { auth: config.auth });
  socks.SocksClient.createConnection = async (options, callback) => {
    const socket = await proxy.connect({ host: options.destination.host, port: options.destination.port });

    socket.on('error', (err) => {
      if (err) {
        console.error('MongoDB connection socket error:', err);
      }
    });
    sockets.push(socket);
    return {
      socket,
    };
  };
  return {
    close: async () => {
      let count = 0;
      await Promise.all(
        sockets.map(
          (socket) =>
            new Promise<void>((resolve) => {
              socket.once('close', () => {
                count++;
                socket.removeAllListeners();
                socket.destroySoon();
                resolve();
              });
              socket.end();
            }),
        ),
      );
      if (count === sockets.length) {
        console.log(`Closed ${sockets.length} MongoDB connection sockets`);
      }
    },
  };
}
