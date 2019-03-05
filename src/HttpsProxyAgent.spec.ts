/**
 * Module dependencies.
 */

import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as assert from 'assert';
import * as url from 'url';

import { HttpsProxySocket, HttpsProxyConfig } from './HttpsProxySocket';
import { agent as proxyAgent } from './HttpsProxyAgent';
import { ConnectionOptions } from 'tls';
import { AddressInfo } from 'net';

const Proxy = require('proxy');

function makeProxy(url: string | ConnectionOptions, opts?: HttpsProxyConfig): http.Agent {
  return (proxyAgent(new HttpsProxySocket(url, opts)) as any) as http.Agent;
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
    server.once('close', function() {
      done();
    });
    server.close();
  });

  after(function(done) {
    sslServer.once('close', function() {
      done();
    });
    sslServer.close();
  });

  after(function(done) {
    sslProxy.once('close', function() {
      done();
    });
    sslProxy.close();
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

    it('should work over an HTTPS proxy', function(done) {
      server.once('request', function(req, res) {
        res.end(JSON.stringify(req.headers));
      });

      var proxy = {
        host: '127.0.0.1',
        port: sslProxyPort,
        rejectUnauthorized: false
      };
      var agent = makeProxy(proxy);
      const opts = {
        ...url.parse('http://127.0.0.1:' + serverPort),
        agent
      };

      http.get(opts, function(res) {
        var data = '';
        res.setEncoding('utf8');
        res.on('data', function(b) {
          data += b;
        });
        res.on('end', function() {
          const parsed = JSON.parse(data);
          assert.equal('127.0.0.1:' + serverPort, parsed.host);
          done();
        });
      });
    });
    it('should receive the 407 authorization code on the `http.ClientResponse`', function(done) {
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

      // `host` and `port` don't really matter since the proxy will reject anyways
      var opts = {
        host: '127.0.0.1',
        port: 80,
        agent: agent
      };

      var req = http.get(opts);
      req.once('error', function(err: any) {
        assert.equal('Proxy connection failed: HTTP/1.1 407 Proxy Authentication Required', err.message);
        req.abort();
        done();
      });
    });
    it('should emit an "error" event on the `http.ClientRequest` if the proxy does not exist', function(done) {
      // port 4 is a reserved, but "unassigned" port
      var proxyUri = 'http://127.0.0.1:4';
      var agent = makeProxy(proxyUri);

      const opts = {
        ...url.parse('http://nodejs.org'),
        agent
      };

      var req = http.get(opts);
      req.once('error', function(err: any) {
        assert.equal('ECONNREFUSED', err.code);
        req.abort();
        done();
      });
    });
  });

  describe('"https" module', function() {
    it('should work over an HTTPS proxy', function(done) {
      sslServer.on('request', function(req, res) {
        res.end(JSON.stringify(req.headers));
      });

      var agent = makeProxy({
        host: '127.0.0.1',
        port: sslProxyPort,
        rejectUnauthorized: false
      });

      const opts = {
        ...url.parse('https://127.0.0.1:' + sslServerPort),
        agent,
        rejectUnauthorized: false
      };

      https.get(opts, function(res) {
        var data = '';
        res.setEncoding('utf8');
        res.on('data', function(b) {
          data += b;
        });
        res.on('end', function() {
          const parsed = JSON.parse(data);
          assert.equal('127.0.0.1:' + sslServerPort, parsed.host);
          done();
        });
      });
    });
  });
});
