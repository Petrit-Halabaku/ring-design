// import Link from "next/link";
import CustomRingBuilder from "@/components/builder/CustomRingBuilder";
// import SiteFooter from "@/components/site/SiteFooter";
// import SiteHeader from "@/components/site/SiteHeader";

export const metadata = {
  title: "Custom Ring Builder",
};

export default function CustomRingBuilderPage() {
  return (
    <>
      {/* <SiteHeader />

      <nav aria-label="Breadcrumb" className="border-t border-neutral-200">
        <ol className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 text-[13px] text-neutral-600 md:px-8">
          <li>
            <Link href="/" className="hover:underline">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-neutral-800">Custom Ring Builder</li>
        </ol>
      </nav>

      <main className="flex-1">
        <h1 className="px-4 py-16 text-center text-[56px] leading-tight text-neutral-800">
          Custom Ring Builder
        </h1>
      </main>

      <SiteFooter /> */}

      {/* Full-screen walkthrough overlay, as on the live page */}
      <CustomRingBuilder />
    </>
  );
}
