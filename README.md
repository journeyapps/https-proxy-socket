# https-proxy-socket

Node library to enable opening Socket connections via an HTTPS proxy.

Based on the implementation in https://github.com/TooTallNate/node-https-proxy-agent,
but adapted to expose raw Sockets, instead of just http/https requests.

## Installation

    yarn add @journeyapps/https-proxy-socket

## Usage - node-fetch

    import { HttpsProxySocket } from '@journeyapps/https-proxy-socket';
    import fetch from 'node-fetch';

    /** Proxy connection options */
    const proxy = new HttpsProxySocket('https://my-proxy.test', {
      /** Proxy auth and headers may be set here, for example: */
      auth: 'myuser:mypassword' // Basic auth
    });

    const agent = proxy.agent({
      /** 
       * Additional TLS options for the host may be set here, for example:
       * rejectUnauthorized: false, // Disable TLS checks completely (dangerous)
       * ca: fs.readFileSync('my-ca-cert.pem') // Use a custom CA cert
       */

      /** 
       * Documentation of the available options is available here:
       * https://nodejs.org/api/tls.html#tls_new_tls_tlssocket_socket_options
       * https://nodejs.org/api/tls.html#tls_tls_createsecurecontext_options
       */
    });

    const response = await fetch('https://myhost.test', { agent: agent });

## Usage - Direct socket

    import { HttpsProxySocket } from '@journeyapps/https-proxy-socket';
    const proxy = new HttpsProxySocket('https://my-proxy.test');

    const socket = await proxy.connect({host: 'myhost.test', port: 1234});

## Usage - mssql

    import sql from 'mssql'
    import { HttpsProxySocket, useProxyForTedious } from '@journeyapps/https-proxy-socket';

    const proxy = new HttpsProxySocket({
      /** Same as above */
    });

    /** Register the proxy globally for tedious/mssql */
    useProxyForTedious(proxy);

    async function run() {
      /** Connect using the proxy */
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
The socks package needs to be added to your package.json dependencies for this to work.
See the MongoDB documentation for details: https://www.mongodb.com/docs/drivers/node/current/security/socks/

    import * as mongo from 'mongodb';
    import { useProxyForMongo } from '@journeyapps/https-proxy-socket';

    const SRV_URI = 'mongodb+srv://<username>:<password>@cluster0.jzuewet.mongodb.net';
    const PROXY = 'us-cc-proxy.journeyapps.com'; // Or za-cc-proxy.journeyapps.com
    const PROXY_PORT = 443

    /**
     * Register the proxy globally for MongoDB 
     * This retuens a close function to end the socket   
     */
    const { close } = useProxyForMongo({
      proxy: PROXY,
      auth: <egress_token> // See JourneyApps MongoDB Token section below
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
        close()
        await client.close();
      }
    }

    run().catch(console.error);
## JourneyApps MongoDB Token
Using the Mongo Atlas usually means the connection is a SRV string. Under the hood Mongo driver converts this to a standard connection string. 
When the driver opens socket connections it will have one for each replica set member. These connections will need to be allowed by the CloudCode egress proxy to work.  
Prior contacting JourneyApps support, get your SRV string and run the following:
```bash
# your SRV is mongodb+srv://<username>:<password>@cluster1.vlnzcbp.mongodb.net
# You can run it with the included credentials
npx @journeyapps/https-proxy-socket mongo-replicas mongodb+srv://your_username:your_password@cluster1.vlnzcbp.mongodb.net
# Or without
npx @journeyapps/https-proxy-socket mongo-replicas mongodb+srv://cluster1.vlnzcbp.mongodb.net
```
This will output the below to your console:
```js
{
  replicas: 'ac-mayaavr-shard-00-02.vlnzcbp.mongodb.net:27017,ac-mayaavr-shard-00-01.vlnzcbp.mongodb.net:27017,ac-mayaavr-shard-00-00.vlnzcbp.mongodb.net:27017'
}
```
When requesting the token from JourneyApps support, please provide the replicas string as well.