import type { ReactNode } from "react";
import { FetchSearch } from "../search/FetchSearch";
import { SideBar } from "./SideBar";

interface DoctorLayoutProps {
  /** History pages hide the master search; every other page shows it. */
  showSearch: boolean;
  children: ReactNode;
}

/** Left bar · centre column · right bar. Fills the screen and never scrolls. */
export function DoctorLayout({ showSearch, children }: DoctorLayoutProps) {
  return (
    <div className="vd">
      <SideBar side="left" />
      <main className={`vd-main${showSearch ? "" : " in-detail"}`}>
        {showSearch && <FetchSearch />}
        {children}
      </main>
      <SideBar side="right" />
    </div>
  );
}
