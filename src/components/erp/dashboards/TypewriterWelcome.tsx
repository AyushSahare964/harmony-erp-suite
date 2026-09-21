import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Stethoscope, Sparkles, Clock, MapPin, Radio, Activity, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface TypewriterWelcomeProps {
  personName: string;
  roleName?: string;
  greetingSubtitle?: string;
  branchName?: string;
  onRefresh?: () => void;
  className?: string;
}

export function TypewriterWelcome({
  personName,
  roleName = "Clinic Administrator",
  greetingSubtitle = "Branch operations at a glance.",
  branchName = "Nagpur · Real Care Small Animal Clinic",
  onRefresh,
  className,
}: TypewriterWelcomeProps) {
  // Determine greeting based on current local time
  const timeGreeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  // Rotating phrases for continuous typewriter animation
  const phrases = useMemo(() => [
    `Welcome, ${personName}`,
    `${timeGreeting}, ${personName} 👋`,
    `Real Care Small Animal Clinic · Nagpur 🏥`,
    `Live OPD & Clinical Pulse Active 🩺`,
    `Excellence in Veterinary Care · All systems operational ✨`,
  ], [personName, timeGreeting]);

  const [phraseIndex, setPhraseIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [clickSparks, setClickSparks] = useState(false);

  // Live real-time clock updating every second
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

  // Continuous typewriter effect
  useEffect(() => {
    const currentFullText = phrases[phraseIndex] || `Welcome, ${personName}`;

    if (isPaused) {
      const pauseTimer = setTimeout(() => {
        setIsPaused(false);
        setIsDeleting(true);
      }, 2600);
      return () => clearTimeout(pauseTimer);
    }

    if (!isDeleting) {
      // Typing phase
      if (displayText.length < currentFullText.length) {
        const typingTimer = setTimeout(() => {
          setDisplayText(currentFullText.slice(0, displayText.length + 1));
        }, 55);
        return () => clearTimeout(typingTimer);
      } else {
        // Finished typing current phrase -> pause before deleting
        setIsPaused(true);
        return undefined;
      }
    } else {
      // Deleting phase
      if (displayText.length > 0) {
        const deletingTimer = setTimeout(() => {
          setDisplayText(currentFullText.slice(0, displayText.length - 1));
        }, 28);
        return () => clearTimeout(deletingTimer);
      } else {
        // Finished deleting -> move to next phrase
        setIsDeleting(false);
        setPhraseIndex((prev) => (prev + 1) % phrases.length);
        return undefined;
      }
    }
  }, [displayText, isDeleting, isPaused, phraseIndex, phrases, personName]);

  // Click on the title skips immediately to the next phrase with a nice sparkle effect
  const handleTitleClick = () => {
    setClickSparks(true);
    setTimeout(() => setClickSparks(false), 600);
    setIsPaused(false);
    setIsDeleting(false);
    const nextIdx = (phraseIndex + 1) % phrases.length;
    setPhraseIndex(nextIdx);
    setDisplayText(phrases[nextIdx] || "");
    setIsPaused(true);
  };

  return (
    <div className={cn("space-y-1.5 select-none", className)}>
      {/* Welcome Title with Typewriter & Blinking Cursor */}
      <div
        onClick={handleTitleClick}
        title="Click to cycle status messages"
        className="group inline-flex items-center gap-2.5 cursor-pointer py-0.5 transition-transform active:scale-[0.99]"
      >
        <motion.span
          whileHover={{ scale: 1.12, rotate: 8 }}
          whileTap={{ scale: 0.92 }}
          className="relative flex size-8 items-center justify-center rounded-xl bg-gradient-to-tr from-primary/20 via-primary/10 to-sky-400/20 text-primary border border-primary/20 shadow-xs"
        >
          <Stethoscope className="size-4.5" />
          {/* Subtle pulse ring around icon */}
          <span className="absolute -inset-0.5 rounded-xl bg-primary/20 animate-pulse pointer-events-none -z-10" />
        </motion.span>

        <div className="flex items-center">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground bg-gradient-to-r from-foreground via-foreground to-primary/90 bg-clip-text">
            {displayText}
          </h1>
          {/* Animated Blinking Typewriter Cursor */}
          <motion.span
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
            className="inline-block w-[3px] h-[1.1em] ml-1 bg-primary rounded-xs shadow-[0_0_8px_rgba(59,130,246,0.8)] align-middle"
          />
        </div>

        {/* Playful interactive sparkle indicator */}
        <motion.div
          animate={clickSparks ? { scale: [1, 1.4, 1], rotate: [0, 180, 360] } : {}}
          className="text-primary/40 group-hover:text-primary transition-colors ml-0.5"
        >
          <Sparkles className="size-4" />
        </motion.div>
      </div>

      {/* Subtitle with live clinic status, clock, and branch info */}
      <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
        <span className="font-medium text-foreground/80">{greetingSubtitle}</span>
        
        <span className="hidden sm:inline-block text-border">•</span>

        {/* Live Pulse Operational Chip */}
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
