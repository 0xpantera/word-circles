const API_URL = process.env.API_URL;

export async function GET(req: Request) {
  if (!API_URL) return Response.json({ count: 0 });
  const address = new URL(req.url).searchParams.get("address") ?? "";
  const res = await fetch(
    `${API_URL}/api/referrals/count?address=${encodeURIComponent(address)}`,
  );
  return new Response(res.body, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
