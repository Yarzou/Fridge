import { Suspense } from 'react'
import RegisterClient from './RegisterClient'

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <RegisterClient />
    </Suspense>
  )
}
