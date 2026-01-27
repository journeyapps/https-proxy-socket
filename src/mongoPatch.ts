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
  const proxy = new HttpsProxySocket(`https://${config.proxy}`, { auth: config.auth });
  socks.SocksClient.createConnection = async (options, callback) => {
    const socket = await proxy.connect({ host: options.destination.host, port: options.destination.port });
    sockets.push(socket);
    return {
      socket,
    };
  };
  return {
    close: async () => {
      console.log(`Closing ${sockets.length} open proxy sockets`);
      for (const socket of sockets) {
        await new Promise((resolve, reject) => {
          socket.on('close', () => resolve);
          socket.end();
        });
      }
    },
  };
}
