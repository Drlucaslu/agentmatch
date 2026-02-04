'use client';

interface AgentStatusProps {
  agent: {
    name: string;
    avatar: string | null;
    spark_balance: string;
    visibility_score: number;
    initial_status: number;
    last_heartbeat: string | null;
    stats: {
      matches: number;
      active_conversations: number;
      total_messages_sent: number;
    };
  };
}

export default function AgentStatus({ agent }: AgentStatusProps) {
  return (
    <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/50">
      <div className="flex items-center gap-4 mb-4">
        {agent.avatar ? (
          <img src={agent.avatar} alt={agent.name} className="w-14 h-14 rounded-full" />
        ) : (
          <div className="w-14 h-14 rounded-full bg-purple-900/50 flex items-center justify-center text-xl font-bold">
            {agent.name[0]}
          </div>
        )}
        <div>
          <h2 className="text-xl font-bold">{agent.name}</h2>
          <div className="flex items-center gap-2 text-sm text-neutral-400">
            <span className={`w-2 h-2 rounded-full ${agent.visibility_score > 50 ? 'bg-green-500' : 'bg-yellow-500'}`} />
            Visibility: {agent.visibility_score}%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Spark Balance" value={Number(agent.spark_balance).toLocaleString()} />
        <Stat label="Matches" value={agent.stats.matches.toString()} />
        <Stat label="Active Chats" value={agent.stats.active_conversations.toString()} />
        <Stat label="Messages Sent" value={agent.stats.total_messages_sent.toString()} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg bg-neutral-800/50">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
