"use client"
import React, { useEffect, useState } from 'react'
import Wrapper from '../components/Wrapper'
import { SquarePlus } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { addUserToProject, getProjectsAssociatedWithUser } from '../actions'
import { useUser } from '@clerk/nextjs'
import { Project } from '@/type'
import ProjectComponent from '../components/ProjectComponent'
import EmptyState from '../components/EmptyState'

const Page = () => {
    const { user } = useUser()
    const email = user?.primaryEmailAddress?.emailAddress || ""
    const [inviteCode, setInviteCode] = useState("")
    const [associatedProjects, setAssociatedProjects] = useState<Project[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const fetchProjects = async (userEmail: string) => {
        try {
            setIsLoading(true)
            const associated = await getProjectsAssociatedWithUser(userEmail)
            setAssociatedProjects(associated)
        } catch (error) {
            console.error(error)
            toast.error("Erreur lors du chargement des projets")
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        if (email) {
            fetchProjects(email)
        }
    }, [email])

    const handleSubmit = async () => {
        if (!email) {
            toast.error("Utilisateur non identifié")
            return
        }

        try {
            if (inviteCode.trim() !== "") {
                await addUserToProject(email, inviteCode)
                fetchProjects(email)
                setInviteCode("")
                toast.success('Vous pouvez maintenant collaborer sur ce projet')
            } else {
                toast.error('Il manque le code du projet')
            }
        } catch (error) {
            console.error(error)
            toast.error("Code invalide ou vous appartenez déjà au projet")
        }
    }

    return (
        <Wrapper>
            <div className='flex'>
                <div className='mb-4'>
                    <input
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value)}
                        type="text"
                        placeholder="Code d'invitation"
                        className='w-full p-2 input input-bordered'
                    />
                </div>
                <button className='btn btn-primary ml-4' onClick={handleSubmit}>
                    Rejoindre <SquarePlus className='w-4' />
                </button>
            </div>

            <div>
                {isLoading ? (
                    <p>Chargement des projets...</p>
                ) : associatedProjects.length > 0 ? (
                    <ul className="w-full grid md:grid-cols-3 gap-6">
                        {associatedProjects.map((project) => (
                            <li key={project.id}>
                                <ProjectComponent project={project} admin={0} style={true} />
                            </li>
                        ))}
                    </ul>
                ) : (
                    <EmptyState
                        imageSrc='/empty-project.png'
                        imageAlt="Picture of an empty project"
                        message="Aucun projet associé"
                    />
                )}
            </div>
        </Wrapper>
    )
}

export default Page
