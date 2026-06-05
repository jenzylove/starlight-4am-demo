import { useMemo, useState, useEffect } from "react";
import { Sparkles, Flame, Users, Copy, Trophy, Zap, ArrowLeftRight, Droplets, MinusCircle, Gift, Clock, ExternalLink } from "lucide-react";
import { useWallet, Activity } from "@/store/wallet";
import { toast } from "sonner";
import { useAccount } from "wagmi";
import { upsertLeaderboard, fetchLeaderboard, LeaderboardEntry } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const StatCard = ({
  icon: Icon, label, value, sub, tone = "primary",
}: {
  icon: React.ElementType; label: string; value: React.ReactNode; sub?: string; tone?: "primary" | "accent" | "warning";
}) => {
  const toneMap = { primary: "bg-primary-soft text-primary", accent: "bg-accent-soft text-accent", warning: "bg-warning/10 text-warning" } as const;
  return (
    <div className="rounded-2xl bg-card border border-border p-5 shadow-card">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className={"h-8 w-8 rounded-lg grid place-items-center " + toneMap[tone]}><Icon className="h-4 w-4" /></div>
      </div>
      <div className="font-display text-2xl md:text-3xl font-bold tracking-tight">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
};

const activityConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  swap:     { icon: ArrowLeftRight, color: "bg-primary-soft text-primary",   label: "Swap"     },
  deposit:  { icon: Droplets,       color: "bg-accent-soft text-accent",      label: "Deposit"  },
  withdraw: { icon: MinusCircle,    color: "bg-warning/10 text-warning",      label: "Withdraw" },
  bridge:   { icon: ArrowLeftRight, color: "bg-purple-100 text-purple-600",   label: "Bridge"   },
  faucet:   { icon: Gift,           color: "bg-green-100 text-green-600",     label: "Faucet"   },
  daily:    { icon: Flame,          color: "bg-orange-100 text-orange-600",   label: "Daily"    },
};

const timeAgo = (timestamp: string) => {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs  < 24) return `${hrs}h ago`;
  return `${days}d ago`;
};

