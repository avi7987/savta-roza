import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = defineCloudflareConfig({});

// `npm run build` runs this Cloudflare build, so the Next.js step itself must not call `npm run build` again
config.buildCommand = "npx next build";

export default config;
