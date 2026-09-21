import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Stethoscope,
  Sparkles,
} from "lucide-react";
import { Shell } from "@/components/erp/Shell";
import { useErp } from "@/lib/erp/store";
import { ROLES, ROLE_ORDER } from "@/lib/erp/config";
import { cn } from "@/lib/utils";
import { OwnerPetRegistrationModal } from "@/components/erp/crm/OwnerPetRegistrationModal";
import { VisitWorkspaceModal } from "@/components/erp/clinical/VisitWorkspaceModal";
import { AdmitPatientPickerModal } from "@/components/erp/clinical/AdmitPatientPickerModal";
import { listVisitsFn, deleteVisitFn } from "@/lib/mongodb/serverFns/clinical";
import { toast } from "sonner";

// Role-specific dashboard views
import { DoctorDashboardView } from "@/components/erp/dashboards/DoctorDashboardView";
import { ReceptionistDashboardView } from "@/components/erp/dashboards/ReceptionistDashboardView";
import { AccountantDashboardView } from "@/components/erp/dashboards/AccountantDashboardView";
import { AdminDashboardView } from "@/components/erp/dashboards/AdminDashboardView";
import { RealCatJumpingWelcome } from "@/components/erp/dashboards/RealCatJumpingWelcome";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VetOS ERP — Veterinary Clinic Management Suite" },
      {
        name: "description",
        content:
          "VetOS ERP clinical operations: appointments, OPD consultation, live inventory Rx, billing, accounting and HRMS in one console.",
      },
      { property: "og:title", content: "VetOS ERP — Veterinary Clinic Management Suite" },
      {
        property: "og:description",
        content:
          "Doctor-tailored clinic ERP with live OPD queue, multi-pet CRM, dynamic inventory billing, and double-entry accounting.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { role, roleId, currentUser } = useErp();
  const activeDoctorName =
    currentUser?.fullName || (currentUser?.roleId === "doctor" ? currentUser.fullName : role.person || "Dr. Rohit Sharma");

  // Modals state
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerMode, setRegisterMode] = useState<"new-all" | "new-pet-only">("new-all");
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [showAdmitPickerModal, setShowAdmitPickerModal] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<any | null>(null);

  // OPD Queue State
  const [visits, setVisits] = useState<any[]>([]);

  useEffect(() => {
    void loadVisits();
  }, [roleId]);

  const loadVisits = async () => {
    try {
      const data = await listVisitsFn();
      setVisits(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleStartConsultation = (visit: any) => {
    setSelectedVisit({ ...visit, doctorName: visit.doctorName || activeDoctorName });
    setShowVisitModal(true);
  };

  const handleDeleteVisit = async (v: any) => {
    if (!window.confirm(`Are you sure you want to delete visit ${v.visitId} for ${v.petName || "patient"}?`)) {
      return;
    }
    try {
      await deleteVisitFn({ data: { visitId: v.visitId } });
      toast.success(`Removed visit ${v.visitId}`);
      setVisits((prev) => prev.filter((item) => item.visitId !== v.visitId));
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove visit");
    }
  };

  const handleOpenAdmitPatientPicker = () => {
    setShowAdmitPickerModal(true);
  };

  const handleAdmitPetDirectly = (pet: any) => {
    const existingActiveVisit = visits.find(
      (v) =>
        v.petId === pet.petId &&
        v.status !== "Paid" &&
        v.status !== "Settled" &&
        v.status !== "Completed"
    );
    if (existingActiveVisit) {
      handleStartConsultation(existingActiveVisit);
      return;
    }

    const newVisitDraft = {
      visitId: `V-${Math.floor(1000 + Math.random() * 9000)}`,
      prescriptionNo: `RX-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toISOString().slice(0, 10),
      branch: "Main Clinic",
      billType: "GST",
      petId: pet.petId,
      petName: pet.name,
      species: pet.species,
      breed: pet.breed,
      ownerId: pet.owner?.ownerId || pet.ownerId,
      ownerName: pet.owner?.name || "Client",
      ownerPhone: pet.owner?.phone || "N/A",
      doctorName: activeDoctorName,
      vitals: {
        weightKg: pet.weightKg || 25,
        tempC: 38.5,
        complaint: pet.allergies?.length ? `History: ${pet.allergies.join(", ")}` : "OPD Consultation",
      },
      status: "Admitted",
      items: [],
      subtotal: 0,
      totalAmount: 0,
      amountPaid: 0,
    };
    setSelectedVisit(newVisitDraft);
    setShowVisitModal(true);
  };

  return (
    <Shell title="Home Dashboard">
      <div className="mx-auto max-w-[1680px] space-y-7">
        {/* Top Header & Role Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 sm:pt-3 pb-1 border-b border-border/40">
          <motion.div
            key={roleId + "-header"}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 min-w-[280px]"
          >
            <RealCatJumpingWelcome
              personName={currentUser?.fullName || role.person}
              greetingSubtitle={role.greeting}
              branchName="Nagpur · Real Care Small Animal Clinic"
              onRefresh={loadVisits}
            />
          </motion.div>

          {/* Active Operator Scope Badge with Interactive Elevation */}
          <motion.div
            whileHover={{ y: -2, scale: 1.01 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card/90 backdrop-blur-xs px-4 py-2.5 shadow-xs hover:shadow-md hover:border-primary/40 transition-all cursor-default"
          >
            <div className="relative">
              <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-blue-600 text-xs font-black text-primary-foreground shadow-xs">
                {currentUser?.initials || role.initials}
              </span>
              {/* Online indicator dot */}
              <span className="absolute -bottom-0.5 -right-0.5 flex size-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full size-2.5 bg-emerald-500 ring-2 ring-card" />
              </span>
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-foreground leading-none">
                  {currentUser?.fullName || role.person}
                </span>
                <span className="inline-block rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold">
                  {currentUser?.roleName?.split("/")[0] || role.name}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 font-medium">
                {role.scope} · {role.scopeCaption}
              </p>
            </div>
          </motion.div>
        </div>

        {/* ── Dynamic Role-Specific Dashboard Views ──────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={roleId}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            {roleId === "doctor" && (
              <DoctorDashboardView
                role={role}
                visits={visits}
                onStartConsultation={handleStartConsultation}
                onDeleteVisit={handleDeleteVisit}
                onOpenAdmitPicker={handleOpenAdmitPatientPicker}
                onOpenRegisterModal={() => {
                  setRegisterMode("new-all");
                  setShowRegisterModal(true);
                }}
                onAdmitPet={handleAdmitPetDirectly}
              />
            )}

            {roleId === "reception" && (
              <ReceptionistDashboardView
                role={role}
                onOpenConsultation={handleStartConsultation}
              />
            )}

            {roleId === "accounts" && (
              <AccountantDashboardView
                role={role}
              />
            )}

            {(roleId === "admin" || roleId === "platform") && (
              <AdminDashboardView
                role={role}
                visits={visits}
                onStartConsultation={handleStartConsultation}
                onDeleteVisit={handleDeleteVisit}
                onOpenAdmitPicker={handleOpenAdmitPatientPicker}
                onOpenRegisterModal={() => {
                  setRegisterMode("new-all");
                  setShowRegisterModal(true);
                }}
                onAdmitPet={handleAdmitPetDirectly}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Admit Patient Appointment & Queue Selector Modal */}
        <AdmitPatientPickerModal
          open={showAdmitPickerModal}
          onClose={() => setShowAdmitPickerModal(false)}
          onSelectPatient={(visitDraft) => {
            setSelectedVisit(visitDraft);
            setShowVisitModal(true);
          }}
        />

        {/* Multi-Pet Owner CRM Modal */}
        <OwnerPetRegistrationModal
          open={showRegisterModal}
          initialMode={registerMode}
          onClose={() => setShowRegisterModal(false)}
          onRegistered={() => {
            void loadVisits();
          }}
          onAdmitToOpd={(pet, owner) => {
            const newVisitDraft = {
              visitId: `V-${Math.floor(1000 + Math.random() * 9000)}`,
              invoiceNo: `INV/2026-27/090${Math.floor(10 + Math.random() * 90)}`,
              prescriptionNo: `RX-090${Math.floor(10 + Math.random() * 90)}`,
              date: new Date().toISOString().slice(0, 10),
              branch: "Main Clinic",
              billType: "GST",
              petId: pet.petId,
              petName: pet.name,
              species: pet.species,
              breed: pet.breed,
              ownerId: owner?.ownerId || pet.ownerId,
              ownerName: owner?.name || "Client",
              ownerPhone: owner?.phone || "N/A",
              doctorName: activeDoctorName,
              vitals: {
                weightKg: pet.weightKg || 25,
                tempC: 38.5,
                complaint: pet.allergies?.length ? `History: ${pet.allergies.join(", ")}` : "OPD Consultation",
              },
              status: "Admitted",
              items: [],
              subtotal: 0,
              totalAmount: 0,
              amountPaid: 0,
            };
            setSelectedVisit(newVisitDraft);
            setShowVisitModal(true);
          }}
        />


        {/* Connected Clinical Consultation & Billing Workspace Modal */}
        {selectedVisit && (
          <VisitWorkspaceModal
            open={showVisitModal}
            onClose={() => {
              setShowVisitModal(false);
              setSelectedVisit(null);
            }}
            visit={selectedVisit}
            onVisitFinalized={(updatedVisit) => {
              if (updatedVisit) {
                setSelectedVisit(updatedVisit);
                setVisits((prev) => prev.map((v) => (v.visitId === updatedVisit.visitId ? updatedVisit : v)));
              }
              void loadVisits();
            }}
          />
        )}
      </div>
    </Shell>
  );
}
