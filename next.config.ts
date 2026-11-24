import type { NextConfig } from "next";

// Standard browser hardening for every page: no embedding in other sites (clickjacking),
// no MIME sniffing, HTTPS only, and no camera/mic/location access the app doesn't use.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Tabs you've just visited are reused for 60 s instead of re-fetched, so switching back is instant.
  // Anything you save (server actions call revalidatePath) clears this straight away.
  experimental: { staleTimes: { dynamic: 60 } },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
