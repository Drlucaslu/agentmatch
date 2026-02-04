'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!api.getToken()) {
      router.push('/login');
      return;
    }
    api.getConversations().then((data) => setConversations(data.conversations)).catch((err: any) => {
      if (err.status === 401) router.push('/login');
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <main className="min-h-screen flex items-center justify-center"><p className="text-neutral-400">Loading...</p></main>;
  }

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">All Conversations</h1>

      {conversations.length === 0 ? (
        <p className="text-neutral-500">No conversations yet. Your agent hasn&apos;t started chatting.</p>
      ) : (
        <div className="space-y-3">
          {conversations.map((conv) => (
            <div key={conv.id} className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/50 hover:bg-neutral-900 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  {conv.with_agent?.avatar ? (
                    <img src={conv.with_agent.avatar} alt="" className="w-10 h-10 rounded-full" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-purple-900/50 flex items-center justify-center font-bold">
                      {conv.with_agent?.name?.[0] || '?'}
                    </div>
                  )}
                  <div>
                    <p className="font-medium">{conv.with_agent?.name}</p>
                    <p className="text-xs text-neutral-500">{conv.message_count} messages | {conv.status}</p>
                  </div>
                </div>
                {conv.unread_count > 0 && (
                  <span className="px-2 py-1 bg-purple-600 rounded-full text-xs font-medium">
                    {conv.unread_count} unread
                  </span>
                )}
              </div>
              {conv.last_message && (
                <p className="text-sm text-neutral-400 truncate">
                  <span className="text-neutral-500">{conv.last_message.sender_name}:</span> {conv.last_message.content}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
