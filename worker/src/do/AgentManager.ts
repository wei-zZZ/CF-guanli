export type Command = {
  id: string;
  action: string;
  args?: Record<string, unknown>;
  createdAt: number;
};

type State = {
  online: boolean;
  lastSeen: number;
  info: Record<string, unknown>;
  commands: Command[];
};

export class AgentManager {
  state: DurableObjectState;
  env: any;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
  }

  async getState(): Promise<State> {
    return (await this.state.storage.get<State>('state')) || {
      online: false,
      lastSeen: 0,
      info: {},
      commands: []
    };
  }

  async saveState(s: State) {
    await this.state.storage.put('state', s);
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const state = await this.getState();

    if (req.method === 'POST' && url.pathname === '/heartbeat') {
      state.online = true;
      state.lastSeen = Date.now();
      try { state.info = await req.json(); } catch {}
      await this.saveState(state);
      return Response.json({ ok: true });
    }

    if (req.method === 'POST' && url.pathname === '/command') {
      const body = await req.json() as { action: string; args?: Record<string, unknown> };
      const command: Command = {
        id: crypto.randomUUID(),
        action: body.action,
        args: body.args,
        createdAt: Date.now()
      };
      state.commands.push(command);
      await this.saveState(state);
      return Response.json(command);
    }

    if (req.method === 'GET' && url.pathname === '/poll') {
      const deadline = Date.now() + 45000;
      while (Date.now() < deadline) {
        const fresh = await this.getState();
        if (fresh.commands.length) {
          const command = fresh.commands.shift()!;
          await this.saveState(fresh);
          return Response.json({ command });
        }
        await new Promise(r => setTimeout(r, 1000));
      }
      return Response.json({ command: null });
    }

    if (req.method === 'GET' && url.pathname === '/state') {
      return Response.json(state);
    }

    return new Response('Not Found', { status: 404 });
  }
}
