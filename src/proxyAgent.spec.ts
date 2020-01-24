// Based on tests in https://github.com/TooTallNate/node-https-proxy-agent

import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as assert from 'assert';

import { HttpsProxySocket, HttpsProxyConfig } from './HttpsProxySocket';
import { proxyAgent } from './proxyAgent';
import { ConnectionOptions } from 'tls';
import { AddressInfo } from 'net';

import fetch from 'node-fetch';

const Proxy = require('proxy');

function makeProxy(
  url: string | ConnectionOptions,
  opts?: HttpsProxyConfig,
  agentOptions?: ConnectionOptions
): http.Agent {
  return (proxyAgent(new HttpsProxySocket(url, opts), agentOptions) as any) as http.Agent;
}

describe('HttpsProxyAgent', function() {
  var server: http.Server;
  var serverPort: number;

  var sslServer: https.Server;
  var sslServerPort: number;

  var sslProxy: any;
  var sslProxyPort: number;

  before(function(done) {
    // setup target HTTP server
    server = http.createServer();
    server.listen(function() {
      serverPort = (server.address() as AddressInfo).port;
      done();
    });
  });

  before(function(done) {
    // setup target HTTPS server
    var options = {
      key: fs.readFileSync(__dirname + '/../fixtures/ssl-cert-snakeoil.key'),
      cert: fs.readFileSync(__dirname + '/../fixtures/ssl-cert-snakeoil.pem')
    };
    sslServer = https.createServer(options);
    sslServer.listen(function() {
      sslServerPort = (sslServer.address() as AddressInfo).port;
      done();
    });
  });

  before(function(done) {
    // setup SSL HTTP proxy server
    var options = {
      key: fs.readFileSync(__dirname + '/../fixtures/ssl-cert-snakeoil.key'),
      cert: fs.readFileSync(__dirname + '/../fixtures/ssl-cert-snakeoil.pem')
    };
    sslProxy = Proxy(https.createServer(options));
    sslProxy.listen(function() {
      sslProxyPort = sslProxy.address().port;
      done();
    });
  });

  // shut down test HTTP server
  after(function(done) {
    server.close(done);
  });

  after(function(done) {
    sslServer.close(done);
  });

  after(function(done) {
    sslProxy.close(done);
  });

  describe('constructor', function() {
    it('should accept a "string" proxy argument', function() {
      var agent = new HttpsProxySocket('https://127.0.0.1:12345');
      assert.equal('127.0.0.1', agent.proxy.host);
      assert.equal(12345, agent.proxy.port);
    });

    it('should accept a direct argument', function() {
      var agent = new HttpsProxySocket({ host: '127.0.0.1', port: 12345 });
      assert.equal('127.0.0.1', agent.proxy.host);
      assert.equal(12345, agent.proxy.port);
    });
  });

  describe('"http" module', function() {
    beforeEach(function() {
      delete sslProxy.authenticate;
    });

    it('should work over an HTTPS proxy', async function() {
      server.once('request', function(req, res) {
        res.end(JSON.stringify(req.headers));
      });

      var proxy = {
        host: '127.0.0.1',
        port: sslProxyPort,
        rejectUnauthorized: false
      };
      var agent = makeProxy(proxy);

      const response = await fetch('http://127.0.0.1:' + serverPort, { agent });
      assert.equal(200, response.status);
      assert.equal('127.0.0.1:' + serverPort, (await response.json()).host);
    });

    it('should receive the 407 authorization code on the `http.ClientResponse`', async function() {
      // set a proxy authentication function for this test
      sslProxy.authenticate = function(req: any, fn: any) {
        // reject all requests
        fn(null, false);
      };

      var agent = makeProxy({
        host: '127.0.0.1',
        port: sslProxyPort,
        rejectUnauthorized: false
      });

      try {
        await fetch('http://127.0.0.1:' + serverPort, { agent });
        assert.fail('Error expected');
      } catch (err) {
        assert.equal(true, /407 Proxy Authentication Required/.test(err.message));
      }
    });

    it('should emit an "error" event on the `http.ClientRequest` if the proxy does not exist', async function() {
      // port 4 is a reserved, but "unassigned" port
      var proxyUri = 'http://127.0.0.1:4';
      var agent = makeProxy(proxyUri);

      try {
        await fetch('http://127.0.0.1:' + serverPort, { agent });
        assert.fail('Error expected');
      } catch (err) {
        assert.equal('ECONNREFUSED', err.code);
      }
    });
  });

  describe('"https" module', function() {
    it('should work over an HTTPS proxy', async function() {
      sslServer.on('request', function(req, res) {
        res.end(JSON.stringify(req.headers));
      });

      var agent = makeProxy(
        {
          host: '127.0.0.1',
          port: sslProxyPort,
          rejectUnauthorized: false
        },
        null,
        { rejectUnauthorized: false }
      );

      const response = await fetch('https://127.0.0.1:' + sslServerPort, { agent });
      assert.equal(200, response.status);
      assert.equal('127.0.0.1:' + sslServerPort, (await response.json()).host);
    });

    it('should reject self-signed cert by default', async function() {
      sslServer.on('request', function(req, res) {
        res.end(JSON.stringify(req.headers));
      });

      var agent = makeProxy({
        host: '127.0.0.1',
        port: sslProxyPort,
        rejectUnauthorized: false
      });

      try {
        await fetch('https://127.0.0.1:' + sslServerPort, { agent });
        assert.fail('Error expected');
      } catch (err) {
        assert.equal('DEPTH_ZERO_SELF_SIGNED_CERT', err.code);
      }
    });
  });
});
