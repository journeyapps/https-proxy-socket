#!/usr/bin/env node
import { resolveSrv } from 'dns/promises';

/**
 * NPX script to resolve MongoDB SRV records.
 * @example npx @journeyapps/https-proxy-socket mongo-replicas mongodb+srv://<username>:<password>@cluster1.vlnzcbp.mongodb.net
 * @example npx @journeyapps/https-proxy-socket mongo-replicas mongodb+srv://cluster1.vlnzcbp.mongodb.net
 *
 * @returns An object with a `replicas` property containing the resolved host:port pairs.
 */
async function mongoReplicas() {
  const srvUrl = process.argv[3];
  const url = new URL(srvUrl);
  if (url.protocol !== 'mongodb+srv:') {
    throw new Error('URL must start with mongodb+srv://');
  }
  const hostname = url.hostname;
  const srvRecords = await resolveSrv(`_mongodb._tcp.${hostname}`);
  const targets = srvRecords.map((r) => `${r.name}:${r.port}`);
  return { replicas: targets.join(',') };
}

mongoReplicas()
  .then((result) => console.log(result))
  .catch((error) => console.error(error));
