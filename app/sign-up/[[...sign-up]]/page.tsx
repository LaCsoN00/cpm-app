import AuthWrapper from '@/app/components/AuthWrapper'
import SupabaseAuth from '@/app/components/SupabaseAuth'

export default function Page() {
  return (
    <AuthWrapper>
      <SupabaseAuth mode="signup" />
    </AuthWrapper>
  )
}