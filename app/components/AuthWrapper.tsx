import React from 'react'

type WrapperProps = {
    children : React.ReactNode
}

const AuthWrapper = ({children} : WrapperProps ) => {

  return (
    <div className='h-screen flex justify-center items-center flex-col relative'>
        {children}
    </div>
  )
}

export default AuthWrapper