import React, { FC } from 'react'
import Navbar from './Navbar'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { Role } from "@prisma/client";

interface WrapperProps {
    children: React.ReactNode;
    userRole: Role | "GUEST";
}

const Wrapper: FC<WrapperProps> = ({ children, userRole }) => {
    return (
        <div >
            <Navbar userRole={userRole} />
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