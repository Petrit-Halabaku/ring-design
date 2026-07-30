/**
 * Shapes returned by the StoneAlgo/Jeweleros configurator backend
 * (`sa-custom-backend.onrender.com/stone-algo-backend`), transcribed from live responses.
 */

export type MeshRef = {
  name: string;
  type: string;
  _id?: string;
};

/** `stone/get-all` — one entry per diamond shape. */
export type Stone = {
  _id: string;
  name: string;
  /** GLB model on S3. */
  glbUrl: string;
  /**
   * Per-axis scale exponents. A stone's linear dimensions scale by
   * `carat ** multiplier[axis]`, so a 2ct round is only ~1.26× as wide as a 1ct.
   */
  caratWeightMultiplier: { L: number; W: number; D: number };
  /** Millimetres, at 1 carat. */
  dimensions: {
    length: number;
    width: number;
    depth: number;
    pavHeight: number;
    girdleThickness: number;
    crownHeight: number;
  };
  meshes: MeshRef[];
};

/** `colorcustomisation/get-all` and `.../get-by-type/Prong` — metal options. */
export type MetalColor = {
  _id: string;
  name: string;
  material: { color: string };
  type: string;
  /** Swatch colour for the UI. */
  backgroundColor: string;
  uiValue: string;
  description: string;
};

/** `prongoption/get-by-type/Arm` and `.../Tip`. */
export type ProngOption = {
  _id: string;
  type: "Arm" | "Tip";
  value: string;
  glbUrl: string;
  meshes: MeshRef[];
  uiValue: string;
  description: string;
};

/** `baskethalo/get-all` — head styles (no geometry attached). */
export type BasketHalo = {
  uiValue: string;
  description: string;
};

export type CaratRange = {
  _id?: string;
  value: number;
  min: number;
  max: number;
};

/** `caratweight/get-all` — allowed carat range per stone slot. */
export type CaratWeights = {
  solitaire: { center: CaratRange };
  twoStones: { left: CaratRange; right: CaratRange };
  threeStones: { center: CaratRange; left: CaratRange; right: CaratRange };
  _id?: string;
};

export type RingSettings = {
  stones: Stone[];
  metals: MetalColor[];
  prongArms: ProngOption[];
  prongTips: ProngOption[];
  basketHalos: BasketHalo[];
  caratWeights: CaratWeights;
};
