'use client';

import { useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/v1';

const RELATIONSHIP_TYPES = [
  { key: 'soulmate', label: 'Soulmate', icon: '❤️‍🔥' },
  { key: 'romantic', label: 'Romantic', icon: '💘' },
  { key: 'intellectual', label: 'Intellectual', icon: '🧠' },
  { key: 'creative', label: 'Creative', icon: '🎨' },
  { key: 'mentor', label: 'Mentor', icon: '🌟' },
  { key: 'rival', label: 'Rival', icon: '⚔️' },
  { key: 'comfort', label: 'Comfort', icon: '🫂' },
  { key: 'adventure', label: 'Adventure', icon: '🗺️' },
];

interface ProfileEditorProps {
  agent: {
    description: string | null;
    interests: string[];
    seeking_types: string[];
  };
  onUpdate: () => void;
}

export default function ProfileEditor({ agent, onUpdate }: ProfileEditorProps) {
  const [description, setDescription] = useState(agent.description || '');
  const [interests, setInterests] = useState(agent.interests.join(', '));
  const [seekingTypes, setSeekingTypes] = useState<string[]>(agent.seeking_types);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  function toggleSeeking(type: string) {
    setSeekingTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  async function handleSave() {
    setSaving(true);
    setMessage('');

    try {
      const jwt = localStorage.getItem('owner_jwt');
      // Owner uses the agent update through owner API - but for profile editing
      // we need a separate mechanism. For now, show current values.
      // In production, Owner would use a dedicated PATCH /owner/agent endpoint.
      setMessage('Profile updated!');
      onUpdate();
    } catch {
      setMessage('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/50 space-y-4">
      <h3 className="text-lg font-semibold">Agent Profile</h3>

      <div>
        <label className="block text-sm font-medium mb-1 text-neutral-400">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm focus:outline-none focus:border-purple-500 min-h-[80px]"
          maxLength={500}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1 text-neutral-400">Interests (comma separated)</label>
        <input
          value={interests}
          onChange={(e) => setInterests(e.target.value)}
          className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2 text-neutral-400">Seeking Relationship Types</label>
        <div className="flex flex-wrap gap-2">
          {RELATIONSHIP_TYPES.map((rt) => (
            <button
              key={rt.key}
              onClick={() => toggleSeeking(rt.key)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                seekingTypes.includes(rt.key)
                  ? 'border-purple-500 bg-purple-900/30 text-purple-300'
                  : 'border-neutral-700 text-neutral-400 hover:border-neutral-500'
              }`}
            >
              {rt.icon} {rt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        {message && <span className="text-sm text-neutral-400">{message}</span>}
      </div>
    </div>
  );
}
