# https-proxy-socket

Node library to enable opening Socket connections via an HTTPS proxy.

## Installation

    yarn add @journeyapps/https-proxy-socket

## Usage


    const { HttpsProxySocket } = require('@journeyapps/https-proxy-socket');
    const proxy = new HttpsProxySocket({
      // Connection options
      host: 'my-proxy.test',
      port: 443
    }, {
        auth: 'myuser:mypassword' // Optional: proxy basic auth
    });

    const socket = await proxy.connect({host: 'myhost.test', port: 1234});

## Usage with mssql


    const sql = require('mssql')
    const { useProxy } = require('@journeyapps/https-proxy-socket/lib/TediousPatch');

    const { HttpsProxySocket } = require('./lib/HttpsProxySocket');
    const proxy = new HttpsProxySocket({
      // Same as above
    });

    // Register the proxy globally for tedious/mssql
    useProxy(proxy);

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
