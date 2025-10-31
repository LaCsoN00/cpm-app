import React, { useState } from 'react';
import { createComment } from '@/app/actions';
import { toast } from 'react-hot-toast';
import { CommentWithUserAndReactionsAndReplies } from '@/type'; // Import the type

interface CommentFormProps {
  taskId: string;
  userId: string;
  onCommentAdded: (newComment: CommentWithUserAndReactionsAndReplies) => void;
  parentId?: string | null;
  placeholderText?: string; // New prop for custom placeholder
}

const CommentForm: React.FC<CommentFormProps> = ({ taskId, userId, onCommentAdded, parentId = null, placeholderText }) => {
  const [commentContent, setCommentContent] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent.trim()) {
      toast.error('Le commentaire ne peut pas être vide.');
      return;
    }

    setLoading(true);
    try {
      const newComment = await createComment(taskId, userId, commentContent, parentId);
      setCommentContent('');
      toast.success('Commentaire ajouté avec succès!');
      onCommentAdded(newComment as CommentWithUserAndReactionsAndReplies); // Notify parent to refresh comments with the new comment
    } catch (error) {
      console.error("Erreur lors de l'ajout du commentaire:", error);
      toast.error("Erreur lors de l'ajout du commentaire.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center justify-center gap-2 mt-3">
      <textarea
        className="textarea w-3/4 rounded-full bg-gray-100 dark:bg-gray-700 text-sm border-none focus:ring-0 focus:outline-none resize-none px-4 py-2 transition-all duration-200 min-h-[2rem] text-gray-900 dark:text-white"
        placeholder={placeholderText || "Écrire un commentaire..."}
        value={commentContent}
        onChange={(e) => setCommentContent(e.target.value)}
        rows={1}
        disabled={loading}
      ></textarea>
      <button type="submit" className="btn btn-primary btn-sm rounded-full bg-blue-500 hover:bg-blue-600 border-blue-500 hover:border-blue-600 text-white dark:bg-blue-700 dark:hover:bg-blue-800 dark:border-blue-700 dark:hover:border-800" disabled={loading || !commentContent.trim()}>
        {loading ? '...' : 'Envoyer'}
      </button>
    </form>
  );
};

export default CommentForm;
