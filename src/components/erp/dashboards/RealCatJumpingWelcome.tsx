import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Stethoscope, Clock, MapPin, Sparkles, RotateCcw, Heart } from "lucide-react";
import { cn } from "@/lib/utils";

interface RealCatJumpingWelcomeProps {
  personName: string;
  greetingSubtitle?: string;
  branchName?: string;
  onRefresh?: () => void;
  className?: string;
}

// In-browser canvas filter to convert white background JPG to transparent PNG
function useTransparentCatImage(src: string) {
  const [transparentDataUrl, setTransparentDataUrl] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          setTransparentDataUrl(src);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i] ?? 0;
          const g = d[i + 1] ?? 0;
          const b = d[i + 2] ?? 0;
          if (r > 240 && g > 240 && b > 240) {
            d[i + 3] = 0; // 100% transparent
          } else if (r > 218 && g > 218 && b > 218) {
            const factor = (255 - Math.max(r, g, b)) / 37;
            d[i + 3] = Math.round((d[i + 3] ?? 255) * Math.max(0, Math.min(1, factor)));
          }
        }
        ctx.putImageData(imgData, 0, 0);
        setTransparentDataUrl(canvas.toDataURL("image/png"));
      } catch (err) {
        console.warn("Could not process cat transparency:", err);
        setTransparentDataUrl(src);
      }
    };
    img.onerror = () => {
      setTransparentDataUrl(src);
    };
  }, [src]);

  return transparentDataUrl || src;
}

