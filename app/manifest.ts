import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ZewedJobs',
    short_name: 'ZewedJobs',
    description: 'Ethiopia\'s #1 job search platform',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ff0042',
    orientation: 'portrait',
    icons: [
      {
        src: '/icons/icon-72x72.png',
        sizes: '72x72',
        type: 'image/png',
      },
      {
        src: '/icons/icon-96x96.png',
        sizes: '96x96',
        type: 'image/png',
      },
      {
        src: '/icons/icon-128x128.png',
        sizes: '128x128',
        type: 'image/png',
      },
      {
        src: '/icons/icon-144x144.png',
        sizes: '144x144',
        type: 'image/png',
      },
      {
        src: '/icons/icon-152x152.png',
        sizes: '152x152',
        type: 'image/png',
      },
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-384x384.png',
        sizes: '384x384',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Search Jobs',
        short_name: 'Search',
        description: 'Find your next job',
        url: '/search',
        icons: [{ src: '/icons/search.png', sizes: '96x96' }],
      },
      {
        name: 'Free Courses',
        short_name: 'Courses',
        description: 'Learn new skills',
        url: '/courses',
        icons: [{ src: '/icons/courses.png', sizes: '96x96' }],
      },
    ],
    categories: ['business', 'education', 'employment'],
  }
}
