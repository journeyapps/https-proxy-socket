import * as socks from 'socks';
import * as tls from 'tls';
import { HttpsProxySocket } from './HttpsProxySocket.js';

interface Config {
  /** The journey apps cc egress token */
  auth: string;
  /** The journey apps cc egress proxy domain */
  proxy: string;
}

const originalCreateConnection = socks.SocksClient.createConnection;

/**
 *  The patch should be called before instantiating the MongoClient
 *  @param config - The configuration for the proxy
 */
export function useProxyForMongo(config: Config) {
  const sockets: tls.TLSSocket[] = [];
  socks.SocksClient.createConnection = async (options, callback) => {
    const proxy = new HttpsProxySocket(`https://${config.proxy}`, { auth: config.auth });
    const socket = await proxy.connect({ host: options.destination.host, port: options.destination.port });
    socket.unref();
    sockets.push(socket);
    return {
      socket,
    };
  };
  return {
    close: async () => {
      console.log(`Closing ${sockets.length} open proxy sockets`);
      await Promise.all(
        sockets.map(
          (socket) =>
            new Promise<void>((resolve) => {
              socket.once('close', ()=>{
                console.log('Socket closed');
                resolve();
              });
              socket.destroy();
            }),
        ),
      );
      sockets.length = 0;
      socks.SocksClient.createConnection = originalCreateConnection;
    },
  };
}