export function RealCatJumpingWelcome({
  personName,
  greetingSubtitle = "Branch operations at a glance.",
  branchName = "Nagpur · Real Care Small Animal Clinic",
  className,
}: RealCatJumpingWelcomeProps) {
  const words = useMemo(() => {
    return ["Welcome,", ...personName.split(" ").filter(Boolean)];
  }, [personName]);

  const fullWelcomeText = useMemo(() => `Welcome, ${personName}`, [personName]);

  // Transparent cat sprite assets
  const jumpingCatSrc = useTransparentCatImage("/pets/real-cat-jumping.jpg");
  const sittingCatSrc = useTransparentCatImage("/pets/real-cat-sitting.jpg");

  // State
  const [typedLength, setTypedLength] = useState(0);
  const [isTypingComplete, setIsTypingComplete] = useState(false);
  const [catAnimationStep, setCatAnimationStep] = useState<"hidden" | "jumping" | "sitting">("hidden");

  // Physics animation values
  const [catPos, setCatPos] = useState({ x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 });
  const [shadowScale, setShadowScale] = useState(1);
  const [activeWordDippingIndex, setActiveWordDippingIndex] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState("");
  const [pawSparks, setPawSparks] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const sparkIdCounter = useRef(0);
  const typingTimerRef = useRef<any>(null);

  // Friendly random clinic messages for the cat to continuously flash
  const catMessages = useMemo(() => [
    { tag: "Meow!", icon: "❤️", text: `Welcome, ${personName}!` },
    { tag: "Purr...", icon: "🐾", text: "All clinic patients in good hands!" },
    { tag: "Doc!", icon: "💧", text: "Don't forget to hydrate today!" },
    { tag: "Yay!", icon: "✨", text: "OPD queue is active and rolling!" },
    { tag: "Meow!", icon: "🩺", text: "Ready for veterinary rounds!" },
    { tag: "Hehe", icon: "🐟", text: "Did someone say salmon treats?" },
    { tag: "Purr!", icon: "⭐", text: "Nagpur's #1 veterinary clinic!" },
    { tag: "Doc!", icon: "📋", text: "Diagnostics & prescriptions ready!" },
    { tag: "Meow!", icon: "🐾", text: "Healing pets with care & love!" },
  ], [personName]);

  const [currentMsgIndex, setCurrentMsgIndex] = useState(0);

  // Live clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Continuous speech bubble message cycle (flashes every 4.5 seconds while cat is sitting)
  useEffect(() => {
    if (catAnimationStep !== "sitting") return;
    const msgInterval = setInterval(() => {
      setCurrentMsgIndex((prev) => (prev + 1) % catMessages.length);
    }, 4500);
    return () => clearInterval(msgInterval);
  }, [catAnimationStep, catMessages.length]);

  // Function: Start typing the welcome message letter-by-letter
  const startTypingSequence = useCallback(() => {
    if (typingTimerRef.current) clearInterval(typingTimerRef.current);

    setTypedLength(0);
    setIsTypingComplete(false);
    setCatAnimationStep("hidden");
    setActiveWordDippingIndex(null);

    let current = 0;
    typingTimerRef.current = setInterval(() => {
      current += 1;
      setTypedLength(current);
      if (current >= fullWelcomeText.length) {
        clearInterval(typingTimerRef.current);
        setIsTypingComplete(true);
      }
    }, 45);
  }, [fullWelcomeText]);

  // Trigger typing on initial mount and re-trigger automatically every 40 seconds
  useEffect(() => {
    startTypingSequence();

    const interval40s = setInterval(() => {
      startTypingSequence();
    }, 40000); // exactly every 40 seconds

    return () => {
      clearInterval(interval40s);
      if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    };
  }, [startTypingSequence]);

  // Once typing completes, launch the cat jump sequence
  useEffect(() => {
    if (!isTypingComplete) return;

    const startTimeout = setTimeout(() => {
      startRealCatJumpSequence();
    }, 380);

    return () => clearTimeout(startTimeout);
  }, [isTypingComplete]);

  // Physics-based jumping sequence: 9 gentle, short hops
  const startRealCatJumpSequence = () => {
    setCatAnimationStep("jumping");
    setPawSparks([]);

    const numJumps = 9;
    const jumpDuration = 440; // ms per gentle hop
    const maxJumpHeight = 18; // Short, cute hop height
    const startTime = Date.now();

    const waypoints = Array.from({ length: numJumps + 1 }, (_, i) => {
      return (i / numJumps) * 100;
    });

    let animationFrameId: number;

    const animatePhysics = () => {
      const elapsed = Date.now() - startTime;
      const currentJumpIndex = Math.floor(elapsed / jumpDuration);

      if (currentJumpIndex >= numJumps) {
        // Finished all gentle hops -> Land softly and sit comfortably
        setCatAnimationStep("sitting");
        return;
      }

      const subElapsed = elapsed % jumpDuration;
      const t = subElapsed / jumpDuration;

      const startX = waypoints[currentJumpIndex] ?? 0;
      const endX = waypoints[currentJumpIndex + 1] ?? 100;

      const curX = startX + (endX - startX) * t;
      const curY = -4 * maxJumpHeight * t * (1 - t);

      let rotate = 0;
      let scaleX = 1;
      let scaleY = 1;

      if (t < 0.45) {
        rotate = -8 * (1 - t / 0.45);
        scaleY = 1.05;
        scaleX = 0.96;
      } else if (t < 0.75) {
        rotate = 4 * ((t - 0.45) / 0.3);
        scaleY = 1;
        scaleX = 1;
      } else {
        rotate = 5 * (1 - (t - 0.75) / 0.25);
        const impact = (t - 0.75) / 0.25;
        scaleY = 1 - 0.08 * impact;
        scaleX = 1 + 0.08 * impact;
      }

      const heightFactor = Math.abs(curY) / maxJumpHeight;
      setShadowScale(1 - 0.3 * heightFactor);

      setCatPos({ x: curX, y: curY, rotate, scaleX, scaleY });

      // Subtle letter dip directly where paws tap
      if (t > 0.8 && t < 0.98) {
        const landingWordIndex = Math.min(
          words.length - 1,
          Math.floor((curX / 100) * words.length)
        );
        if (activeWordDippingIndex !== landingWordIndex) {
          setActiveWordDippingIndex(landingWordIndex);

          sparkIdCounter.current += 1;
          setPawSparks((prev) => [
            ...prev.slice(-3),
            { id: sparkIdCounter.current, x: curX, y: 0 },
          ]);
        }
      } else if (t < 0.15) {
        setActiveWordDippingIndex(null);
      }

      animationFrameId = requestAnimationFrame(animatePhysics);
    };

    animationFrameId = requestAnimationFrame(animatePhysics);
  };

  const handleReplay = (e: React.MouseEvent) => {
    e.stopPropagation();
    startRealCatJumpSequence();
  };

  const handleCycleMessage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentMsgIndex((prev) => (prev + 1) % catMessages.length);
  };

  const currentMsg = catMessages[currentMsgIndex] || catMessages[0]!;

  let characterCounter = 0;

  return (
    <div className={cn("space-y-1.5 select-none relative", className)}>
      {/* ── Main Welcome Header Line with Cat & Safe Non-Overlapping Message ── */}
      <div className="relative flex flex-wrap items-center gap-2.5 py-1">
        {/* Stethoscope Icon Badge */}
        <motion.span
          whileHover={{ scale: 1.1, rotate: 6 }}
          className="relative flex size-8.5 items-center justify-center rounded-xl bg-gradient-to-tr from-primary/20 via-primary/10 to-sky-400/20 text-primary border border-primary/20 shadow-xs shrink-0 self-center"
        >
          <Stethoscope className="size-4.5" />
          <span className="absolute -inset-0.5 rounded-xl bg-primary/25 animate-pulse pointer-events-none -z-10" />
        </motion.span>

        {/* Letters Stage */}
        <div className="relative inline-flex items-center">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center flex-wrap gap-x-2">
            {words.map((word, wordIndex) => {
              const wordChars = word.split("");
              const isWordDipping = activeWordDippingIndex === wordIndex;

              return (
                <motion.span
                  key={wordIndex}
                  animate={
                    isWordDipping
                      ? {
                          y: [0, 3.5, -1, 0],
                          scaleY: [1, 0.94, 1.03, 1],
                          scaleX: [1, 1.04, 0.98, 1],
                          color: ["#16233F", "#2563EB", "#16233F"],
                        }
                      : { y: 0, scaleY: 1, scaleX: 1 }
                  }
                  transition={{ duration: 0.26, ease: "easeOut" }}
                  className="inline-flex items-center origin-bottom"
                >
                  {wordChars.map((char, charIdx) => {
                    const thisCharIndex = characterCounter++;
                    const isRevealed = thisCharIndex < typedLength;

                    if (!isRevealed) return null;

                    return (
                      <span key={charIdx} className="inline-block">
                        {char}
                      </span>
                    );
                  })}
                </motion.span>
              );
            })}

            {/* Blinking typing cursor */}
            {!isTypingComplete && (
              <motion.span
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.55, repeat: Infinity, ease: "easeInOut" }}
                className="inline-block w-[3px] h-[1.05em] ml-0.5 bg-primary rounded-xs shadow-[0_0_8px_rgba(59,130,246,0.85)] align-middle"
              />
            )}
          </h1>

          {/* ── REAL JUMPING CAT (Active during the short hops) ── */}
          <AnimatePresence>
            {catAnimationStep === "jumping" && jumpingCatSrc && (
              <div
                className="absolute pointer-events-none z-30"
                style={{
                  left: `${catPos.x}%`,
                  top: 0,
                  transform: `translate(-50%, ${catPos.y - 28}px) rotate(${catPos.rotate}deg) scale(${catPos.scaleX}, ${catPos.scaleY})`,
                  transformOrigin: "bottom center",
                  transition: "none",
                  width: "66px",
                  height: "50px",
                }}
              >
                <img
                  src={jumpingCatSrc}
                  alt="Real playful ginger cat leaping"
                  className="w-full h-full object-contain filter drop-shadow-[0_6px_10px_rgba(0,0,0,0.25)] select-none"
                  draggable={false}
                />
                <div
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-1.5 bg-black/25 blur-[2px] rounded-full pointer-events-none -z-10"
                  style={{
                    transform: `scale(${shadowScale})`,
                    opacity: 0.6 * shadowScale,
                  }}
                />
              </div>
            )}
          </AnimatePresence>

          {/* Paw Touchdown Sparks */}
          {pawSparks.map((spark) => (
            <motion.span
              key={spark.id}
              initial={{ opacity: 0.9, scale: 0.4, y: 0 }}
              animate={{ opacity: 0, scale: 1.2, y: -6 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
              style={{ left: `${spark.x}%` }}
              className="absolute -top-2 pointer-events-none text-amber-500 font-bold text-xs"
            >
              🐾
            </motion.span>
          ))}
        </div>

        {/* ── SITTING CAT & SAFE HORIZONTAL FLASHING SPEECH BUBBLE ── */}
        {/* Placed side-by-side on the same horizontal line — ZERO OVERLAP with the search bar above! */}
        <AnimatePresence>
          {catAnimationStep === "sitting" && sittingCatSrc && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="inline-flex items-center gap-2 self-center ml-1"
            >
              {/* Sitting Cat Cutout */}
              <motion.div
                whileHover={{ scale: 1.15, y: -2 }}
                onClick={handleReplay}
                title="Click me to watch the cat jump across your name again!"
                className="relative size-11 sm:size-13 cursor-pointer group shrink-0"
              >
                <motion.img
                  animate={{ y: [0, -1.5, 0] }}
                  transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                  src={sittingCatSrc}
                  alt="Real sitting ginger cat"
                  className="w-full h-full object-contain filter drop-shadow-xs select-none"
                  draggable={false}
                />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-7 h-1 bg-black/20 blur-[1.5px] rounded-full -z-10" />
              </motion.div>

              {/* Flashing Continuous Speech Bubble: Positioned to the RIGHT of the cat */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentMsgIndex}
                  initial={{ opacity: 0, scale: 0.88, x: -6 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.88, x: 6 }}
                  transition={{ duration: 0.26 }}
                  onClick={handleCycleMessage}
                  title="Click to see another cat message!"
                  className="relative inline-flex items-center gap-1.5 px-3 py-1 bg-card/95 border border-primary/30 shadow-xs rounded-xl text-xs font-bold text-primary cursor-pointer hover:bg-primary/5 hover:border-primary/50 transition-all select-none whitespace-nowrap"
                >
                  {/* Left pointer arrow pointing safely back to the cat */}
                  <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 size-2 bg-card border-l border-b border-primary/30 rotate-45" />

                  <span>{currentMsg.tag}</span>
                  <span>{currentMsg.icon}</span>
                  <span className="text-foreground font-semibold text-[11px]">{currentMsg.text}</span>
                </motion.div>
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Subtitle with live clinic status, clock, and branch info */}
      <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
        <span className="font-medium text-foreground/80">{greetingSubtitle}</span>

        <span className="hidden sm:inline-block text-border">•</span>

        {/* Live Systems Operational Pill */}
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-semibold text-[11px]">
          <span className="relative flex size-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
          </span>
          <span>Live Systems Operational</span>
        </div>

        {/* Real-time Clock */}
        {currentTime && (
          <div className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/50 border border-border/70 text-[11px] font-mono text-muted-foreground font-medium">
            <Clock className="size-3 text-primary/70" />
            <span>{currentTime}</span>
          </div>
        )}

        {/* Branch Location */}
        <div className="hidden lg:inline-flex items-center gap-1 text-[11px] text-muted-foreground/80 font-medium">
          <MapPin className="size-3 text-muted-foreground/60" />
          <span>{branchName.split("·")[0]?.trim() || "Nagpur Branch"}</span>
        </div>
      </div>
    </div>
  );
}
