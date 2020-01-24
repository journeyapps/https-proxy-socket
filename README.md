# https-proxy-socket

Node library to enable opening Socket connections via an HTTPS proxy.

Based on the implementation in https://github.com/TooTallNate/node-https-proxy-agent,
but adapted to expose raw Sockets, instead of just http/https requests.

## Installation

    yarn add @journeyapps/https-proxy-socket

## Usage - node-fetch

    const { HttpsProxySocket } = require('@journeyapps/https-proxy-socket');
    const fetch = require('node-fetch');

    // Proxy connection options
    const proxy = new HttpsProxySocket('https://my-proxy.test', {
      // Additional options for the proxy may be set here, for example:
      auth: 'myuser:mypassword' // Basic auth
    });

    const agent = proxy.agent({
      // Additional TLS options for the host may be set here, for example:
      // rejectUnauthorized: false
    });

    const response = await fetch('https://myhost.test', { agent: agent });

## Usage - Direct socket

    const { HttpsProxySocket } = require('@journeyapps/https-proxy-socket');
    const proxy = new HttpsProxySocket('https://my-proxy.test', {
        auth: 'myuser:mypassword' // Optional: proxy basic auth
    });

    const socket = await proxy.connect({host: 'myhost.test', port: 1234});

## Usage - mssql

    const sql = require('mssql')
    const { HttpsProxySocket, useProxyForTedious } = require('@journeyapps/https-proxy-socket');

    const proxy = new HttpsProxySocket({
      // Same as above
    });

    // Register the proxy globally for tedious/mssql
    useProxyForTedious(proxy);

    async function run() {
      // Connect using the proxy
      await sql.connect('mssql://username:pwd@myserver.database.windows.net/mydb?encrypt=true')
      try {
        const result = await sql.query`Select TOP(1) * from mytable`
        console.dir(result);
      } finally {
        await sql.close();
      }
    }

    run().catch(console.error);