const ActivityFeed = ({ activities }: { activities: Activity[] }) => {
  if (activities.length === 0) {
    return (
      <div className="px-5 py-12 text-center">
        <Clock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No activity yet — start swapping to see your history!</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {activities.map((a) => {
        const cfg = activityConfig[a.type] ?? activityConfig.swap;
        const Icon = cfg.icon;
        return (
          <li key={a.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-secondary/30 transition-colors">
            {/* Icon */}
            <div className={cn("h-9 w-9 rounded-xl grid place-items-center shrink-0", cfg.color)}>
              <Icon className="h-4 w-4" />
            </div>

            {/* Description */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{a.description}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground">{timeAgo(a.timestamp)}</span>
                {a.txHash && (
                  <a
                    href={`https://testnet.arcscan.app/tx/${a.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline"
                  >
                    View <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
              </div>
            </div>

            {/* Points badge */}
            {a.points && a.points > 0 ? (
              <div className="shrink-0 inline-flex items-center gap-1 rounded-full bg-primary-soft text-primary px-2.5 py-1 text-xs font-bold">
                <Sparkles className="h-3 w-3" />
                +{a.points} pts
              </div>
            ) : (
              a.amount && (
                <div className="shrink-0 text-xs font-mono text-muted-foreground">
                  {a.amount} {a.token}
                </div>
              )
            )}
          </li>
        );
      })}
    </ul>
  );
};

export const PointsDashboard = () => {
  const { connected, points, streakDays, lastClaimDate, swapsCount, volumeUsd, referralCode, referrals, claimDaily, activities } = useWallet();
  const { address } = useAccount();
  const [globalBoard, setGlobalBoard] = useState<LeaderboardEntry[]>([]);

  const today = new Date().toISOString().slice(0, 10);
  const claimedToday = lastClaimDate === today;

  useEffect(() => {
    if (!address || points === 0) return;
    upsertLeaderboard(address, points, swapsCount, volumeUsd);
  }, [address, points, swapsCount, volumeUsd]);

  useEffect(() => {
    const load = async () => {
      const data = await fetchLeaderboard();
      setGlobalBoard(data);
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const onClaim = () => {
    const r = claimDaily();
    if (!r.ok) {
      toast.info("Already claimed today", { description: "Come back tomorrow for your streak bonus" });
      return;
    }
    toast.success("+" + r.gained + " Starlight Points claimed!", { description: "🔥 " + r.newStreak + "-day streak" });
  };
  recordActivity({
  type: "daily",
  description: `Daily check-in — ${r.newStreak}-day streak`,
  points: r.gained,
});

  const userBoard = globalBoard.map((entry, i) => ({
    rank: i + 1,
    addr: entry.wallet_address === address ? "You" : entry.wallet_address.slice(0, 6) + "…" + entry.wallet_address.slice(-4),
    pts: entry.points,
    isYou: entry.wallet_address === address,
  }));

  const refLink = "https://starlight-arc.vercel.app/r/" + referralCode;

  return (
    <section id="points" className="bg-gradient-hero border-y border-border">
      <div className="container py-20">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-gradient-points text-primary-foreground px-3 py-1 text-xs font-semibold mb-3">
            <Sparkles className="h-3.5 w-3.5" />
            Season 1 · Points farming
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight">Every action earns Starlight Points</h2>
          <p className="text-muted-foreground mt-3">Swap, deposit, log in daily, invite friends. Points convert to rewards at season end.</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-3xl bg-gradient-points text-primary-foreground p-6 md:p-8 shadow-elev-lg relative overflow-hidden">
            <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-2xl" aria-hidden />
            <div className="absolute right-10 bottom-0 h-40 w-40 rounded-full bg-white/10 blur-2xl" aria-hidden />
            <div className="relative">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium opacity-80">Your Starlight Points</span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold rounded-full bg-white/15 backdrop-blur px-2.5 py-1">
                  <Flame className="h-3.5 w-3.5" /> {streakDays}-day streak
                </span>
              </div>
              <div className="font-display text-5xl md:text-6xl font-bold tracking-tight">{points.toLocaleString()}</div>
              <div className="text-sm opacity-80 mt-1">{connected ? "Keep interacting to climb the leaderboard." : "Connect your wallet to start farming."}</div>
              <div className="mt-6 grid grid-cols-3 gap-2 md:gap-3">
                <div className="rounded-2xl bg-white/10 backdrop-blur p-3">
                  <div className="text-[10px] uppercase tracking-wider opacity-70">Swaps</div>
                  <div className="font-display text-xl font-bold mt-1">{swapsCount}</div>
                </div>
                <div className="rounded-2xl bg-white/10 backdrop-blur p-3">
                  <div className="text-[10px] uppercase tracking-wider opacity-70">Volume</div>
                  <div className="font-display text-xl font-bold mt-1">${volumeUsd >= 1000 ? (volumeUsd / 1000).toFixed(1) + "K" : volumeUsd.toFixed(0)}</div>
                </div>
                <div className="rounded-2xl bg-white/10 backdrop-blur p-3">
                  <div className="text-[10px] uppercase tracking-wider opacity-70">Referrals</div>
                  <div className="font-display text-xl font-bold mt-1">{referrals}</div>
                </div>
              </div>
              <Button variant="secondary" size="lg" className="mt-6 bg-white text-primary hover:bg-white/90" onClick={onClaim} disabled={!connected || claimedToday}>
                <Zap className="h-4 w-4" />
                {!connected ? "Connect wallet to claim" : claimedToday ? "Claimed today · come back tomorrow" : "Claim daily +" + (50 + Math.min(streakDays + 1, 30) * 10) + " pts"}
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <StatCard icon={Sparkles} label="Per $1 swap" value="1 pt" tone="primary" />
              <StatCard icon={Flame} label="Daily bonus" value={"+" + (50 + Math.min(streakDays + 1, 30) * 10)} sub="Tomorrow" tone="warning" />
            </div>
            <div className="rounded-2xl bg-card border border-border p-5 shadow-card">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-accent" />
                <span className="text-sm font-semibold">Referral link</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">Earn 10% of all points your friends farm.</p>
              <div className="flex items-center gap-2 rounded-xl bg-secondary p-2 pl-3">
                <code className="flex-1 text-xs font-mono truncate">{refLink}</code>
                <Button variant="default" size="sm" className="rounded-lg" onClick={() => { navigator.clipboard.writeText(refLink); toast.success("Referral link copied"); }}>
                  <Copy className="h-3.5 w-3.5" /> Copy
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="mt-10 rounded-3xl bg-card border border-border shadow-card overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-warning" />
              <h3 className="font-display text-lg font-semibold">Season 1 leaderboard</h3>
            </div>
            <span className="text-xs text-muted-foreground">Live · updates every 30s</span>
          </div>
          <ul className="divide-y divide-border">
            {userBoard.length === 0 ? (
              <li className="px-5 py-8 text-center text-sm text-muted-foreground">
                No entries yet — be the first on the board! 🏆
              </li>
            ) : (
              userBoard.map((row) => (
                <li key={row.rank + row.addr} className={"flex items-center gap-4 px-5 py-3 " + (row.isYou ? "bg-primary-soft" : "")}>
                  <div className={"h-8 w-8 rounded-lg grid place-items-center font-bold text-sm " + (row.rank === 1 ? "bg-warning text-warning-foreground" : row.rank === 2 ? "bg-muted text-foreground" : row.rank === 3 ? "bg-amber-200 text-amber-900" : "bg-secondary text-muted-foreground")}>
                    {row.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={"font-mono text-sm " + (row.isYou ? "text-primary font-bold" : "font-medium")}>{row.addr}</div>
                  </div>
                  <div className="font-display font-bold tabular-nums">
                    {row.pts.toLocaleString()} <span className="text-xs text-muted-foreground font-normal">pts</span>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* Activity Feed */}
        <div className="mt-6 rounded-3xl bg-card border border-border shadow-card overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <h3 className="font-display text-lg font-semibold">Activity history</h3>
            </div>
            <span className="text-xs text-muted-foreground">Last 50 actions</span>
          </div>
          <ActivityFeed activities={activities} />
        </div>

      </div>
    </section>
  );
};