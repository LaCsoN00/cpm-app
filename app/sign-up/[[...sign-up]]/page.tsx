import AuthWrapper from '@/app/components/AuthWrapper'
import { SignUp } from '@clerk/nextjs'

export default function Page() {
  return (
    <AuthWrapper>
      <SignUp />
    </AuthWrapper>
  )
}