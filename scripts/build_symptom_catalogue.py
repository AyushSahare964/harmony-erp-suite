"""Builds src/lib/clinical/symptomCatalogue.ts from the intake list + triage xlsx.

Run:  python -I scripts/build_symptom_catalogue.py
Never hand-edit the generated file; edit the inputs/rules here and re-run.
"""
import json, re, zipfile, html, collections, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
INTAKE = ROOT / "scripts/data/symptom-intake.txt"
XLSX = ROOT / "VetOS_Symptom_Triage_Master.xlsx"
OUT = ROOT / "src/lib/clinical/symptomCatalogue.ts"
REPORT = ROOT / "scripts/data/unmatched-report.md"

# Keep in sync with normalizeSymptom() in src/lib/clinical/symptomSearch.ts
SPELL = [("diarrhoea", "diarrhea"), ("faec", "fec"), ("oestrus", "estrus"), ("colour", "color"),
         ("behaviour", "behavior"), ("odour", "odor"), ("labour", "labor"), ("isation", "ization"),
         ("generalised", "generalized"), ("discolouration", "discoloration"), ("discoloured", "discolored"),
         ("grey", "gray"), ("haem", "hem"), ("oedema", "edema")]

def norm(s):
    s = s.lower()
    for a, b in SPELL:
        s = s.replace(a, b)
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", s)).strip()

# xlsx category -> (group, species)
XCAT = {
    "Birds": ("Species-specific", ["bird"]), "Cat": ("Species-specific", ["cat"]),
    "Rabbit": ("Species-specific", ["rabbit"]), "Rabbit/Small mammals": ("Species-specific", ["rabbit", "smallMammal"]),
    "Small mammals": ("Species-specific", ["smallMammal"]), "Reptiles": ("Species-specific", ["reptile"]),
    "Ears": ("Ear", None), "Eye": ("Eye", None), "Eyes": ("Eye", None), "GI": ("GI", None),
    "General": ("General", None), "Heat/Toxins/Trauma": ("Trauma/Toxins", None),
    "Musculoskeletal": ("Musculoskeletal", None), "Musculoskeletal/Neurological": ("Musculoskeletal", None),
    "Neurological/Pain": ("Neurological", None), "Oral/Nose": ("Oral/Nose", None),
    "Pain/Bleeding": ("Pain", None), "Reproductive": ("Reproductive", None),
    "Respiratory/Cardiac": ("Respiratory", None), "Skin/Coat": ("Skin/Coat", None),
    "Skin/Ears": ("Skin/Coat", None), "Skin/Swelling": ("Skin/Coat", None), "Urinary": ("Urinary", None),
}

# Fallback triage for items with no xlsx match. Errs upward: a missed E is worse than a false one.
E_WORDS = ["collapse", "seizure", "blue gums", "blue tongue", "blue or purple", "purple", "difficulty breathing", "laboured breathing", "labored breathing",
           "open mouth breathing", "respiratory distress", "poison", "toxi", "ingestion", "overdose", "chemical exposure", "pesticide exposure", "insecticide exposure", "rodenticide exposure", "substance exposure", "smoke",
           "heatstroke", "paralysis", "no urine", "urinary blockage", "attempts to urinate", "straining to urinate",
           "prolonged labor", "snake", "envenomation", "electrical", "burn", "road traffic", "fall from height",
           "drowning", "smoke inhalation", "allergic reaction", "vomiting blood", "inability to bear", "unable to stand",
           "inability to stand", "sudden vision loss", "head pressing", "choking", "stillbirth",
           "egg binding", "prolapse", "sudden severe pain", "unexplained vocalization"]
C_WORDS = ["heat exposure", "cold exposure", "heat stress", "blood", "bleeding", "bloody", "repeated vomiting", "straining", "severe", "not eating", "food refusal",
           "complete food", "sudden", "fracture", "dislocation", "unequal pupil", "bulging", "protruding", "pus",
           "purulent", "prolonged", "newborn", "neonatal", "kitten not", "dehydration", "foreign", "pale gums",
           "yellow gums", "fever", "injury", "wound", "abscess", "tarry", "black stool", "can t", "no stool",
           "swelling of face", "facial swelling", "not suckling", "failure to thrive"]

def keyword_triage(n):
    if any(w in n + " " for w in E_WORDS):
        return "E"
    if any(w in n for w in C_WORDS):
        return "C"
    return None

