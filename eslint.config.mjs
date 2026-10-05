// Configuration ESLint « flat config » (ESLint 9+), reprise de neighborshare.
//
// `next lint` n'existe plus dans Next 16 et ESLint 9 ne lit plus .eslintrc :
// ne pas en recréer. eslint-config-next 16 exporte directement des flat configs.
//
// Usage : npm run lint  ·  npm run lint:fix

import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'

const config = [
  {
    ignores: [
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      'public/**',
      '.idea/**',
    ],
  },

  ...nextCoreWebVitals,
]

export default config
