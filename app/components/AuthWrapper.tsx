import React from 'react'
type WrapperProps = {
    children : React.ReactNode
}

const AuthWrapper = ({children} : WrapperProps ) => {
  return (
    <div className='h-screen flex justify-center items-center flex-col '>
        <div className='flex items-center mb-6'>

            <span className='ml-3 font-bold text-3xl'>
                CPM <span className='text-primary'>APP</span>
            </span>

        </div>

        <div>
            {children}
        </div>
    </div>
  )
}

export default AuthWrapper