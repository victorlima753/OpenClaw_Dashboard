const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#08111f"/>
  <path d="M16 38h9v10h-9V38Zm12-22h9v32h-9V16Zm12 12h9v20h-9V28Z" fill="#27d3a2"/>
  <path d="M14 52h36" stroke="#60a5fa" stroke-width="4" stroke-linecap="round"/>
</svg>`;

export function GET() {
  return new Response(icon, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400"
    }
  });
}
