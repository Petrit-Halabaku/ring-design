/**
 * Content for the 5-step ring-builder walkthrough, transcribed from
 * casalejewelers.net/custom-ring-builder/
 */

export type Metal = "yellow" | "white" | "rose";
export type StoneType = "natural" | "lab";

export const METALS: { id: Metal; background: string }[] = [
  {
    id: "yellow",
    background:
      "linear-gradient(30deg, #e1b94f 0%, #faf1d8 55%, #faf1d8 60%, #e1b94f 100%)",
  },
  {
    id: "white",
    background:
      "linear-gradient(30deg, #b3b2af 0%, #f7f7f7 55%, #f7f7f7 60%, #b3b2af 100%)",
  },
  {
    id: "rose",
    background:
      "linear-gradient(30deg, #ec8a55 0%, #fcede2 55%, #fcede2 60%, #ec8a55 100%)",
  },
];

export const RING_STYLES = [
  { id: "solitaire", title: "Solitaire", desc: "Timeless and elegant" },
  { id: "halo", title: "Halo", desc: "Captivating and radiant" },
  { id: "hiddenhalo", title: "Hidden Halo", desc: "Subtle yet brilliant" },
  { id: "bezel", title: "Bezel", desc: "Sleek and contemporary" },
  { id: "cathedral", title: "Cathedral", desc: "Elevated and graceful" },
  { id: "fullpave", title: "Full Pavé", desc: "Ornate and detailed" },
  { id: "toietmoi", title: "Toi et Moi", desc: "Romantic and symbolic" },
  { id: "threestone", title: "Three Stone", desc: "Timeless triple brilliance" },
] as const;

export const DIAMOND_SHAPES = [
  { id: "round", title: "Round", desc: "The most brilliant cut" },
  { id: "oval", title: "Oval", desc: "Elongates the finger" },
  { id: "cushion", title: "Cushion", desc: "Classic with soft corners" },
  { id: "emerald", title: "Emerald", desc: "Step-cut for clarity" },
  { id: "princess", title: "Princess", desc: "Square with sharp corners" },
  { id: "asscher", title: "Asscher", desc: "Step-cut with square shape" },
  { id: "marquise", title: "Marquise", desc: "Elongated with pointed ends" },
  { id: "pear", title: "Pear", desc: "Combines round and marquise" },
  {
    id: "radiant",
    title: "Radiant",
    desc: "Square or rectangular with brilliant cut",
  },
] as const;

export const CARATS = [
  { id: "carat-0.5", title: "0.5 carat" },
  { id: "carat-1", title: "1 carat" },
  { id: "carat-1.5", title: "1.5 carat" },
  { id: "carat-2", title: "2 carat" },
  { id: "carat-2.5", title: "2.5 carat" },
  { id: "carat-3", title: "3 carat" },
  { id: "carat-4", title: "4 carat" },
  { id: "carat-5", title: "5 carat" },
] as const;

export const TIMELINES = [
  { id: "1-4-weeks", title: "1 - 4 weeks" },
  { id: "1-3-months", title: "1 - 3 months" },
  { id: "3-6-months", title: "3 - 6 months" },
  { id: "not-sure", title: "Not sure yet" },
] as const;

export const LOCATION_GROUPS = [
  {
    state: "New Jersey",
    locations: [
      {
        id: "red-bank",
        name: "Casale Jewelers - Red Bank",
        address:
          "By Appointment Only, 157 Broad St #203, Red Bank, NJ 07701, USA",
        hours: "Tue-Wed: 8am-6pm, Fri: 8am-6pm, Sat: 7am-1pm",
      },
    ],
  },
  {
    state: "New York",
    locations: [
      {
        id: "staten-island",
        name: "Casale Jewelers - Staten Island",
        address: "1639 Richmond Rd, Staten Island, NY 10304, USA",
        hours: "Tue-Wed: 10am-6pm, Thu: 10am-7pm, Fri: 10am-6pm, Sat: 10am-5pm",
      },
    ],
  },
] as const;

export const STEP_COPY = [
  {
    title: "Let's start designing your ring",
    subtitle:
      "Get started quickly. Don't worry, you'll be able to fully customize your design in our 3D Ring Designer.",
  },
  {
    title: "Choose your center stone",
    subtitle: "The star of the show - your main diamond",
  },
  {
    title: "Select your center stone size",
    subtitle:
      "Once you're in the ring designer you can easily set an exact carat weight",
  },
  {
    title: "When do you need your ring?",
    subtitle: "Help us recommend the best timeline for your ring",
  },
  {
    title: "Select your preferred store location",
    subtitle: "We'll make sure your experience is tailored to this location",
  },
] as const;

export const TOTAL_STEPS = STEP_COPY.length;
