import { defineConfig } from "vite";
import laravel from "laravel-vite-plugin";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
    plugins: [
        laravel({ input: ["resources/js/app.tsx"], refresh: true }),
        react(),
        tailwindcss(),
    ],
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    react: ["react", "react-dom", "react-router-dom"],
                    query: ["@tanstack/react-query", "@tanstack/react-table"],
                    forms: [
                        "react-hook-form",
                        "zod",
                        "@hookform/resolvers/zod",
                    ],
                },
            },
        },
    },
    server: { host: "127.0.0.1", port: 5174, strictPort: true },
});
