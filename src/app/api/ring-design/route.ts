import { buildDesignEmail } from "@/lib/designer/designEmail";
import { fetchRingSettings } from "@/lib/settings/client";

const EMAILJS_SEND_URL = "https://api.emailjs.com/api/v1.0/email/send";

export async function POST(request: Request) {
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    return Response.json({ error: "Expected a JSON ring design." }, { status: 415 });
  }

  let design: unknown;
  try {
    design = await request.json();
  } catch {
    return Response.json({ error: "Invalid ring design." }, { status: 400 });
  }

  const serviceId = process.env.EMAILJS_SERVICE_ID?.trim();
  const templateId = process.env.EMAILJS_DESIGN_TEMPLATE_ID?.trim();
  const publicKey = process.env.EMAILJS_PUBLIC_KEY?.trim();
  const privateKey = process.env.EMAILJS_PRIVATE_KEY?.trim();
  if (!serviceId || !templateId || !publicKey || !privateKey) {
    console.error("Ring design email credentials are missing.");
    return Response.json({ error: "Design email is unavailable." }, { status: 503 });
  }

  const settings = await fetchRingSettings(AbortSignal.timeout(5000));
  const requestUrl = new URL(request.url);
  // Next can use its internal server hostname when constructing the request URL.
  const host = request.headers.get("host");
  const designOrigin = host ? new URL(`${requestUrl.protocol}//${host}`) : requestUrl;
  const params = buildDesignEmail(design, settings, designOrigin);
  if (!params) {
    return Response.json({ error: "Invalid ring design." }, { status: 400 });
  }

  try {
    const response = await fetch(EMAILJS_SEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        accessToken: privateKey,
        template_params: params,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (response.ok) return Response.json({ saved: true });

    console.error("EmailJS rejected the ring design email.", response.status);
    if (response.status === 429) {
      return Response.json({ error: "Too many save requests. Try again shortly." }, { status: 429 });
    }
  } catch {
    console.error("Ring design email could not reach EmailJS.");
  }

  return Response.json({ error: "Could not send the design email." }, { status: 502 });
}
