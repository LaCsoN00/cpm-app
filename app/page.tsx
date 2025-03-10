"use client"

import Wrapper from "./components/Wrapper";
import { useEffect, useState } from "react";
import { FolderGit2 } from "lucide-react";
import { createProject, deleteProjectById, getProjectsCreatedByUser } from "./actions";
import { useUser } from "@clerk/nextjs";
import { toast } from "react-hot-toast";
import { Project } from "@/type";
import ProjectComponent from "./components/ProjectComponent";
import EmptyState from "./components/EmptyState";

export default function Home() {

  const { user } = useUser()
  const email = user?.primaryEmailAddress?.emailAddress as string
  const [name, setName] = useState("")
  const [descrition, setDescription] = useState("")
  const [projects, setProjects] = useState<Project[]>([])

  const fetchProjects = async (email: string) => {
    try {
      const myproject = await getProjectsCreatedByUser(email)
      setProjects(myproject)
      console.log(myproject)
    } catch (error) {
      console.error('Erreur lors du chargement des projets:', error);
    }
  }

  useEffect(() => {
    if (email) {
      fetchProjects(email)
    }
  }, [email])

  const deleteProject = async (projectId: string) => {
    try {
      await deleteProjectById(projectId)
      fetchProjects(email)
      toast.success('Project supprimé !')
    } catch (error) {
      throw new Error('Error deleting project: ' + error);
    }
  }

  const handleSubmit = async () => {
    try {
      const modal = document.getElementById('my_modal_3') as HTMLDialogElement
      await createProject(name, descrition, email)
      if (modal) {
        modal.close()
      }
      setName("");
      setDescription("");
      fetchProjects(email)
      toast.success("Projet Créé")
    } catch (error) {
      console.error('Error creating project:', error);
    }
  }

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: '/' })
        .then(() => console.log("Service Worker enregistré avec succès."))
        .catch((err) => console.error("Erreur d'enregistrement du Service Worker:", err));
    }
  }, []);

  const isButtonDisabled = !name || !descrition;

  return (
    <Wrapper>
      <div>
        {/* You can open the modal using document.getElementById('ID').showModal() method */}
        <button className="btn  btn-primary mb-6" onClick={() => (document.getElementById('my_modal_3') as HTMLDialogElement).showModal()}>  Nouveau Projet <FolderGit2 /></button>

        <dialog id="my_modal_3" className="modal">
          <div className="modal-box">
            <form method="dialog">
              {/* if there is a button in form, it will close the modal */}
              <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button><br />
            </form>
            <h3 className="font-bold text-lg">Nom du client</h3><br />
            <div>
              <input
                placeholder="Nom du client"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border border-base-300 input  input-bordered w-full mb-4 placeholder:text-sm"
                required
              />
              <textarea
                placeholder="Informations relatives au client"
                value={descrition}
                onChange={(e) => setDescription(e.target.value)}
                className="mb-2 textarea textarea-bordered border border-base-300 w-full  textarea-md placeholder::text-sm"
                required
              >
              </textarea>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={isButtonDisabled}>
                Nouveau Projet <FolderGit2 />
              </button>
            </div>
          </div>
        </dialog>

        <div className="w-full">

          {projects.length > 0 ? (
            <ul className="w-full grid md:grid-cols-3 gap-6">
              {projects.map((project) => (
                <li key={project.id}>
                  <ProjectComponent project={project} admin={1} style={true} onDelete={deleteProject}></ProjectComponent>
                </li>
              ))}
            </ul>
          ) : (
            <div>
              <EmptyState
                 imageSrc='/empty-project.png'
                 imageAlt="Picture of an empty project"
                 message="Aucun projet Créer"
              />
            </div>
          )}

        </div>

      </div>
    </Wrapper>
  );
}
