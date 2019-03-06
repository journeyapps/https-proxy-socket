import { HttpsProxySocket } from './HttpsProxySocket';

const debug = require('debug')('https-proxy');

/**
 * Replace the connection method on the tedious library (used by mssql)
 * to connect via a proxy.
 *
 * @param proxy - the proxy to use
 */
export function useProxy(proxy: HttpsProxySocket) {
  const { Connector } = require('tedious/lib/connector');
  Connector.prototype.execute = async function(cb: any) {
    debug(`opening sql connection to ${this.options.host}:${this.options.port}`);
    try {
      const socket = await proxy.connect(this.options);
      cb(null, socket);
    } catch (error) {
      cb(error);
    }
  };
}
