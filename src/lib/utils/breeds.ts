/** Breed suggestions per species; inputs stay free-text, these only feed a <datalist>. */
export const BREEDS_BY_SPECIES: Record<string, string[]> = {
  Canine: [
    "Labrador Retriever", "Golden Retriever", "German Shepherd", "Indie / Mixed", "Shih Tzu", "Beagle",
    "Rottweiler", "Pomeranian", "Pug", "Labrador Mix", "Doberman", "Great Dane", "Boxer", "Cocker Spaniel",
    "Siberian Husky", "Dachshund", "Lhasa Apso", "French Bulldog", "English Bulldog", "Saint Bernard",
    "Chihuahua", "Maltese", "Pekingese", "Mastiff", "Dalmatian", "Border Collie", "Indian Pariah",
    "Spitz", "Samoyed", "Cane Corso", "Bull Terrier", "Yorkshire Terrier", "Jack Russell Terrier",
  ],
  Feline: [
    "Persian", "Domestic Shorthair", "Indie Cat", "Siamese", "British Shorthair", "Maine Coon", "Bengal",
    "Ragdoll", "Sphynx", "Himalayan", "Scottish Fold", "Abyssinian", "Russian Blue", "Birman",
  ],
  Avian: [
    "Budgerigar", "Cockatiel", "Lovebird", "Indian Ringneck", "Pigeon", "African Grey", "Macaw",
    "Cockatoo", "Conure", "Finch", "Canary",
  ],
  Rabbit: ["Netherland Dwarf", "Holland Lop", "Angora", "Domestic Rabbit", "Lionhead", "Mini Rex"],
  Exotic: ["Guinea Pig", "Hamster", "Turtle / Terrapin", "Iguana", "Ferret", "Tortoise", "Bearded Dragon"],
  Other: ["Mixed / Crossbreed", "Standard"],
};
