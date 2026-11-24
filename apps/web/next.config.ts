import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', '@dnd-kit/core', '@dnd-kit/sortable'],
  },
  async redirects() {
    return [
      { source: '/hotseat', destination: '/masterclass', permanent: false },
      // mentoria virou Consultoria GOON Advisor: links antigos (stories, YouTube) continuam funcionando, com o ?c=
      { source: '/mentoria', destination: '/consultoria', permanent: false },
    ]
  },
}

export default nextConfig
