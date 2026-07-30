/* eslint-disable @next/next/no-img-element -- plain <img> matches the original markup that the copied CSS sizes directly */
import Link from "next/link";

const MAIN_NAV = [
  "Engagement & Wedding",
  "Diamonds",
  "Designers",
  "Jewelry & Watches",
  "About",
  "Contact",
];

function Star() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-neutral-800">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

export default function SiteHeader() {
  return (
    <header>
      {/* Account bar */}
      <div className="bg-[#2b2320] px-4 py-2.5 text-[13px] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-6">
          <span className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
              <path d="M12 21s-8-5.1-8-10.2A4.8 4.8 0 0112 7a4.8 4.8 0 018 3.8C20 15.9 12 21 12 21z" />
            </svg>
            Wish List
          </span>
          <span className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
              <path d="M7 4h-2l-1 2H2v2h2l3 9h11l3-9H7z" />
              <circle cx="9" cy="20" r="1.5" />
              <circle cx="17" cy="20" r="1.5" />
            </svg>
            Cart
          </span>
          <span className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" />
            </svg>
            Login
          </span>
        </div>
      </div>

      {/* Masthead */}
      <div className="mx-auto grid max-w-6xl items-center gap-6 px-4 py-6 md:grid-cols-[1fr_auto_1fr] md:px-8">
        <div className="order-2 text-[13px] leading-6 text-neutral-700 md:order-1">
          <div>Call Staten Island: 718-351-8300</div>
          <div>Call Red Bank: 732-370-6777</div>
        </div>

        <Link href="/" className="order-1 justify-self-center md:order-2">
          <img
            src="/brand/casale-logo.webp"
            alt="Casale Jewelers Logo"
            className="h-28 w-auto"
          />
        </Link>

        <div className="order-3 flex flex-col items-center gap-3 md:items-end">
          <div className="text-center md:text-right">
            <div className="font-[family-name:var(--font-lora)] text-[13px] italic text-neutral-800">
              5.0 Star Average Review
            </div>
            <div className="mt-1 flex justify-center gap-0.5 md:justify-end">
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} />
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 md:items-end">
            <button className="w-[240px] bg-[#111111] px-5 py-2.5 text-[13px] text-white transition-opacity hover:opacity-90">
              Book Appointment in Red Bank
            </button>
            <button className="w-[240px] bg-[#111111] px-5 py-2.5 text-[13px] text-white transition-opacity hover:opacity-90">
              Book Appointment in Staten Island
            </button>
            <button className="w-[240px] bg-[#111111] px-5 py-2.5 text-[13px] text-white transition-opacity hover:opacity-90">
              Book Wedding Band Week
            </button>
          </div>

          <form className="flex w-full max-w-[240px] border border-neutral-300">
            <input
              type="search"
              placeholder="Search"
              aria-label="Search"
              className="w-full px-3 py-2 text-[13px] outline-none"
            />
            <button
              type="submit"
              aria-label="Submit search"
              className="border-l border-neutral-300 px-3"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
            </button>
          </form>
        </div>
      </div>

      {/* Main nav */}
      <nav className="border-t border-neutral-200">
        <ul className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-7 gap-y-2 px-4 py-4 text-[13px] uppercase tracking-wide text-neutral-800">
          {MAIN_NAV.map((item) => (
            <li key={item}>
              <Link href="/" className="hover:underline">
                {item}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
