import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as assert from 'assert';
import { createProxy } from 'proxy';
import { describe, afterEach, it, beforeEach } from 'vitest';

import { HttpsProxySocket, HttpsProxyConfig } from '../HttpsProxySocket';
import { proxyAgent } from '../proxyAgent';
import { ConnectionOptions } from 'tls';
import { AddressInfo } from 'net';

import fetch from 'node-fetch';

function makeProxy(
  url: string | ConnectionOptions,
  opts?: HttpsProxyConfig,
  agentOptions?: ConnectionOptions,
): http.Agent {
  return proxyAgent(new HttpsProxySocket(url, opts), agentOptions) as any as http.Agent;
}

describe('HttpsProxyAgent', function () {
  let server: http.Server;
  let serverPort: number;

  let sslServer: https.Server;
  let sslServerPort: number;

  let sslProxy: any;
  let sslProxyPort: number;
  beforeEach(() => {
    server = http.createServer();
    server.listen();
    serverPort = (server.address() as AddressInfo).port;

    // setup target HTTPS server
    const serverOptions = {
      key: fs.readFileSync(__dirname + '/../../fixtures/ssl-cert-snakeoil.key'),
      cert: fs.readFileSync(__dirname + '/../../fixtures/ssl-cert-snakeoil.pem'),
    };
    sslServer = https.createServer(serverOptions);
    sslServer.listen();
    sslServerPort = (sslServer.address() as AddressInfo).port;

    // setup SSL HTTP proxy server
    const proxyOptions = {
      key: fs.readFileSync(__dirname + '/../../fixtures/ssl-cert-snakeoil.key'),
      cert: fs.readFileSync(__dirname + '/../../fixtures/ssl-cert-snakeoil.pem'),
    };
    sslProxy = createProxy(https.createServer(proxyOptions));
    sslProxy.listen();
    sslProxyPort = sslProxy.address().port;
  });

  afterEach(() => {
    server.close();
    sslServer.close();
    sslProxy.close();
  });

  describe('constructor', function () {
    it('should accept a "string" proxy argument', function () {
      const agent = new HttpsProxySocket('https://127.0.0.1:12345');
      assert.equal('127.0.0.1', agent.proxy.host);
      assert.equal(12345, agent.proxy.port);
    });

    it('should accept a direct argument', function () {
      const agent = new HttpsProxySocket({ host: '127.0.0.1', port: 12345 });
      assert.equal('127.0.0.1', agent.proxy.host);
      assert.equal(12345, agent.proxy.port);
    });
  });

  describe('"http" module', function () {
    beforeEach(() => {
      delete sslProxy.authenticate;
    });

    it('should work over an HTTPS proxy', async function () {
      server.once('request', function (req, res) {
        res.end(JSON.stringify(req.headers));
      });

      const proxy = {
        host: '127.0.0.1',
        servername: 'localhost',
        port: sslProxyPort,
        rejectUnauthorized: false,
      };
      const agent = makeProxy(proxy);
      const response = await fetch('http://127.0.0.1:' + serverPort, { agent });
      assert.equal(200, response.status);
      assert.equal('127.0.0.1:' + serverPort, (await response.json()).host);
    });

    it('should receive the 407 authorization code on the `http.ClientResponse`', async function () {
      // set a proxy authentication function for this test
      sslProxy.authenticate = () => false;
      const agent = makeProxy({
        host: '127.0.0.1',
        servername: 'localhost',
        port: sslProxyPort,
        rejectUnauthorized: false,
      });

      try {
        await fetch('http://127.0.0.1:' + serverPort, { agent });
        assert.fail('Error expected');
      } catch (err: any) {
        assert.equal(true, /407 Proxy Authentication Required/.test(err.message));
      }
    });

    it('should emit an "error" event on the `http.ClientRequest` if the proxy does not exist', async function () {
      // port 4 is a reserved, but "unassigned" port
      const proxyUri = 'http://127.0.0.1:4';
      const agent = makeProxy(proxyUri);

      try {
        await fetch('http://127.0.0.1:' + serverPort, { agent });
        assert.fail('Error expected');
      } catch (err: any) {
        assert.equal('ECONNREFUSED', err.code);
      }
    });
  });

  describe('"https" module', function () {
    it('should work over an HTTPS proxy', async function () {
      sslServer.on('request', function (req, res) {
        res.end(JSON.stringify(req.headers));
      });

      const agent = makeProxy(
        {
          host: '127.0.0.1',
          servername: 'localhost',
          port: sslProxyPort,
          rejectUnauthorized: false,
        },
        undefined,
        { rejectUnauthorized: false },
      );

      const response = await fetch('https://127.0.0.1:' + sslServerPort, { agent });
      assert.equal(200, response.status);
      assert.equal('127.0.0.1:' + sslServerPort, (await response.json()).host);
    });

    // TODO: REDO THE TEST WITH A VALID CERT

    // it('should reject self-signed cert by default', async function() {
    //   sslServer.on('request', function(req, res) {
    //     res.end(JSON.stringify(req.headers));
    //   });
    //
    //   const agent = makeProxy({
    //     host: '127.0.0.1',
    //     port: sslProxyPort,
    //     rejectUnauthorized: false
    //   });
    //
    //   try {
    //     await fetch('https://127.0.0.1:' + sslServerPort, { agent });
    //     assert.fail('Error expected');
    //   } catch (err: any) {
    //     assert.equal('DEPTH_ZERO_SELF_SIGNED_CERT', err.code);
    //   }
    // });
  });
});
