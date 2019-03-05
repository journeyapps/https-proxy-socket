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
 * The `HttpsProxyAgent` implements an HTTP Agent subclass that connects to the
 * specified "HTTP(s) proxy server" in order to proxy HTTPS requests.
 *
 * @api public
 */

export class HttpsProxySocket {
  proxy: tls.ConnectionOptions;
  proxyConfig: HttpsProxyConfig;

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

    // ALPN is supported by Node.js >= v5.
    // attempt to negotiate http/1.1 for proxy servers that support http/2
    if (!('ALPNProtocols' in sanitizedOptions)) {
      sanitizedOptions.ALPNProtocols = ['http 1.1'];
    }

    this.proxy = sanitizedOptions;
  }

  /**
   * Create a new Socket connection.
   *
   * @param opts - hostname and port
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

    function ondata(b: Buffer) {
      buffers.push(b);
      buffersLength += b.length;
      var buffered = Buffer.concat(buffers, buffersLength);
      var str = buffered.toString('ascii');

      if (!~str.indexOf('\r\n\r\n')) {
        // keep buffering
        debug('have not received end of HTTP headers yet...');
        if (socket.read) {
          read();
        } else {
          socket.once('data', ondata);
        }
        return;
      }

      var firstLine = str.substring(0, str.indexOf('\r\n'));
      var statusCode = +firstLine.split(' ')[1];
      debug('got proxy server response: %o', firstLine);

      if (200 == statusCode) {
        // 200 Connected status code!
        var sock = socket;

        // nullify the buffered data since we won't be needing it
        buffers = buffered = null;

        cleanup();
        cb(null, sock);
      } else {
        // some other status code that's not 200... need to re-play the HTTP header
        // "data" events onto the socket once the HTTP machinery is attached so that
        // the user can parse and handle the error status code
        cleanup();

        // nullify the buffered data since we won't be needing it
        buffers = buffered = null;

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