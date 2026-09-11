import { useState } from "react";
import { Calendar, Filter, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { type AnalyticsTabId } from "./analyticsTypes";

interface Props {
  activeTab: AnalyticsTabId;
  dateRange: string;
  onDateRangeChange: (range: string) => void;
  startDate: string;
  endDate: string;
  onCustomDatesChange: (start: string, end: string) => void;
  doctorFilter: string;
  onDoctorFilterChange: (doc: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (cat: string) => void;
  onReset: () => void;
  dateRangeLabel: string;
  onExportCsv?: () => void;
}

export function AnalyticsFilterBar({
  activeTab,
  dateRange,
  onDateRangeChange,
  startDate,
  endDate,
  onCustomDatesChange,
  doctorFilter,
  onDoctorFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  onReset,
  dateRangeLabel,
  onExportCsv,
}: Props) {
  const [customStart, setCustomStart] = useState(startDate);
  const [customEnd, setCustomEnd] = useState(endDate);

  const handleApplyCustom = () => {
    if (customStart && customEnd) {
      onCustomDatesChange(customStart, customEnd);
    }
  };

  return (
    <div className="erp-card p-3.5 space-y-3 bg-card border-border shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
            <Filter className="size-3.5 text-primary" />
            <span>Time Range:</span>
          </div>

          <Select value={dateRange} onValueChange={onDateRangeChange}>
            <SelectTrigger className="w-[160px] text-xs h-8 bg-background font-medium">
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
              <SelectItem value="this_year">This Year</SelectItem>
              <SelectItem value="custom">Custom Date Range</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>

          {dateRange === "custom" && (
            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-[130px] text-xs h-8 bg-background"
              />
              <span className="text-xs text-muted-foreground font-medium">to</span>
              <Input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-[130px] text-xs h-8 bg-background"
              />
              <Button size="sm" onClick={handleApplyCustom} className="h-8 text-xs font-semibold px-2.5">
                Apply
              </Button>
            </div>
          )}

          {/* Contextual Filters based on active tab */}
          {(activeTab === "appointments" || activeTab === "clinical") && (
            <Select value={doctorFilter} onValueChange={onDoctorFilterChange}>
              <SelectTrigger className="w-[170px] text-xs h-8 bg-background font-medium">
                <SelectValue placeholder="All Clinicians" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clinicians</SelectItem>
                <SelectItem value="Dr. Rohit Sharma">Dr. Rohit Sharma</SelectItem>
                <SelectItem value="Dr. Aisha Nair">Dr. Aisha Nair</SelectItem>
                <SelectItem value="Dr. Vikram Rao">Dr. Vikram Rao</SelectItem>
              </SelectContent>
            </Select>
          )}

          {(activeTab === "billing" || activeTab === "inventory" || activeTab === "clinical") && (
            <Select value={categoryFilter} onValueChange={onCategoryFilterChange}>
              <SelectTrigger className="w-[170px] text-xs h-8 bg-background font-medium">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="Clinical">Clinical Services</SelectItem>
                <SelectItem value="Pharmacy">Pharmacy &amp; Rx</SelectItem>
                <SelectItem value="Laboratory">Laboratory &amp; Diagnostics</SelectItem>
                <SelectItem value="Boarding">Boarding &amp; Swimming</SelectItem>
                <SelectItem value="Nutrition">Food &amp; Nutrition</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[11px] font-semibold">
            {dateRangeLabel}
          </Badge>
          {onExportCsv && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExportCsv}
              className="h-8 text-xs font-semibold gap-1"
            >
              <Search className="size-3 hidden" />
              Export CSV
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onReset} className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1">
            <RotateCcw className="size-3" /> Reset
          </Button>
        </div>
      </div>
    </div>
  );
}
