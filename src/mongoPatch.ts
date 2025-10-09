import * as socks from 'socks';
import * as tls from 'tls';
import {HttpsProxySocket} from './HttpsProxySocket';

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
  let socket: tls.TLSSocket
  socks.SocksClient.createConnection = async (options, callback) => {
    const proxy = new HttpsProxySocket(`https://${config.proxy}`, { auth: config.auth });
    return new Promise(async (resolve, reject) => {
      socket = await proxy.connect({ host: options.destination.host, port: options.destination.port });
      resolve({
        socket,
      });
    });
  };
  return {
    close: () => socket?.end()
  }
}
