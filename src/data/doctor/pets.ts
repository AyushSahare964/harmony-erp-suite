import type { Pet } from "./types";

// Sample patients (copied from reference/vetos-dashboard-v2.html).
export const pets: Pet[] = [
  {
    id: "bruno",
    name: "Bruno",
    breed: "Golden Retriever",
    age: "4 yrs",
    sex: "Male",
    owner: "Rahul Mehta",
    phone: "98200 12345",
    vaccine: { name: "Rabies + DHPPi", last: "2025-08-14", due: "2026-08-14" },
    deworm: { name: "Drontal Plus", last: "2026-09-20", due: "2026-12-20" },
  },
  {
    id: "brownie",
    name: "Brownie",
    breed: "Labrador",
    age: "2 yrs",
    sex: "Female",
    owner: "Anita Rao",
    phone: "98765 43210",
    vaccine: { name: "Rabies + DHPPi", last: "2026-03-02", due: "2027-03-02" },
    deworm: { name: "Drontal Plus", last: "2026-07-10", due: "2026-10-10" },
  },
  {
    id: "brutus",
    name: "Brutus",
    breed: "Pug",
    age: "6 yrs",
    sex: "Male",
    owner: "Sameer Khan",
    phone: "98111 22334",
    vaccine: { name: "Rabies + DHPPi", last: "2026-09-01", due: "2027-09-01" },
    deworm: { name: "Milbemax", last: "2026-08-01", due: "2026-10-30" },
  },
  {
    id: "luna",
    name: "Luna",
    breed: "Persian cat",
    age: "3 yrs",
    sex: "Female",
    owner: "Priya Nair",
    phone: "98900 11223",
    vaccine: { name: "Tricat + Rabies", last: "2026-01-15", due: "2027-01-15" },
    deworm: { name: "Drontal Cat", last: "2026-06-05", due: "2026-09-05" },
  },
  {
    id: "simba",
    name: "Simba",
    breed: "Indie cat",
    age: "1 yr",
    sex: "Male",
    owner: "Kavita Joshi",
    phone: "97300 55667",
    vaccine: { name: "Tricat", last: "2026-05-20", due: "2027-05-20" },
    deworm: { name: "Drontal Cat", last: "2026-09-28", due: "2026-12-28" },
  },
  {
    id: "max",
    name: "Max",
    breed: "Beagle",
    age: "5 yrs",
    sex: "Male",
    owner: "Arjun Patil",
    phone: "99220 66778",
    vaccine: { name: "Rabies + DHPPi", last: "2025-10-03", due: "2026-10-03" },
    deworm: { name: "Drontal Plus", last: "2026-07-25", due: "2026-10-25" },
  },
];

/** Pets shown under "Recent searches" when the search box is empty. */
export const recentPetIds = ["bruno", "luna", "max"];

export const findPet = (id: string) => pets.find((p) => p.id === id);
