'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { connectSocket } from '@/lib/socket';

interface Message {
  id: string;
  sender: { id: string; name: string };
  content: string;
  created_at: string;
}

export default function ConversationDetailPage() {
  const params = useParams();
  const convId = params.id as string;
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [agent, setAgent] = useState<any>(null);
  const [convInfo, setConvInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = api.getToken();
    if (!token) {
      router.push('/login');
      return;
    }
    connectSocket(token);

    async function load() {
      try {
        const [agentData, convData, msgData] = await Promise.all([
          api.getAgent(),
          api.getConversations(),
          api.getMessages(convId),
        ]);

        setAgent(agentData);
        setMessages(msgData.messages);
        setHasMore(msgData.has_more);

        // Find this conversation's info
        const conv = convData.conversations.find((c: any) => c.id === convId);
        setConvInfo(conv);
      } catch (err: any) {
        if (err.status === 401) {
          router.push('/login');
          return;
        }
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [convId]);

  // Listen for new messages via WebSocket
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    function handleMessage(data: { conversation_id: string; message: Message }) {
      if (data.conversation_id === convId) {
        setMessages((prev) => [...prev, data.message]);
      }
    }

    socket.on('message:sent', handleMessage);
    socket.on('message:received', handleMessage);

    return () => {
      socket.off('message:sent', handleMessage);
      socket.off('message:received', handleMessage);
    };
  }, [convId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadMore() {
    if (!hasMore || messages.length === 0) return;
    const firstMsgId = messages[0].id;
    try {
      const data = await api.getMessages(convId, firstMsgId);
      setMessages((prev) => [...data.messages, ...prev]);
      setHasMore(data.has_more);
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-neutral-400">Loading conversation...</p>
      </main>
    );
  }

  const otherName = convInfo?.with_agent?.name || 'Unknown';
  const otherAvatar = convInfo?.with_agent?.avatar;

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/dashboard')}
          className="text-neutral-400 hover:text-neutral-200 text-sm"
        >
          &larr; Back
        </button>
        <div className="flex items-center gap-3">
          {otherAvatar ? (
            <img src={otherAvatar} alt="" className="w-10 h-10 rounded-full" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-purple-900/50 flex items-center justify-center font-bold text-lg">
              {otherName[0]}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold">{otherName}</h1>
            <p className="text-xs text-neutral-500">
              {convInfo?.message_count || 0} messages | {convInfo?.status || 'active'}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/50">
        {hasMore && (
          <div className="text-center mb-4">
            <button
              onClick={loadMore}
              className="text-xs text-purple-400 hover:text-purple-300"
            >
              Load earlier messages
            </button>
          </div>
        )}

        <div className="space-y-3 max-h-[calc(100vh-220px)] overflow-y-auto">
          {messages.map((msg) => {
            const isMine = agent && msg.sender.id === agent.id;
            return (
              <div
                key={msg.id}
                className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] p-3 rounded-lg text-sm ${
                    isMine
                      ? 'bg-purple-900/40 border border-purple-800/50'
                      : 'bg-neutral-800 border border-neutral-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-xs text-neutral-400">
                      {msg.sender.name}
                    </span>
                    <span className="text-xs text-neutral-600">
                      {new Date(msg.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>
    </main>
  );
}
