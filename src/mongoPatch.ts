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
  socks.SocksClient.createConnection = async (options, callback) => {
    const socket = await new HttpsProxySocket(`https://${config.proxy}`, { auth: config.auth }).connect({
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
      let count = 0;
      await Promise.all(
        sockets.map(
          (socket) =>
            new Promise<void>((resolve) => {
              socket.once('close', () => {
                count++;
                resolve();
              });
              socket.destroySoon();
            }),
        ),
      );
      // if (count === sockets.length) {
      //   console.log(`Closed ${sockets.length} MongoDB connection sockets`);
      // }
      for (const socket of sockets) {
        console.log('---------------------------------------------');
        console.log('Socket destroyed', socket.destroyed);
        console.log('Socket readable', socket.readable);
        console.log('Socket writable', socket.writable);
        console.log('Socket closed', socket.closed);
        console.log('---------------------------------------------');
      }
      sockets.length = 0;
    },
  };
}
