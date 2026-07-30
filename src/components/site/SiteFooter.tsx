import Link from "next/link";

const COLUMNS = [
  {
    heading: "About Us",
    links: [
      "About Us",
      "In the Media",
      "Our Promise",
      "Our Team",
      "Our Blog",
      "Products",
      "Quality",
      "Testimonials",
      "Why Shop Us",
      "Our Locations",
    ],
  },
  {
    heading: "Services",
    links: [
      "Redesign Your Jewelry",
      "Jewelry Appraisals",
      "Corporate Gifts",
      "Custom Jewelry Designs",
      "Financing",
      "Jewelry Engraving",
      "Casale Jewelers Gold, Diamond & Rolex Buyers",
      "Jewelry Insurance",
      "Jewelry Repairs",
      "Laser Repairs",
      "Pearl & Bead Restringing",
      "Watch Repairs",
    ],
  },
  {
    heading: "Education",
    links: [
      "Diamond Guide",
      "Gemstone Guide",
      "Gifts",
      "Maintenance",
      "Metal Types",
      "Pearl Facts",
      "Repairs",
      "Resizing",
      "Ring Styles",
      "Setting Types",
      "Styles",
      "Tips & Tricks",
    ],
  },
];

const STORES = [
  {
    city: "Red Bank, NJ",
    lines: ["157 Broad Street - Suite 203", "By Appointment Only", "Red Bank, NJ 07701"],
    hours: [
      ["Tue - Wed", "8AM - 6PM"],
      ["Thu", "8AM - 7PM"],
      ["Fri", "8AM - 6PM"],
      ["Sat", "7AM - 1PM"],
      ["Sun", "Closed"],
      ["Mon", "Closed"],
    ],
  },
  {
    city: "Staten Island, NY",
    lines: ["1639 Richmond Road", "Staten Island, NY 10304", "View Map"],
    hours: [
      ["Tue - Wed", "10AM - 6PM"],
      ["Thu", "10AM - 7PM"],
      ["Fri", "10AM - 6PM"],
      ["Sat", "10AM - 5PM"],
      ["Sun", "Closed"],
      ["Mon", "Closed"],
    ],
  },
];

const SOCIALS = [
  {
    name: "Pinterest",
    path: "M12 2a10 10 0 00-3.6 19.3c-.1-.8-.2-2 0-2.9l1.2-5s-.3-.6-.3-1.5c0-1.4.8-2.4 1.8-2.4.9 0 1.3.6 1.3 1.4 0 .9-.6 2.2-.9 3.4-.2 1 .5 1.8 1.5 1.8 1.8 0 3.1-2.3 3.1-5 0-2.1-1.4-3.6-3.9-3.6-2.8 0-4.5 2.1-4.5 4.4 0 .8.2 1.4.6 1.9.2.2.2.3.1.5l-.2.8c0 .3-.2.4-.5.2-1.3-.5-1.9-2-1.9-3.6 0-2.7 2.3-5.9 6.8-5.9 3.6 0 6 2.6 6 5.4 0 3.7-2.1 6.5-5.1 6.5-1 0-2-.6-2.3-1.2l-.6 2.5c-.2.8-.7 1.8-1.1 2.4A10 10 0 1012 2z",
  },
  {
    name: "Facebook",
    path: "M22 12a10 10 0 10-11.6 9.9v-7h-2.5V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0022 12z",
  },
  {
    name: "Instagram",
    path: "M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.3 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.3 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.3-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.3-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4 1.3-.1 1.7-.1 4.8-.1zm0 3.2A6.6 6.6 0 1018.6 12 6.6 6.6 0 0012 5.4zm0 10.9A4.3 4.3 0 1116.3 12 4.3 4.3 0 0112 16.3zm8.4-11.2a1.5 1.5 0 11-1.5-1.5 1.5 1.5 0 011.5 1.5z",
  },
  {
    name: "Twitter",
    path: "M22 5.9c-.7.3-1.5.5-2.4.6a4.1 4.1 0 001.8-2.3c-.8.5-1.7.8-2.6 1a4.1 4.1 0 00-7 3.7A11.6 11.6 0 013.4 4.6a4.1 4.1 0 001.3 5.5c-.7 0-1.3-.2-1.9-.5a4.1 4.1 0 003.3 4 4.2 4.2 0 01-1.9.1 4.1 4.1 0 003.8 2.9A8.2 8.2 0 012 18.3a11.6 11.6 0 006.3 1.8c7.5 0 11.7-6.3 11.7-11.7v-.5A8.2 8.2 0 0022 5.9z",
  },
];

export default function SiteFooter() {
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-12 md:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <h2 className="font-[family-name:var(--font-lora)] text-2xl text-neutral-800">
                {col.heading}
              </h2>
              <ul className="mt-4 space-y-2.5 text-[13px] text-neutral-600">
                {col.links.map((l) => (
                  <li key={l}>
                    <Link href="/" className="hover:text-neutral-900 hover:underline">
                      {l}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <div className="flex gap-4 text-neutral-700">
              {SOCIALS.map((s) => (
                <Link key={s.name} href="/" aria-label={s.name}>
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                    <path d={s.path} />
                  </svg>
                </Link>
              ))}
            </div>

            <div className="mt-6 space-y-8">
              {STORES.map((store) => (
                <div key={store.city}>
                  <h3 className="text-[15px] font-medium text-neutral-800">
                    {store.city}
                  </h3>
                  <div className="mt-2 space-y-0.5 text-[13px] text-neutral-600">
                    {store.lines.map((line) => (
                      <div key={line}>{line}</div>
                    ))}
                  </div>
                  <div className="mt-3 text-[13px] font-medium text-neutral-800">
                    Store Hours
                  </div>
                  <table className="mt-1 text-[13px] text-neutral-600">
                    <tbody>
                      {store.hours.map(([day, time]) => (
                        <tr key={day}>
                          <td className="pr-6">{day}</td>
                          <td>{time}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-neutral-200 pt-6">
          <Link
            href="/"
            className="font-[family-name:var(--font-lora)] text-lg text-neutral-800 hover:underline"
          >
            Learn Our Story
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-neutral-500">
            <span>Copyright © 2026 Casale Jewelers</span>
            <Link href="/" className="hover:underline">
              Terms and Conditions
            </Link>
            <Link href="/" className="hover:underline">
              Privacy Policy
            </Link>
          </div>
          <div className="mt-2 text-[12px] text-neutral-500">
            Jewelry Website Design by Thinkspace
          </div>
        </div>
      </div>
    </footer>
  );
}
