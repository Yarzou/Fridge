import { Suspense } from 'react'
import ResetPasswordClient from './ResetPasswordClient'

// useSearchParams (lecture du token) exige une frontière Suspense au prérendu.
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <ResetPasswordClient />
    </Suspense>
  )
}
