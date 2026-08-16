import { useState } from "react";
import { 
  Heart, 
  ShieldCheck, 
  Activity,
  PawPrint,
  Sparkles,
  Stethoscope
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PetCardData {
  id: string;
  name: string;
  species: string;
  breed: string;
  image: string;
  status: string;
  statusColor: string;
  vitals: string;
  tag: string;
}

const PET_LIST: PetCardData[] = [
  {
    id: "pet-1",
    name: "Buddy",
    species: "Golden Retriever",
    breed: "Post-Op Recovery · 3.5 yrs",
    image: "/pets/golden.jpg",
    status: "Healthy & Active",
    statusColor: "text-emerald-700 bg-emerald-50 border-emerald-200/80",
    vitals: "86 BPM · Normal",
    tag: "Surgery",
  },
  {
    id: "pet-2",
    name: "Luna",
    species: "Siamese Kitten",
    breed: "FVRCP Booster · 1.5 yrs",
    image: "/pets/cat.jpg",
    status: "Vaccinated",
    statusColor: "text-blue-700 bg-blue-50 border-blue-200/80",
    vitals: "120 BPM · Clear",
    tag: "Wellness",
  },
  {
    id: "pet-3",
    name: "Milo",
    species: "French Bulldog",
    breed: "Dental Prophylaxis · 2 yrs",
    image: "/pets/bulldog.jpg",
    status: "Clean Vitals",
    statusColor: "text-emerald-700 bg-emerald-50 border-emerald-200/80",
    vitals: "92 BPM · SpO₂ 99%",
    tag: "Dental",
  },
  {
    id: "pet-4",
    name: "Bella",
    species: "Holland Lop",
    breed: "Luxury Boarding Suite #4 · 1 yr",
    image: "/pets/bunny.jpg",
    status: "Happy Guest",
    statusColor: "text-purple-700 bg-purple-50 border-purple-200/80",
    vitals: "175 BPM · Playtime",
    tag: "Boarding",
  },
];

export function PetShowcase() {
  return (
    <div className="relative flex h-full w-full flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50/30 p-6 lg:p-8">
      {/* Soft Ambient Background Highlights */}
      <div className="pointer-events-none absolute -left-16 -top-16 size-48 rounded-full bg-blue-400/10 blur-2xl" />
      <div className="pointer-events-none absolute -right-16 -bottom-16 size-48 rounded-full bg-emerald-400/10 blur-2xl" />

      {/* Header section */}
      <div className="relative z-10 space-y-1.5">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200/60 bg-white/90 px-3 py-1 text-[0.7rem] font-semibold text-primary shadow-xs">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          <span>Live Clinical Monitoring</span>
        </div>

        <h2 className="text-xl font-bold tracking-tight text-navy lg:text-2xl">
          Compassionate Care, <br />
          <span className="text-primary font-extrabold">Powered by VetOS ERP</span>
        </h2>
      </div>

      {/* CONTINUOUS ANIMATED PET SLIDER (Light Theme) */}
      <div className="marquee-pause relative my-4 h-[300px] w-full overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_8%,black_92%,transparent)]">
        <div className="space-y-3 animate-marquee-vertical hover:[animation-play-state:paused]">
          {[...PET_LIST, ...PET_LIST].map((pet, idx) => (
            <div
              key={`${pet.id}-${idx}`}
              className={cn(
                "group flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white/95 p-3 shadow-xs transition-all duration-300",
                "hover:scale-[1.01] hover:border-primary/40 hover:shadow-md hover:bg-white"
              )}
            >
              {/* Pet 3D Image */}
              <div className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-slate-50 shadow-xs">
                <img
                  src={pet.image}
                  alt={pet.name}
                  className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <span className="absolute bottom-0.5 right-0.5 flex size-4 items-center justify-center rounded-full bg-white text-rose-500 shadow-xs">
                  <Heart className="size-2.5 fill-rose-500 text-rose-500 animate-heartbeat" />
                </span>
              </div>

              {/* Pet Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-sm font-bold text-navy group-hover:text-primary transition-colors truncate">
                    {pet.name}
                  </span>
                  <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[0.62rem] font-bold text-slate-600">
                    {pet.tag}
                  </span>
                </div>

                <p className="text-[0.72rem] text-muted-foreground truncate">{pet.species} · {pet.breed}</p>

                <div className="mt-1 flex items-center justify-between text-[0.65rem]">
                  <span className="flex items-center gap-1 font-semibold text-emerald-600">
                    <Activity className="size-2.5" />
                    {pet.status}
                  </span>
                  <span className="text-slate-400 font-medium">{pet.vitals}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Minimal Footer Metrics */}
      <div className="relative z-10 flex items-center justify-between border-t border-slate-200/60 pt-3 text-[0.72rem] text-muted-foreground">
        <div className="flex items-center gap-1.5 font-medium">
          <PawPrint className="size-3.5 text-primary" />
          <span><strong>1,420+</strong> Pets Monitored</span>
        </div>
        <div className="flex items-center gap-1.5 font-medium text-emerald-600">
          <ShieldCheck className="size-3.5" />
          <span>99.9% Uptime</span>
        </div>
      </div>
    </div>
  );
}
