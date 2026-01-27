import * as tls from 'tls';
import { createProxyAgent } from './createProxyAgent';
import { setServername } from './utils/setServername';
import { parseOptions } from './utils/parseOptions';

import { debug as nodeDebug } from 'util';

const debug = nodeDebug('https-proxy');

export interface HttpsProxyConfig extends tls.ConnectionOptions {
  headers?: { [key: string]: string };
  auth?: string;
}

export interface ConnectionOptions {
  host: string;
  port: number;
}

/**
 * The HttpsProxySocket class allows creating Socket connections via an HTTPS proxy.
 * HTTP proxies are not supported.
 * For http(s) requests, use HttpsProxyAgent as a wrapper around this.
 */
export class HttpsProxySocket {
  proxy: tls.ConnectionOptions;
  proxyConfig: HttpsProxyConfig;

  /**
   *
   * @param options - The connection options to the proxy. At least host and port are required.
   *               Use {rejectUnauthorized: true} to ignore certificates for the proxy (not the endpoint).
   * @param proxyConfig - { auth: 'username:password' } for basic auth.
   *                      { headers: {key: 'value'} } for custom headers.
   */
  constructor(options: tls.ConnectionOptions | string, proxyConfig?: HttpsProxyConfig) {
    const sanitizedOptions = parseOptions(options);
    if (!options) {
      throw new Error('an HTTP(S) proxy server `host` and `port` must be specified!');
    }
    debug('creating new HttpsProxyAgent instance: %o', sanitizedOptions);

    this.proxyConfig = proxyConfig || {};
    this.proxy = sanitizedOptions as tls.ConnectionOptions;
  }

  /**
   * Create a new Socket connection.
   *
   * @param options - host and port
   */
  connect(options: ConnectionOptions): Promise<tls.TLSSocket> {
    return new Promise<tls.TLSSocket>(async (resolve, reject) => {
      this._connect(options, (error, socket) => {
        if (error) {
          reject(error);
        } else {
          if (!socket) {
            return reject(new Error('No socket returned from proxy'));
          }
          resolve(socket);
        }
      });
    });
  }

  /**
   * Construct an agent for http(s) requests.
   *
   * @param options - to set additional TLS options for https requests, e.g. rejectUnauthorized
   */
  agent(options?: tls.ConnectionOptions) {
    return createProxyAgent(this, options);
  }

  private _connect(opts: ConnectionOptions, cb: (error: any, socket: tls.TLSSocket | null) => void) {
    const proxy = this.proxy;

    // create a socket connection to the proxy server
    const socket = tls.connect(setServername(proxy));

    // we need to buffer any HTTP traffic that happens with the proxy before we get
    // the CONNECT response, so that if the response is anything other than an "200"
    // response code, then we can re-play the "data" events on the socket once the
    // HTTP parser is hooked up...
    let buffers: Buffer[] = [];
    let buffersLength = 0;

    function read() {
      const b = socket.read();
      if (b) {
        ondata(b);
      } else {
        socket.once('readable', read);
      }
    }

    function cleanup() {
      socket.removeListener('data', ondata);
      socket.removeListener('end', onend);
      socket.removeListener('error', onerror);
      socket.removeListener('close', onclose);
      socket.removeListener('readable', read);
    }

    function onclose(err: any) {
      debug('onclose had error %o', err);
    }

    function onend() {
      debug('onend');
    }

    function onerror(err: any) {
      cleanup();
      cb(err, null);
    }

    const END_OF_HEADERS = '\r\n\r\n';

    function ondata(b: Buffer) {
      buffers.push(b);
      buffersLength += b.length;

      // Headers (including URLs) are generally ISO-8859-1 or ASCII.
      // The subset used by an HTTPS proxy should always be safe as ASCII.
      const buffered = Buffer.concat(buffers, buffersLength);
      const str = buffered.toString('ascii');

      if (str.indexOf(END_OF_HEADERS) < 0) {
        // keep buffering
        debug('have not received end of HTTP headers yet...');
        if (socket.readable) {
          read();
        } else {
          socket.once('data', ondata);
        }
        return;
      }

      const firstLine = str.substring(0, str.indexOf('\r\n'));
      const statusCode = parseInt(firstLine.split(' ')[1], 10);
      debug('got proxy server response: %o', firstLine);

      if (200 == statusCode) {
        // 200 Connected status code!
        const sock = socket;

        // nullify the buffered data since we won't be needing it
        buffers = [];

        cleanup();
        cb(null, sock);
      } else {
        // some other status code that's not 200... need to re-play the HTTP header
        // "data" events onto the socket once the HTTP machinery is attached so that
        // the user can parse and handle the error status code
        cleanup();

        // nullify the buffered data since we won't be needing it
        buffers = [];

        cleanup();
        socket.end();
        cb(new Error('Proxy connection failed: ' + firstLine), null);
      }
    }

    socket.on('error', onerror);
    socket.on('close', onclose);
    socket.on('end', onend);

    if (socket.readable) {
      read();
    } else {
      socket.once('data', ondata);
    }

    const host = `${opts.host}:${opts.port}`;
    let msg = 'CONNECT ' + host + ' HTTP/1.1\r\n';

    const headers = Object.assign({}, this.proxyConfig.headers);
    if (this.proxyConfig.auth) {
      headers['Proxy-Authorization'] = 'Basic ' + Buffer.from(this.proxyConfig.auth).toString('base64');
    }
    headers['Host'] = host;
    headers['Connection'] = 'close';
    Object.keys(headers).forEach(function (name) {
      msg += name + ': ' + headers[name] + '\r\n';
    });

    socket.write(msg + '\r\n');
  }
}
