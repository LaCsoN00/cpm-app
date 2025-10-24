"use client";

import { useState } from "react";
import { updateUserRole } from "../actions";
import { Role } from "@prisma/client";
import Wrapper from "../components/Wrapper";
import { toast } from "react-hot-toast";

export default function PromoteAdminPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handlePromote = async () => {
    if (!email) {
      toast.error("Veuillez entrer un email");
      return;
    }

    setLoading(true);
    try {
      const success = await updateUserRole(email, Role.ADMIN);
      if (success) {
        toast.success(`${email} promu ADMIN avec succès !`);
        setEmail("");
      } else {
        toast.error("Erreur lors de la promotion");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la promotion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Wrapper userRole={Role.USER}>
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-6">Promouvoir un utilisateur en ADMIN</h1>
        
        <div className="bg-base-100 p-6 rounded-lg shadow-lg">
          <div className="form-control">
            <label className="label">
              <span className="label-text">Email de l&apos;utilisateur</span>
            </label>
            <input
              type="email"
              placeholder="exemple@email.com"
              className="input input-bordered w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          
          <button
            className={`btn btn-primary w-full mt-4 ${loading ? 'loading' : ''}`}
            onClick={handlePromote}
            disabled={loading}
          >
            {loading ? 'Promotion en cours...' : 'Promouvoir en ADMIN'}
          </button>
        </div>

        <div className="mt-6 p-4 bg-warning/10 rounded-lg">
          <h3 className="font-semibold text-warning mb-2">⚠️ Attention :</h3>
          <ul className="text-sm space-y-1">
            <li>• Cette page est temporaire pour la configuration initiale</li>
            <li>• Entrez votre propre email pour vous promouvoir ADMIN</li>
            <li>• Une fois ADMIN, vous verrez le lien &quot;Administration&quot; dans la navbar</li>
            <li>• Supprimez cette page après configuration</li>
          </ul>
        </div>
      </div>
    </Wrapper>
  );
}
