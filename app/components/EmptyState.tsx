import React, { FC } from 'react'
import Image from 'next/image'
interface EmptyStateProps {
    imageSrc: string;
    imageAlt: string;
    message: string;
}
const EmptyState: FC<EmptyStateProps> = ({ imageSrc, imageAlt, message }) => {
    return (
        <div className='my-40 w-full h-full flex justify-center items-center flex-col'>
            <Image
                src={imageSrc}
                alt={imageAlt}
                height={500}
                width={500}
                className='w-40 h-40'
            />
            <p className='text-sm text-gray-500 mt-2'>{message}</p>
        </div>
    )
}

export default EmptyState