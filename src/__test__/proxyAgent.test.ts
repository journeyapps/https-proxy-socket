import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import { createProxy } from 'proxy';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import listen from 'async-listen';
import { HttpsProxyConfig, HttpsProxySocket } from '../HttpsProxySocket';
import { createProxyAgent } from '../createProxyAgent';
import { ConnectionOptions } from 'tls';
import { AddressInfo } from 'net';
import fetch from 'node-fetch';

function makeProxy(
  url: string | ConnectionOptions,
  opts?: HttpsProxyConfig,
  agentOptions?: ConnectionOptions,
): http.Agent {
  return createProxyAgent(new HttpsProxySocket(url, opts), agentOptions) as any as http.Agent;
}

describe('HttpsProxyAgent', function () {
  let server: http.Server;
  let serverPort: number;

  let sslServer: https.Server;
  let sslServerPort: number;

  let sslProxy: any;
  let sslProxyPort: number;
  beforeAll(async () => {
    server = http.createServer();
    await listen(server);
    serverPort = (server.address() as AddressInfo).port;
  });

  beforeAll(async () => {
    const serverOptions = {
      key: fs.readFileSync(__dirname + '/../../fixtures/ssl-cert-snakeoil-key.pem'),
      cert: fs.readFileSync(__dirname + '/../../fixtures/ssl-cert-snakeoil.pem'),
    };
    sslServer = https.createServer(serverOptions);
    await listen(sslServer);
    sslServerPort = (sslServer.address() as AddressInfo).port;
  });

  beforeAll(async () => {
    const proxyOptions = {
      key: fs.readFileSync(__dirname + '/../../fixtures/ssl-cert-snakeoil-key.pem'),
      cert: fs.readFileSync(__dirname + '/../../fixtures/ssl-cert-snakeoil.pem'),
    };
    sslProxy = createProxy(https.createServer(proxyOptions));
    await listen(sslProxy);
    sslProxyPort = sslProxy.address().port;
  });

  afterAll(() => {
    server.close();
    sslServer.close();
    sslProxy.close();
  });

  describe('constructor', function () {
    it('should accept a "string" proxy argument', function () {
      const agent = new HttpsProxySocket('https://127.0.0.1:12345');
      expect(agent.proxy.host).toBe('127.0.0.1');
      expect(agent.proxy.port).toBe(12345);
    });

    it('should accept a direct argument', function () {
      const agent = new HttpsProxySocket({ host: '127.0.0.1', port: 12345 });
      expect(agent.proxy.host).toBe('127.0.0.1');
      expect(agent.proxy.port).toBe(12345);
    });
  });

  describe('"http" module', function () {
    beforeEach(() => {
      delete sslProxy.authenticate;
    });

    it('should work over an HTTPS proxy', async function () {
      const SERVER_URL = `http://127.0.0.1:${serverPort}`;
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
      const response = await fetch(SERVER_URL, { agent });
      expect(response.status).toBe(200);
      expect(((await response.json()) as any).host).toBe('127.0.0.1:' + serverPort);
    });

    it('should receive the 407 authorization code on the `http.ClientResponse`', async function () {
      const SERVER_URL = `http://127.0.0.1:${serverPort}`;
      // set a proxy authentication function for this test
      sslProxy.authenticate = () => false;
      const agent = makeProxy({
        host: '127.0.0.1',
        servername: 'localhost',
        port: sslProxyPort,
        rejectUnauthorized: false,
      });

      try {
        await fetch(SERVER_URL, { agent });
      } catch (err: any) {
        expect(/407 Proxy Authentication Required/.test(err.message)).toBe(true);
      }
    });

    it('should emit an "error" event on the `http.ClientRequest` if the proxy does not exist', async function () {
      const SERVER_URL = `http://127.0.0.1:${serverPort}`;
      // port 4 is a reserved, but "unassigned" port
      const proxyUri = 'http://127.0.0.1:4';
      const agent = makeProxy(proxyUri);

      try {
        await fetch(SERVER_URL, { agent });
      } catch (err: any) {
        expect(err.code).toBe('ECONNREFUSED');
      }
    });
  });

  describe('"https" module', function () {
    it('should work over an HTTPS proxy', async function () {
      const SERVER_URL = `https://127.0.0.1:${sslServerPort}`;
      sslServer.on('request', function (req, res) {
        res.end(JSON.stringify(req.headers));
      });
      const agent = makeProxy(
        {
          host: '127.0.0.1',
          port: sslProxyPort,
          rejectUnauthorized: false,
        },
        undefined,
        { rejectUnauthorized: false },
      );

      const response = await fetch(SERVER_URL, { agent });
      expect(response.status).toBe(200);
      expect(((await response.json()) as any).host).toBe(`127.0.0.1:${sslServerPort}`);
    });

    it('should reject self-signed cert by default', async function () {
      const SERVER_URL = `https://127.0.0.1:${sslServerPort}`;
      sslServer.on('request', function (req, res) {
        res.end(JSON.stringify(req.headers));
      });

      const agent = makeProxy({
        host: '127.0.0.1',
        port: sslProxyPort,
        rejectUnauthorized: false,
      });

      try {
        await fetch(SERVER_URL, { agent });
      } catch (err: any) {
        expect(err.code).toBe('DEPTH_ZERO_SELF_SIGNED_CERT');
      }
    });
  });
});
