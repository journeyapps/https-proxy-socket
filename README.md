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
      // Proxy auth and headers may be set here, for example:
      auth: 'myuser:mypassword' // Basic auth
    });

    const agent = proxy.agent({
      // Additional TLS options for the host may be set here, for example:
      // rejectUnauthorized: false, // Disable TLS checks completely (dangerous)
      // ca: fs.readFileSync('my-ca-cert.pem') // Use a custom CA cert

      // Documentation of the available options is available here:
      //  https://nodejs.org/api/tls.html#tls_new_tls_tlssocket_socket_options
      //  https://nodejs.org/api/tls.html#tls_tls_createsecurecontext_options
    });

    const response = await fetch('https://myhost.test', { agent: agent });

## Usage - Direct socket

    const { HttpsProxySocket } = require('@journeyapps/https-proxy-socket');
    const proxy = new HttpsProxySocket('https://my-proxy.test');

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


## Usage - MongoDB

    import * as mongo from 'mongodb';
    import { useProxyForMongo } from '@journeyapps/https-proxy-socket';

    const SRV_URI = 'mongodb+srv://<username>:<password>@cluster0.jzuewet.mongodb.net';
    const PROXY = 'us-cc-proxy.journeyapps.com'; // Or za-cc-proxy.journeyapps.com
    const PROXY_PORT = 443

    // Register the proxy globally for MongoDB
    useProxyForMongo({
      proxy: PROXY,
      auth: <egress_token>
    });

    async function run() {
      const client = new mongo.MongoClient(SRV_URI, {
        proxyPort: PROXY_PORT,
        proxyHost: PROXY,
      });
      try {
        const database = client.db('poc');
        const data = database.collection('data');

        const results = await data.find({ index: { $lt: 5 } }).toArray();
        console.log(results);
      } finally {
      await client.close();
      }
    }

    run().catch(console.error);
