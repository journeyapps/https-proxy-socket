import * as net from 'net';
import * as tls from 'tls';

export function setServername(options: tls.ConnectionOptions) {
  if (options.servername === undefined && options.host && !net.isIP(options.host)) {
    return {
      ...options,
      servername: options.host,
    };
  }
  return options;
}
