import React from 'react'
import Navbar from './Navbar'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

type WrapperProps = {
    children: React.ReactNode
}

const Wrapper = ({ children }: WrapperProps) => {
    return (
        <div >
            <Navbar />
            <div className='px-5 md:px-[10%] mt-8 mb-10'>
               <ToastContainer
                 position='top-right'
                 autoClose={5000}
                 hideProgressBar={false}
                 newestOnTop={false}
                 closeOnClick
                 pauseOnHover
                 draggable
                />
                {children}
            </div>
        </div>
    )
}

export default Wrapper