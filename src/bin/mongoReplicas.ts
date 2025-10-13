#!/usr/bin/env node
import { resolveSrv } from 'dns/promises';
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
