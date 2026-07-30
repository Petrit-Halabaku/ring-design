import Link from "next/link";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 py-24 text-center md:px-8">
          <h1 className="text-[56px] leading-tight text-neutral-800">
            Truly Unique
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-7 text-neutral-600">
            Design an engagement ring that is entirely your own — choose a style, a
            center stone, and every detail in our 3D Ring Designer.
          </p>
          <Link
            href="/custom-ring-builder"
            className="mt-8 inline-block bg-[#111111] px-8 py-3.5 text-[14px] text-white transition-opacity hover:opacity-90"
          >
            Start the Custom Ring Builder
          </Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
