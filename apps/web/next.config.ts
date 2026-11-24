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
      // mentoria virou Consultoria GOON Advisor (link /advisor): links antigos continuam funcionando, com o ?c=
      { source: '/mentoria', destination: '/advisor', permanent: false },
      { source: '/consultoria', destination: '/advisor', permanent: false },
    ]
  },
}

export default nextConfig
