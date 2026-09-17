import { useState, useEffect } from 'react';
import Head from 'next/head';
import { Activity, Server, Cpu, Database, Terminal, Globe } from 'lucide-react';

export default function Home() {
  const [agents, setAgents] = useState([]);

  useEffect(() => {
    // Fetch agent statuses from your local endpoints
    const endpoints = [
      { name: 'OpenFang', url: '/api/openfang/health' },
      { name: 'ArmaraOS', url: '/api/armaraos/health' },
      { name: 'FerroClaw', url: '/api/ferroclaw/health' },
      { name: 'Telethon', url: '/api/telethon/health' },
      { name: 'n8n', url: '/api/n8n/health' },
      { name: 'Flowise', url: '/api/flowise/health' },
      { name: 'Open WebUI', url: '/api/openwebui/health' },
      { name: 'vLLM', url: '/api/vllm/health' },
    ];
    Promise.all(endpoints.map(async (ep) => {
      try {
        const res = await fetch(ep.url);
        const status = res.ok ? 'online' : 'offline';
        return { ...ep, status };
      } catch { return { ...ep, status: 'offline' }; }
    })).then(setAgents);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white">
      <Head>
        <title>cs3_forge • Sovereign Agent Fleet</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-600">
              cs3_forge
            </h1>
            <p className="text-gray-400 mt-2">Sovereign AI Agent Fleet • 40+ frameworks</p>
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-2 bg-white/5 backdrop-blur rounded-full px-4 py-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm">Tailnet Active</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <StatCard title="Active Agents" value={agents.filter(a => a.status === 'online').length} icon={Activity} />
          <StatCard title="Total Frameworks" value="42" icon={Server} />
          <StatCard title="GPU Memory" value="22.4 GB" icon={Cpu} />
          <StatCard title="Knowledge Graph" value="1.2M entries" icon={Database} />
        </div>

        <h2 className="text-2xl font-semibold mb-6">Agent Swarm</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <div key={agent.name} className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10 hover:bg-white/10 transition">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Terminal className="w-5 h-5 text-cyan-400" />
                  <span className="font-medium">{agent.name}</span>
                </div>
                <div className={`px-2 py-1 rounded-full text-xs ${agent.status === 'online' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {agent.status}
                </div>
              </div>
              <a href={`/${agent.name.toLowerCase().replace(/\s/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline mt-2 inline-block">
                Open Dashboard →
              </a>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center text-gray-500 text-xs">
          Powered by Tailscale • Caddy • vLLM • 30+ Rust agents
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon }) {
  return (
    <div className="bg-white/5 backdrop-blur rounded-xl p-6 border border-white/10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm">{title}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
        </div>
        <Icon className="w-8 h-8 text-cyan-400 opacity-80" />
      </div>
    </div>
  );
}
