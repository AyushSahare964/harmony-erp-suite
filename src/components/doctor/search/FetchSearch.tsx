import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { findPet } from "@/data/doctor/pets";
import { BrandChip } from "../shared/BrandChip";
import { buildResults, optionId, type SearchResult } from "./searchResults";
import { SuggestList } from "./SuggestList";

/** "VetOS Master Search": the Google-style Fetch bar with its results drop-down. */
export function FetchSearch() {
  const navigate = useNavigate();
  const listId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // On a patient page the box shows that pet's name, as in the reference.
  const { id } = useParams({ strict: false });
  const [query, setQuery] = useState(() => (id && findPet(id)?.name) || "");
  useEffect(() => setQuery((id && findPet(id)?.name) || ""), [id]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const groups = useMemo(() => buildResults(query), [query]);
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  const show = () => {
    setOpen(true);
    setActive(0);
  };
  const close = () => setOpen(false);

  const choose = (item: SearchResult) => {
    close();
    setQuery(findPet(item.petId)?.name ?? "");
    inputRef.current?.blur();
    if (item.section) {
      navigate({
        to: "/patient/$id/$section",
        params: { id: item.petId, section: item.section },
      });
    } else {
      navigate({ to: "/patient/$id", params: { id: item.petId } });
    }
  };

  // Press "/" anywhere to jump to the search bar.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const el = document.activeElement;
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
      if (e.key === "/" && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close when clicking anywhere outside the search.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!formRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && flat.length) {
      e.preventDefault();
      if (!open) show();
      else setActive((i) => (i + 1) % flat.length);
    } else if (e.key === "ArrowUp" && flat.length) {
      e.preventDefault();
      setActive((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === "Escape") {
      close();
    }
  };

  return (
    <form
      ref={formRef}
      className="vd-search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const item = flat[open ? active : 0];
        if (item) choose(item);
        else show();
      }}
    >
      <div className="vd-search-name">
        <BrandChip /> Master Search
      </div>
      <label className="vd-search-box">
        <Search strokeWidth={2} aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          placeholder="Fetch a patient, owner, medicine or invoice"
          aria-label="VetOS Master Search: find anything in your clinic"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && flat.length ? optionId(listId, active) : undefined}
          onFocus={show}
          onChange={(e) => {
            setQuery(e.target.value);
            show();
          }}
          onKeyDown={onKeyDown}
        />
        <span className="vd-kbd" aria-hidden="true">
          Press /
        </span>
        <button className="vd-fetch-btn" type="submit">
          Fetch
        </button>
      </label>
      {open && (
        <SuggestList
          id={listId}
          groups={groups}
          query={query}
          activeIndex={active}
          onChoose={choose}
        />
      )}
    </form>
  );
}
