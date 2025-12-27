import { useState, useEffect, useCallback, useRef, memo } from "react";
import {
  generateAnnoyingText,
  type BlockedSite,
  type UnlockMethod,
} from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  IconShieldLock,
  IconClock,
  IconHandStop,
  IconKeyboard,
  IconCheck,
  IconX,
  IconArrowRight,
  IconArrowLeft,
  IconLockOpen,
} from "@tabler/icons-react";

// Timer Challenge Component
const TimerChallenge = memo(function TimerChallenge({
  duration,
  onComplete,
}: {
  duration: number;
  onComplete: () => void;
}) {
  const [remaining, setRemaining] = useState(duration);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!started) return;

    if (remaining <= 0) {
      onComplete();
      return;
    }

    const timer = setInterval(() => {
      setRemaining((r) => r - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [started, remaining, onComplete]);

  const progress = ((duration - remaining) / duration) * 100;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="relative mx-auto w-32 h-32">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-muted/20"
            />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={264}
              strokeDashoffset={264 - (264 * progress) / 100}
              className="text-primary transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl font-mono font-bold">{remaining}</span>
          </div>
        </div>
      </div>

      {!started ? (
        <Button onClick={() => setStarted(true)} className="w-full" size="lg">
          <IconClock className="size-5" />
          Start {duration}s Timer
        </Button>
      ) : remaining > 0 ? (
        <p className="text-center text-muted-foreground text-sm">
          Wait for the timer to complete...
        </p>
      ) : (
        <div className="flex items-center justify-center gap-2 text-green-500">
          <IconCheck className="size-5" />
          <span>Timer complete!</span>
        </div>
      )}
    </div>
  );
});

