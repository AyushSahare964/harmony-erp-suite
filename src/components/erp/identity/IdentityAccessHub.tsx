import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  ShieldCheck,
  ShieldAlert,
  UserPlus,
  Search,
  RotateCcw,
  Download,
  Mail,
  Phone,
  Building2,
  Stethoscope,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Award,
  Key,
} from "lucide-react";
import { Shell } from "@/components/erp/Shell";
import { KpiCard } from "@/components/erp/KpiCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AuthService } from "@/lib/erp/auth";
import { AddEmployeeModal } from "./AddEmployeeModal";
import { ApproveStaffModal } from "./ApproveStaffModal";
import { cn } from "@/lib/utils";

export function IdentityAccessHub() {
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<any | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);

  useEffect(() => {
    void loadStaff();
  }, []);

  const loadStaff = async () => {
    setLoading(true);
    try {
      const data = await AuthService.listStaff();
      setStaffList(data || []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load staff list from database.");
    } finally {
      setLoading(false);
    }
  };

  // Filtered staff
  const filteredStaff = useMemo(() => {
    const q = query.toLowerCase().trim();
    return staffList.filter((s) => {
      const matchQ =
        !q ||
        s.fullName?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.phone?.toLowerCase().includes(q) ||
        s.licenseNumber?.toLowerCase().includes(q) ||
        s.department?.toLowerCase().includes(q) ||
        s.roleName?.toLowerCase().includes(q);

      const matchS =
        statusFilter === "all" ||
        s.approvalStatus?.toLowerCase() === statusFilter.toLowerCase();

      const matchR =
        roleFilter === "all" ||
        s.roleId?.toLowerCase() === roleFilter.toLowerCase();

      return matchQ && matchS && matchR;
    });
  }, [staffList, query, statusFilter, roleFilter]);

  // KPIs
  const totalStaff = staffList.length;
  const approvedCount = staffList.filter((s) => s.approvalStatus === "approved").length;
  const pendingCount = staffList.filter((s) => s.approvalStatus === "pending").length;
  const doctorsCount = staffList.filter((s) => s.roleId === "doctor" && s.approvalStatus === "approved").length;

  const handleOpenApprove = (staff: any) => {
    setSelectedStaff(staff);
    setShowApproveModal(true);
  };

  const exportCsv = () => {
    const header = "Name,Email,Phone,Role,Department,License No,Qualification,Approval Status,Created At";
    const rows = filteredStaff
      .map(
        (s) =>
          `"${s.fullName}","${s.email}","${s.phone || ""}","${s.roleName}","${s.department || ""}","${s.licenseNumber || ""}","${s.qualification || ""}","${s.approvalStatus}","${s.createdAt || ""}"`
      )
      .join("\n");
    const blob = new Blob([`${header}\n${rows}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hospital_staff_identity_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Staff directory exported to CSV");
  };

  return (
    <Shell title="Identity, Role & Access Management">
      <div className="space-y-6 pb-12">
        {/* Header Title Banner */}
        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-navy flex items-center gap-2">
                Identity, Role & Access Hub
                <ShieldCheck className="size-5 text-primary" />
              </h1>
              <Badge variant="outline" className="border-primary/30 bg-primary-soft text-primary text-xs font-semibold">
                MongoDB Atlas Synced
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Staff directory, registration approvals, role-based authorization, and clinical credentials.
            </p>
          </div>

          <div className="flex items-center gap-2 mt-3 md:mt-0">
            <Button
              onClick={() => setShowAddModal(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs shadow-xs"
            >
              <UserPlus className="size-3.5 mr-1.5" />
              + Add New Employee
            </Button>
          </div>
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard
            kpi={{
              label: "Total Registered Staff",
              value: String(totalStaff),
              trend: "+2 this month",
              trendTone: "up",
            }}
          />
          <KpiCard
            kpi={{
              label: "Approved & Active",
              value: String(approvedCount),
              trend: "Full ERP Access",
              trendTone: "up",
            }}
          />
          <KpiCard
            kpi={{
              label: "Pending Approval",
              value: String(pendingCount),
              trend: pendingCount > 0 ? "Requires Admin Action" : "All cleared",
              trendTone: pendingCount > 0 ? "down" : "up",
            }}
          />
          <KpiCard
            kpi={{
              label: "Doctors & Clinicians",
              value: String(doctorsCount),
              trend: "OPD & Surgery Active",
              trendTone: "up",
            }}
          />
        </div>


        {/* Pending Approvals Callout Banner if any */}
        {pendingCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
                <Clock className="size-5 text-amber-600 animate-spin" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                  {pendingCount} Staff Registration Application{pendingCount > 1 ? "s" : ""} Awaiting Review
                </h3>
                <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                  Applicants cannot log in to the ERP until an administrator verifies credentials and approves their role.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => setStatusFilter("pending")}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 self-start sm:self-auto shadow-xs"
            >
              Filter Pending Applications
            </Button>
          </motion.div>
        )}

        {/* Controls & Filter Bar */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search staff by name, email, department, license..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-[160px] text-xs">
                  <SelectValue placeholder="Approval Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="approved">🟢 Approved & Active</SelectItem>
                  <SelectItem value="pending">🟡 Pending Approval</SelectItem>
                  <SelectItem value="rejected">🔴 Declined</SelectItem>
                </SelectContent>
              </Select>

              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="h-9 w-[160px] text-xs">
                  <SelectValue placeholder="Filter by Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="doctor">🩺 Doctor / Senior Vet</SelectItem>
                  <SelectItem value="admin">🛡️ Clinic Admin</SelectItem>
                  <SelectItem value="reception">📋 Receptionist</SelectItem>
                  <SelectItem value="accounts">💳 Accounts Manager</SelectItem>
                  <SelectItem value="platform">⚡ Platform Admin</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void loadStaff();
                  setQuery("");
                  setStatusFilter("all");
                  setRoleFilter("all");
                  toast.success("Staff directory reloaded from MongoDB");
                }}
                className="h-9 text-xs"
              >
                <RotateCcw className="size-3.5 mr-1" /> Reload
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={exportCsv}
                className="h-9 text-xs"
              >
                <Download className="size-3.5 mr-1" /> Export CSV
              </Button>
            </div>
          </div>
        </div>

        {/* Staff Members Table */}
        <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
          <div className="border-b border-border bg-slate-50/80 px-6 py-3.5 dark:bg-slate-800/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-primary" />
              <h2 className="text-xs font-bold text-navy uppercase tracking-wider dark:text-white">
                Hospital Staff & User Accounts ({filteredStaff.length})
              </h2>
            </div>
            {loading && (
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Clock className="size-3.5 animate-spin text-primary" /> Loading database...
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/80 bg-muted/40 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Role & Scope</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Credentials & License</th>
                  <th className="py-3 px-4">Approval Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredStaff.map((staff) => (
                  <tr key={staff.id} className="hover:bg-muted/30 transition-colors">
                    {/* Member */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-xs font-bold text-primary-foreground shadow-xs shrink-0">
                          {staff.initials || "ST"}
                        </span>
                        <div>
                          <p className="font-bold text-navy text-xs leading-tight dark:text-white">
                            {staff.fullName}
                          </p>
                          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                            ID: {staff.id?.slice(-6).toUpperCase()}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="py-3.5 px-4">
                      <p className="font-mono text-xs text-foreground truncate max-w-[180px]">{staff.email}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{staff.phone || "—"}</p>
                    </td>

                    {/* Role */}
                    <td className="py-3.5 px-4">
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold shadow-2xs",
                        staff.roleId === "doctor" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20",
                        staff.roleId === "admin" && "bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20",
                        staff.roleId === "reception" && "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20",
                        staff.roleId === "accounts" && "bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20",
                        staff.roleId === "platform" && "bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20"
                      )}>
                        {staff.roleName?.split("/")[0] || staff.roleId}
                      </span>
                    </td>

                    {/* Department */}
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-xs text-foreground">{staff.department || "Clinical Operations"}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{staff.specialty || "General Practice"}</p>
                    </td>

                    {/* Credentials */}
                    <td className="py-3.5 px-4">
                      {staff.licenseNumber ? (
                        <p className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                          {staff.licenseNumber}
                        </p>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                      {staff.qualification && (
                        <p className="text-[11px] text-slate-500 truncate max-w-[140px] mt-0.5">
                          {staff.qualification}
                        </p>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      {staff.approvalStatus === "approved" && (
                        <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 border-emerald-500/30 text-[11px] font-semibold flex items-center gap-1 w-fit">
                          <CheckCircle2 className="size-3" /> Approved (Active)
                        </Badge>
                      )}
                      {staff.approvalStatus === "pending" && (
                        <Badge className="bg-amber-500/15 text-amber-800 hover:bg-amber-500/20 border-amber-500/30 text-[11px] font-semibold flex items-center gap-1 w-fit animate-pulse">
                          <Clock className="size-3" /> Pending Review
                        </Badge>
                      )}
                      {staff.approvalStatus === "rejected" && (
                        <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/20 border-destructive/30 text-[11px] font-semibold flex items-center gap-1 w-fit">
                          <XCircle className="size-3" /> Declined
                        </Badge>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      {staff.approvalStatus === "pending" ? (
                        <Button
                          size="sm"
                          onClick={() => handleOpenApprove(staff)}
                          className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] px-3 shadow-xs"
                        >
                          <ShieldCheck className="size-3 mr-1" /> Review & Approve
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenApprove(staff)}
                          className="h-7 text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          <Key className="size-3 mr-1" /> Edit Access
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}

                {filteredStaff.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                      No hospital staff members match your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modals */}
        <AddEmployeeModal
          open={showAddModal}
          onClose={() => setShowAddModal(false)}
          onAdded={() => void loadStaff()}
        />

        <ApproveStaffModal
          open={showApproveModal}
          staff={selectedStaff}
          onClose={() => setShowApproveModal(false)}
          onUpdated={() => void loadStaff()}
        />
      </div>
    </Shell>
  );
}
