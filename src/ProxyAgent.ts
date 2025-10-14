import { Agent, AgentConnectOpts } from 'agent-base';
import * as http from 'http';
import * as tls from 'tls';
import { HttpsProxySocket } from './HttpsProxySocket';

export class ProxyAgent extends Agent {
  constructor(
    public proxy: HttpsProxySocket,
    public agentOptions?: http.AgentOptions,
  ) {
    super(agentOptions);
  }
  async connect(req: http.ClientRequest, options: AgentConnectOpts) {
    const socket = await this.proxy.connect(options as any);
    if (options.secureEndpoint) {
      let tlsOptions: tls.ConnectionOptions = {
        socket: socket,
        servername: options.servername || options.host,
      };
      if (typeof options.rejectUnauthorized != 'undefined') {
        tlsOptions.rejectUnauthorized = options.rejectUnauthorized;
      }
      Object.assign(tlsOptions, this.agentOptions);
      return tls.connect(tlsOptions);
    } else {
      socket.resume();
      return socket;
    }
  }
}
