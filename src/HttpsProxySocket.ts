// Based on https://github.com/TooTallNate/node-https-proxy-agent

import * as tls from 'tls';
import * as url from 'url';

const debug = require('debug')('https-proxy');

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
   * @param opts - The connection options to the proxy. At least host and port are required.
   *               Use {rejectUnauthorized: true} to ignore certificates for the proxy (not the endpoint).
   * @param proxyConfig - { auth: 'username:password' } for basic auth.
   *                      { headers: {key: 'value'} } for custom headers.
   */
  constructor(opts: tls.ConnectionOptions | string, proxyConfig?: HttpsProxyConfig) {
    let sanitizedOptions;
    if (typeof opts == 'string') {
      let parsedOptions = url.parse(opts);
      sanitizedOptions = {
        host: parsedOptions.hostname || parsedOptions.host,
        port: parseInt(parsedOptions.port || '443')
      };
    } else {
      sanitizedOptions = Object.assign({}, opts);
    }

    if (!opts) {
      throw new Error('an HTTP(S) proxy server `host` and `port` must be specified!');
    }
    debug('creating new HttpsProxyAgent instance: %o', sanitizedOptions);

    this.proxyConfig = proxyConfig || {};
    this.proxy = sanitizedOptions;
  }

  /**
   * Create a new Socket connection.
   *
   * @param opts - host and port
   */
  connect(opts: ConnectionOptions): Promise<tls.TLSSocket> {
    return new Promise<tls.TLSSocket>((resolve, reject) => {
      this._connect(opts, (error, socket) => {
        if (error) {
          reject(error);
        } else {
          resolve(socket);
        }
      });
    });
  }

  private _connect(opts: ConnectionOptions, cb: (error: any, socket: tls.TLSSocket) => void) {
    const proxy = this.proxy;

    // create a socket connection to the proxy server
    const socket = tls.connect(proxy);

    // we need to buffer any HTTP traffic that happens with the proxy before we get
    // the CONNECT response, so that if the response is anything other than an "200"
    // response code, then we can re-play the "data" events on the socket once the
    // HTTP parser is hooked up...
    var buffers: Buffer[] = [];
    var buffersLength = 0;

    function read() {
      var b = socket.read();
      if (b) ondata(b);
      else socket.once('readable', read);
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
        if (socket.read) {
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
        buffers = null;

        cleanup();
        cb(null, sock);
      } else {
        // some other status code that's not 200... need to re-play the HTTP header
        // "data" events onto the socket once the HTTP machinery is attached so that
        // the user can parse and handle the error status code
        cleanup();

        // nullify the buffered data since we won't be needing it
        buffers = null;

        cleanup();
        socket.end();
        cb(new Error('Proxy connection failed: ' + firstLine), null);
      }
    }

    socket.on('error', onerror);
    socket.on('close', onclose);
    socket.on('end', onend);

    if (socket.read) {
      read();
    } else {
      socket.once('data', ondata);
    }

    const host = `${opts.host}:${opts.port}`;
    var msg = 'CONNECT ' + host + ' HTTP/1.1\r\n';

    var headers = Object.assign({}, this.proxyConfig.headers);
    if (this.proxyConfig.auth) {
      headers['Proxy-Authorization'] = 'Basic ' + Buffer.from(this.proxyConfig.auth).toString('base64');
    }

    headers['Host'] = host;

    headers['Connection'] = 'close';
    Object.keys(headers).forEach(function(name) {
      msg += name + ': ' + headers[name] + '\r\n';
    });

    socket.write(msg + '\r\n');
  }
}
