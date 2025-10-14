import tls from 'tls';

export function parseOptions(options: tls.ConnectionOptions | string) {
  if (typeof options != 'string') {
    return options;
  } else {
    const parsedOptions = new URL(options);
    return {
      host: parsedOptions.hostname || parsedOptions.host,
      port: parseInt(parsedOptions.port || '443'),
    };
  }
}
