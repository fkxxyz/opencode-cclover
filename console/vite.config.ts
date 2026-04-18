import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const allowedHosts = env.ALLOWED_HOSTS
    ? env.ALLOWED_HOSTS.split(",")
        .map((host) => host.trim())
        .filter(Boolean)
    : []

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      host: true,
      allowedHosts,
    },
  }
})