# Hand-picked synonyms doctors actually type (norm() already covers UK/US spelling)
ALIASES = {
    "hairfall": ["hair loss", "alopecia"], "itching": ["pruritus", "itchy"], "vomiting": ["emesis", "throwing up"],
    "diarrhea": ["loose motions", "loose motion"], "lethargy": ["listless", "listlessness", "dull"],
    "loss of appetite": ["anorexia", "not eating", "inappetence"], "blood in urine": ["hematuria"],
    "limping": ["lameness", "lame"], "coughing": ["cough"], "fever reported by owner": ["fever", "pyrexia"],
    "ear discharge": ["otitis"], "suspected dehydration": ["dehydration"], "excessive thirst": ["polydipsia"],
    "increased thirst": ["polydipsia", "excessive thirst"], "increased urination": ["polyuria"],
    "difficulty breathing": ["dyspnea", "breathless"], "tremors": ["shivering"], "shivering": ["tremors"],
    "constipation": ["not passing stool"], "urinary incontinence": ["urine incontinence"],
    "skin rash": ["rashes on skin", "rashes"], "skin lump": ["lump", "growth", "mass"],
    "sneezing": ["sneeze"], "eye discharge": ["eye redness"], "red eyes": ["conjunctivitis"],
}

def cell_rows(xlsx):
    z = zipfile.ZipFile(xlsx)
    s = z.read("xl/worksheets/sheet1.xml").decode("utf8")
    for r in re.findall(r"<row .*?</row>", s, re.S)[1:]:
        c = [html.unescape(re.sub("<.*?>", "", x)) for x in re.findall(r"<c .*?</c>", r, re.S)]
        if len(c) >= 3:
            yield c[0], c[1].strip(), c[2][:1]

def sentence(s):
    return s[:1].upper() + s[1:]

entries = {}  # norm -> dict
dupes = 0

def add(label, group, species, triage=None, source="intake"):
    global dupes
    n = norm(label)
    e = entries.get(n)
    if e is None:
        entries[n] = {"label": label, "group": group, "species": set(species) if species else None,
                      "triage": triage, "source": source}
        return
    dupes += 1
    # appears in a general section -> applies to all species
    if not species or e["species"] is None:
        e["species"] = None
    else:
        e["species"] |= set(species)
    if e["group"] == "Species-specific" and group != "Species-specific":
        e["group"] = group
    if triage and not e["triage"]:
        e["triage"] = triage

# 1) intake list
sec = None
for line in INTAKE.read_text(encoding="utf8").splitlines():
    line = line.strip()
    if not line:
        continue
    if line.startswith("## "):
        g, sp = line[3:].split("|")
        g = "Species-specific" if g == "Species" else g
        sec = (g, None if sp == "-" else [sp])
        continue
    add(line, *sec)

# 2) xlsx: attach triage to matches, add the rest as their own entries
matched = added = 0
for cat, name, t in cell_rows(XLSX):
    if cat.startswith("Preventive"):
        continue  # visit reasons, not symptoms
    group, species = XCAT[cat]
    n = norm(name)
    if n in entries:
        matched += 1
        if not entries[n]["triage"]:
            entries[n]["triage"] = t
        entries[n]["source"] = "both"
    else:
        added += 1
        add(sentence(name), group, species, t, "xlsx")

# 3) fallback triage for anything still unset
unmatched = []
for n, e in entries.items():
    if not e["triage"]:
        e["triage"] = keyword_triage(n) or "N"
        e["derived"] = True
        unmatched.append(e)

out = []
for n, e in sorted(entries.items(), key=lambda kv: (kv[1]["group"], kv[1]["label"])):
    o = {"id": n.replace(" ", "-"), "label": e["label"], "group": e["group"]}
    if e["species"]:
        o["species"] = sorted(e["species"])
    if e["triage"] != "N":
        o["triage"] = e["triage"]
    if n in ALIASES:
        o["aliases"] = ALIASES[n]
    out.append(o)

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(
    "// GENERATED by scripts/build_symptom_catalogue.py — do not edit by hand.\n"
    'import type { SymptomEntry } from "./symptomTypes";\n\n'
    "export const SYMPTOM_CATALOGUE: SymptomEntry[] = "
    + json.dumps(out, ensure_ascii=False, indent=0) + ";\n", encoding="utf8")

cnt = collections.Counter(o.get("triage", "N") for o in out)
lines = ["# Symptom catalogue build report", "",
         f"- Total entries: {len(out)}  (E {cnt['E']} · C {cnt['C']} · N {cnt['N']})",
         f"- Duplicates merged: {dupes}", f"- xlsx rows matched to intake: {matched}",
         f"- xlsx rows added as own entries: {added}",
         f"- Triage derived by keyword rule (needs vet sign-off): {len(unmatched)}", "",
         "## Derived triage — please review (E and C first)", ""]
for e in sorted(unmatched, key=lambda e: ("ECN".index(e["triage"]), e["label"])):
    lines.append(f"- [{e['triage']}] {e['label']}  ({e['group']})")
REPORT.write_text("\n".join(lines), encoding="utf8")
print("\n".join(lines[:8]))
