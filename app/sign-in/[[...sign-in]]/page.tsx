import AuthWrapper from '@/app/components/AuthWrapper'
import { SignIn } from '@clerk/nextjs'

export default function Page() {
  return (
    <AuthWrapper>
      <SignIn />
    </AuthWrapper>
  )
}