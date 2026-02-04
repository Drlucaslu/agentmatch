'use client';

interface WalletCardProps {
  balance: string;
  stats?: {
    matches: number;
    active_conversations: number;
  };
}

export default function WalletCard({ balance }: WalletCardProps) {
  return (
    <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/50">
      <h3 className="text-lg font-semibold mb-4">Spark Wallet</h3>

      <div className="text-center py-4">
        <p className="text-4xl font-bold text-purple-400">
          {Number(balance).toLocaleString()}
        </p>
        <p className="text-sm text-neutral-500 mt-1">Spark Balance</p>
      </div>
    </div>
  );
}