// Hold Button Challenge Component
const HoldChallenge = memo(function HoldChallenge({
  duration,
  onComplete,
}: {
  duration: number;
  onComplete: () => void;
}) {
  const [holding, setHolding] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [completed, setCompleted] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleStart = useCallback(() => {
    setHolding(true);
  }, []);

  const handleEnd = useCallback(() => {
    setHolding(false);
    if (elapsed < duration) {
      setElapsed(0);
    }
  }, [elapsed, duration]);

  useEffect(() => {
    if (holding && !completed) {
      intervalRef.current = setInterval(() => {
        setElapsed((e) => {
          const newElapsed = e + 0.1;
          if (newElapsed >= duration) {
            setCompleted(true);
            setHolding(false);
            onComplete();
            return duration;
          }
          return newElapsed;
        });
      }, 100);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [holding, completed, duration, onComplete]);

  const progress = (elapsed / duration) * 100;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="h-4 bg-muted/20 rounded-full overflow-hidden mb-4">
          <div
            className={`h-full transition-all duration-100 rounded-full ${
              holding
                ? "bg-primary"
                : elapsed > 0 && !completed
                  ? "bg-destructive/50"
                  : "bg-primary"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-2xl font-mono font-bold">
          {elapsed.toFixed(1)}s / {duration}s
        </p>
      </div>

      {!completed ? (
        <>
          <Button
            onMouseDown={handleStart}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={handleStart}
            onTouchEnd={handleEnd}
            variant={holding ? "default" : "outline"}
            className={`w-full h-20 text-lg transition-all ${
              holding ? "scale-95 bg-primary" : ""
            }`}
            size="lg"
          >
            <IconHandStop className="size-6" />
            {holding ? "Keep Holding..." : "Hold to Unlock"}
          </Button>
          {elapsed > 0 && !holding && (
            <p className="text-center text-destructive text-sm">
              Don't let go! Progress has been reset.
            </p>
          )}
        </>
      ) : (
        <div className="flex items-center justify-center gap-2 text-green-500">
          <IconCheck className="size-5" />
          <span>Challenge complete!</span>
        </div>
      )}
    </div>
  );
});

// Type Challenge Component
const TypeChallenge = memo(function TypeChallenge({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const [targetText] = useState(() => generateAnnoyingText());
  const [inputText, setInputText] = useState("");
  const [completed, setCompleted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      const diff = Math.abs(newValue.length - inputText.length);
      if (diff > 1 && newValue.length > inputText.length) {
        return;
      }

      setInputText(newValue);

      if (newValue === targetText) {
        setCompleted(true);
        onComplete();
      }
    },
    [inputText, targetText, onComplete]
  );

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const charStatuses = targetText.split("").map((char, i) => {
    if (i >= inputText.length) return "pending";
    return inputText[i] === char ? "correct" : "incorrect";
  });

  return (
    <div className="space-y-4">
      <div>
        <div className="flex justify-between text-sm text-muted-foreground mb-2">
          <p>Type this text exactly:</p>
          <p>
            {inputText.length}/{targetText.length}
          </p>
        </div>
        <div className="p-3 bg-muted/30 rounded-lg overflow-hidden flex justify-center">
          <code className="text-sm font-mono tracking-wider whitespace-nowrap">
            {targetText.split("").map((char, i) => (
              <span
                key={i}
                className={`${
                  charStatuses[i] === "correct"
                    ? "text-green-500"
                    : charStatuses[i] === "incorrect"
                      ? "text-destructive bg-destructive/20"
                      : "text-muted-foreground"
                }`}
              >
                {char}
              </span>
            ))}
          </code>
        </div>
      </div>

      {!completed ? (
        <Input
          ref={inputRef}
          value={inputText}
          onChange={handleInput}
          onPaste={handlePaste}
          onDrop={handleDrop}
          placeholder="Start typing..."
          className="font-mono text-center tracking-wider"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      ) : (
        <div className="flex items-center justify-center gap-2 text-green-500">
          <IconCheck className="size-5" />
          <span>Challenge complete!</span>
        </div>
      )}
    </div>
  );
});

// Main blocked page component
export default function BlockedPage() {
  const [blockedSite, setBlockedSite] = useState<BlockedSite | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [challengeComplete, setChallengeComplete] = useState(false);
  const [alreadyUnlocked, setAlreadyUnlocked] = useState(false);
  const [statsEnabled, setStatsEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const visitTracked = useRef(false);
  const siteIdRef = useRef<string | null>(null);

  // Parse URL params and get site info
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const url = params.get("url");
    const siteId = params.get("siteId");

    if (!url) {
      setError("No URL provided");
      setLoading(false);
      return;
    }

    setOriginalUrl(url);
    siteIdRef.current = siteId;

    // Get site info from background
    (async () => {
      try {
        const result = await browser.runtime.sendMessage({
          type: "GET_SITE_INFO",
          siteId,
          url,
        });

        if (result.error) {
          setError(result.error);
        } else if (result.site) {
          setBlockedSite(result.site);
          setStatsEnabled(result.statsEnabled);
          siteIdRef.current = result.site.id;

          // Check if already unlocked by another tab
          if (result.alreadyUnlocked) {
            setAlreadyUnlocked(true);
            setChallengeComplete(true);
          }

          // Track visit (only if not already unlocked)
          if (
            result.statsEnabled &&
            !visitTracked.current &&
            !result.alreadyUnlocked
          ) {
            visitTracked.current = true;
            await browser.runtime.sendMessage({
              type: "UPDATE_STATS",
              siteId: result.site.id,
              update: { incrementVisit: true },
            });
          }
        } else {
          // Site no longer blocked or already unlocked, redirect through
          window.location.href = url;
        }
      } catch (err) {
        console.error("[distacted] Error getting site info:", err);
        setError("Failed to load blocking info");
      }

      setLoading(false);
    })();
  }, []);

  // Listen for unlock/relock events from other tabs
  useEffect(() => {
    const handleMessage = (message: {
      type: string;
      siteId?: string;
      expiresAt?: number;
    }) => {
      if (!siteIdRef.current) return;

      if (
        message.type === "SITE_UNLOCKED" &&
        message.siteId === siteIdRef.current
      ) {
        // Another tab completed the challenge - skip to "Continue to site"
        setAlreadyUnlocked(true);
        setChallengeComplete(true);
      }

      if (
        message.type === "SITE_RELOCKED" &&
        message.siteId === siteIdRef.current
      ) {
        // Site was relocked - refresh the page to show challenge again
        window.location.reload();
      }
    };

    browser.runtime.onMessage.addListener(handleMessage);
    return () => {
      browser.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  const handleChallengeComplete = useCallback(() => {
    setChallengeComplete(true);
  }, []);

  const handleUnlock = useCallback(async () => {
    if (!blockedSite || !originalUrl) return;

    setUnlocking(true);

    try {
      // If already unlocked by another tab, just navigate
      if (alreadyUnlocked) {
        window.location.href = originalUrl;
        return;
      }

      // Request unlock from background
      const result = await browser.runtime.sendMessage({
        type: "UNLOCK_SITE",
        siteId: blockedSite.id,
        durationMinutes: blockedSite.autoRelockAfter,
      });

      if (result.success) {
        // Track passed challenge
        if (statsEnabled) {
          await browser.runtime.sendMessage({
            type: "UPDATE_STATS",
            siteId: blockedSite.id,
            update: { incrementPassed: true },
          });
        }

        // Navigate to original URL
        window.location.href = originalUrl;
      } else {
        setError(result.error || "Failed to unlock");
        setUnlocking(false);
      }
    } catch (err) {
      console.error("[distacted] Error unlocking:", err);
      setError("Failed to unlock site");
      setUnlocking(false);
    }
  }, [blockedSite, originalUrl, statsEnabled, alreadyUnlocked]);

  const handleGoBack = useCallback(() => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.close();
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <IconX className="size-12 mx-auto text-destructive mb-4" />
            <p className="text-lg font-medium mb-2">Error</p>
            <p className="text-muted-foreground text-sm mb-4">{error}</p>
            <Button onClick={handleGoBack} variant="outline">
              <IconArrowLeft className="size-4" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!blockedSite) {
    return null;
  }

  const methodIcons: Record<UnlockMethod, React.ReactNode> = {
    timer: <IconClock className="size-5" />,
    hold: <IconHandStop className="size-5" />,
    type: <IconKeyboard className="size-5" />,
  };

  const methodTitles: Record<UnlockMethod, string> = {
    timer: "Wait to Access",
    hold: "Hold to Access",
    type: "Type to Access",
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 dark"
      style={{
        backgroundColor: "hsl(var(--background))",
        fontFamily:
          "'Inter Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Background pattern */}
      <div
        className="fixed inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <Card className="w-full max-w-md relative bg-card/95 backdrop-blur shadow-2xl">
        <CardHeader className="text-center pb-2 flex">
          <div className="p-3 rounded-full bg-primary/10 w-fit">
            <IconShieldLock className="size-8 text-primary" />
          </div>
          <div className="flex flex-col ml-2 items-start justify-center gap-1">
            <CardTitle className="text-xl">Site Blocked</CardTitle>
            <CardDescription>
              <span className="text-sm bg-muted/50 px-2 py-0.5 rounded font-medium">
                {blockedSite.name}
              </span>
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Show the URL being blocked */}
          {originalUrl && (
            <div className="text-xs text-muted-foreground text-center truncate px-4 -mt-2 mb-2">
              {originalUrl}
            </div>
          )}

          {/* Already unlocked by another tab - show simple continue */}
          {alreadyUnlocked ? (
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="flex items-center gap-3 text-green-500">
                <IconLockOpen className="size-6" />
                <div>
                  <p className="font-medium">Already Unlocked</p>
                  <p className="text-sm text-green-500/80">
                    Challenge completed in another tab
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Show the challenge */
            <div className="p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/30">
                <div className="text-primary">
                  {methodIcons[blockedSite.unlockMethod]}
                </div>
                <span className="font-medium">
                  {methodTitles[blockedSite.unlockMethod]}
                </span>
              </div>

              {blockedSite.unlockMethod === "timer" && (
                <TimerChallenge
                  duration={blockedSite.unlockDuration}
                  onComplete={handleChallengeComplete}
                />
              )}

              {blockedSite.unlockMethod === "hold" && (
                <HoldChallenge
                  duration={blockedSite.unlockDuration}
                  onComplete={handleChallengeComplete}
                />
              )}

              {blockedSite.unlockMethod === "type" && (
                <TypeChallenge onComplete={handleChallengeComplete} />
              )}
            </div>
          )}

          {challengeComplete && (
            <Button
              onClick={handleUnlock}
              className="w-full"
              size="lg"
              disabled={unlocking}
            >
              {unlocking ? (
                "Unlocking..."
              ) : (
                <>
                  Continue to Site
                  <IconArrowRight className="size-4" />
                </>
              )}
            </Button>
          )}

          {blockedSite.autoRelockAfter && !alreadyUnlocked && (
            <p className="text-xs text-center text-muted-foreground">
              Access will expire after {blockedSite.autoRelockAfter} minute
              {blockedSite.autoRelockAfter > 1 ? "s" : ""}
            </p>
          )}
        </CardContent>
      </Card>

      <button
        onClick={handleGoBack}
        className="fixed top-4 right-4 p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
        title="Go back"
      >
        <IconX className="size-5" />
      </button>
    </div>
  );
}
