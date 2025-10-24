import React from 'react'

type WrapperProps = {
    children : React.ReactNode
}

const AuthWrapper = ({children} : WrapperProps ) => {
  return (
    <div className='min-h-screen relative overflow-hidden bg-white'>


      {/* Main Content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen px-4 sm:px-0">
        {children}
      </div>
    </div>
  )
}

export default AuthWrapper