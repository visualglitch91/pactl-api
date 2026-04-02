import { $ } from "bun";

const PORT = Number(process.env.PORT) || 3000;
const BALANCE_RATIO = Number(process.env.BALANCE_RATIO) || 1;

async function getVolume(): Promise<number> {
  const out = await $`pactl get-sink-volume @DEFAULT_SINK@`.text();
  // Output: "Volume: front-left: 65536 /  100% / 0.00 dB,   front-right: 65536 /  100% / 0.00 dB"
  // When BALANCE_RATIO != 1, left channel is amplified — read the right channel as the logical volume
  const matches = [...out.matchAll(/(\d+)%/g)];
  if (matches.length === 0) throw new Error("Could not parse volume from pactl output");
  const match = matches.length >= 2 ? matches[1] : matches[0];
  return Number(match[1]);
}

async function setVolume(value: number): Promise<void> {
  const left = `${Math.round(value * BALANCE_RATIO)}%`;
  const right = `${value}%`;
  await $`pactl set-sink-volume @DEFAULT_SINK@ ${left} ${right}`;
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/volume") {
      if (req.method === "GET") {
        const volume = await getVolume();
        return Response.json({ volume });
      }

      if (req.method === "PUT") {
        const body = await req.json().catch(() => null);
        if (body === null || typeof body.volume !== "number") {
          return Response.json({ error: "Body must be { volume: number }" }, { status: 400 });
        }
        await setVolume(body.volume);
        return Response.json({ volume: body.volume });
      }

      return new Response("Method Not Allowed", { status: 405 });
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`volume-api listening on port ${PORT}`);
