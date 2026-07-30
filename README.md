# Custom Ring Builder — Next.js copy


Three layers stacked on one URL:

1. **Site chrome** — the Casale Jewelers header, breadcrumb, `Custom Ring Builder`
   H1 and footer (Lora headings, Roboto body).
2. **A 5-step walkthrough** that covers the whole viewport on load. It is not an
   iframe — it is injected into the host page by
   `jeweleros.com/static/dist/jos.js` under `jos-*` class names.
3. **A 3D ring designer** that replaces the walkthrough when it finishes, served
   in an iframe from `jeweleros-custom.netlify.app`.

## What this repo reproduces

| Layer | Status |
| --- | --- |
| Site header, breadcrumb, H1, footer | Rebuilt from the live DOM |
| 5-step walkthrough | Full copy — original CSS, copy, images, flow |
| `Building your dream ring...` interstitial | Rebuilt |
| Settings API | Replicated — same endpoints, typed client, snapshot fallback |
| 3D designer | Real GLB models rendered with the original's three.js pipeline |

## The settings API

The configurator boots by calling a public, unauthenticated REST backend at
`https://sa-custom-backend.onrender.com/stone-algo-backend`:

| Endpoint | Gives |
| --- | --- |
| `stone/get-all` | 10 diamond shapes: `glbUrl`, mm dimensions, carat scaling exponents |
| `colorcustomisation/get-all` | 7 metals with hex colour and swatch colour |
| `colorcustomisation/get-by-type/Prong` | Prong metals |
| `prongoption/get-by-type/Arm` | 3 prong arms with `glbUrl` |
| `prongoption/get-by-type/Tip` | 7 prong tips with `glbUrl` |
| `baskethalo/get-all` | 9 head styles |
| `caratweight/get-all` | Carat min/max per stone slot |
| `ring/get-by-key-for-config/{key}` | A saved ring (404 `"Ring Not Found"` otherwise) |

[`src/lib/settings/client.ts`](src/lib/settings/client.ts) calls all of them in
parallel, exactly as the original does. Responses are committed under
`snapshot/` and used by default; set `NEXT_PUBLIC_USE_LIVE_SETTINGS=1` to hit the
network instead. The backend is a free-tier Render dyno that cold-starts slowly,
so every call falls back to its snapshot.

Carat scaling is a per-axis power law from the API — `size = size1ct * carat ** exponent`,
with exponents near ⅓ because mass grows with volume. See
[`geometry.ts`](src/lib/settings/geometry.ts).

## How the 3D works

The original is **react-three-fiber + drei** with GLTF/DRACO/KTX2 loaders and
`three-bvh-csg`. Models are GLBs on S3 (`jeweleros.s3.us-east-1.amazonaws.com/glb/`)
plus parts served from the app root (`/test/band/…`, `/using/…`). Metal is
`MeshPhysicalMaterial` lit by `env_metal_flat.hdr`; stones use drei's
`MeshRefractionMaterial`. All of it is mirrored into `public/`.

[`RingScene.tsx`](src/components/three/RingScene.tsx) rebuilds that pipeline.
Three things worth knowing, all found the hard way:

- **The models don't share a unit convention.** Diamonds are authored at
  1 unit = 100mm with no root scale; metal parts carry a ×100 root scale that
  lands them in millimetres. Each part is measured and scaled to the millimetre
  size the API reports rather than trusting its units. GLB axes map as
  x = width, y = depth, z = length, consistently across all nine shapes.
- **`ClawTip.glb` carries morph targets.** Rendering its geometry on a plain
  `<mesh>` leaves `morphTargetInfluences` undefined, which three dereferences
  every frame — a silent per-frame throw that stops the render mid-scene. They're
  stripped in [`useGlbMeshes.ts`](src/components/three/useGlbMeshes.ts).
- **`MeshRefractionMaterial` needs a cube map**, so the equirectangular HDR is
  projected onto one first.

Not reproduced: the vendor sweeps the shank from a profile piece
(`Band0.9Piece0.22`) and boolean-subtracts manufacturing meshes with
`three-bvh-csg`. The shank here is a procedural torus driven by the real
ring-size and band-width controls. Prongs are the vendor's real `ClawTip.glb`,
instanced around the stone.

Stones with no reachable model are filtered out of the picker rather than
silently falling back — the vendor's S3 serves `HeartDiamond.glb` as 403.

## Layout

```
src/
  app/
    layout.tsx                     Lora + Roboto, global + wizard CSS
    page.tsx                       Simple home page
    custom-ring-builder/page.tsx   Site chrome + builder overlay
  components/
    site/SiteHeader.tsx            Utility bar, masthead, main nav
    site/SiteFooter.tsx            Link columns, socials, store hours
    builder/CustomRingBuilder.tsx  wizard → loading → designer
    builder/RingWizard.tsx         The 5 steps
    builder/LoadingScreen.tsx      Interstitial
    builder/RingDesigner.tsx       Designer shell, API-driven panels
    builder/data.ts                Step content
    three/RingScene.tsx            r3f canvas: stone, prongs, shank, materials
    three/useGlbMeshes.ts          GLB → meshes with baked world transforms
    three/RingViewer.tsx           Client-only wrapper (WebGL can't SSR)
  lib/settings/client.ts           Settings API client + snapshot fallback
  lib/settings/types.ts            Response shapes
  lib/settings/geometry.ts         Carat → millimetre power law
  lib/settings/models.ts           Remote glbUrl → local mirror
  styles/wizard.css                The original `jos-*` stylesheet
public/
  rings/    8 styles × 3 metals, from jos0.b-cdn.net (200×200)
  shapes/   9 diamond shape SVGs, from jeweleros.com
  models/   9 diamond GLBs, ClawTip, band/halo/basket parts
  hdr/      The vendor's diamond and metal environment maps
  brand/    Casale Jewelers logo
```

## The five steps

1. **Let's start designing your ring** — metal swatch (yellow / white / rose)
   plus 8 ring styles and *Start from scratch*.
2. **Choose your center stone** — Natural / Lab Grown toggle, 9 diamond shapes,
   *Decide later*. Option text tints green for natural, blue for lab.
3. **Select your center stone size** — 0.5 to 5 carat, *Decide later*.
4. **When do you need your ring?** — four timelines.
5. **Select your preferred store location** — state accordions (New Jersey, New
   York) with store cards, *Decide later*.

`Skip` in the top-right jumps straight to the designer at any point; the top-left
chips record each choice, and `Back` steps through them.

## Note on assets

Images and CSS come from Casale Jewelers and its vendor Jeweleros. They are
copied here for a like-for-like reproduction — replace them before using this
anywhere public.
