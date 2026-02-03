import Image from 'next/image'; // Import Image component
import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Role, ReactionType } from '@/type'; // Import Role enum and ReactionType
import { toast } from 'react-hot-toast';
import { deleteComment, updateComment, toggleCommentReaction } from '@/app/actions';
import CommentForm from './CommentForm'; // For replies
import { CommentWithUserAndReactionsAndReplies } from '@/type'; // Import from global types

interface CommentProps extends React.HTMLAttributes<HTMLDivElement> {
  comment: CommentWithUserAndReactionsAndReplies;
  currentUserId: string | undefined; // ID of the currently logged-in user
  userRole: Role | undefined | null;
  onCommentModified: (updatedComment: CommentWithUserAndReactionsAndReplies) => void;
  onCommentDeleted: (commentId: string) => void;
  onCommentAdded: (newComment: CommentWithUserAndReactionsAndReplies) => void; // For replies
}

// eslint-disable-next-line
const emojiOptions = ['👍', '❤️', '😂', '😢', '😡']; // Example emojis

const CommentComponent: React.FC<CommentProps> = ({ comment, currentUserId, userRole, onCommentModified, onCommentDeleted, onCommentAdded }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(comment.content);
  const [commentState, setCommentState] = useState(comment); // Local state for comment
  const [isReplying, setIsReplying] = useState(false);
  const [showReplies, setShowReplies] = useState(true); // Control visibility of replies

  useEffect(() => {
    setCommentState(comment); // Update local state when comment prop changes
  }, [comment]);

  const isAuthor = currentUserId === commentState.userId;
  const canEditOrDelete = isAuthor || userRole === Role.ADMIN;

  const handleEdit = async () => {
    if (editedContent === commentState.content) {
      setIsEditing(false);
      return;
    }
    try {
      await updateComment(commentState.id, editedContent);
      toast.success('Commentaire modifié!');
      const updatedComment = { ...commentState, content: editedContent, updatedAt: new Date() };
      onCommentModified(updatedComment);
      setIsEditing(false);
    } catch (error) {
      console.error('Erreur lors de la modification du commentaire:', error);
      toast.error('Erreur lors de la modification du commentaire.');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce commentaire et toutes ses réponses ?')) {
      return;
    }
    try {
      await deleteComment(commentState.id);
      toast.success('Commentaire supprimé!');
      onCommentDeleted(commentState.id);
    } catch (error) {
      console.error('Erreur lors de la suppression du commentaire:', error);
      toast.error('Erreur lors de la suppression du commentaire.');
    }
  };

  const handleReaction = async (reactionType: ReactionType) => {
    if (!currentUserId) {
      toast.error("Veuillez vous connecter pour ajouter une réaction.");
      return;
    }
    try {
      const updatedCommentResponse = await toggleCommentReaction(commentState.id, currentUserId, reactionType);
      if (updatedCommentResponse.success) {
        // Mettre à jour l'état local en fonction du type de réaction
        setCommentState(prev => {
          const newReactions = prev.reactions ? [...prev.reactions] : [];
          const existingReactionIndex = newReactions.findIndex(r => r.userId === currentUserId && r.type === reactionType);

          if (existingReactionIndex > -1) {
            newReactions.splice(existingReactionIndex, 1); // Retirer la réaction
          } else {
            // Trouver l'utilisateur actuel à partir de commentState si disponible
            const currentUser = commentState.user && commentState.user.id === currentUserId ? commentState.user : null;
            if (currentUser) {
              newReactions.push({ userId: currentUserId, type: reactionType, commentId: prev.id, id: Date.now().toString(), createdAt: new Date(), user: currentUser });
            } else {
              // Fallback: Créer un objet utilisateur minimal si l'utilisateur actuel n'est pas l'auteur du commentaire
              newReactions.push({ userId: currentUserId, type: reactionType, commentId: prev.id, id: Date.now().toString(), createdAt: new Date(), user: { id: currentUserId, name: "", email: "", role: Role.USER, approved: true, restricted: false, imageUrl: null } }); // TODO: Fetch full user info if needed
            }
          }
          return { ...prev, reactions: newReactions };
        });
      }
    } catch (error) {
      console.error('Erreur lors de l\'ajout de la réaction:', error);
      toast.error('Erreur lors de l\'ajout de la réaction.');
    }
  };

  const groupedReactions = (commentState.reactions || []).reduce((acc, reaction) => {
    acc[reaction.type] = (acc[reaction.type] || 0) + 1;
    return acc;
  }, {} as Record<ReactionType, number>);

  const userUpvoted = (commentState.reactions || []).some(r => r.type === ReactionType.UPVOTE && r.userId === currentUserId);
  const userDownvoted = (commentState.reactions || []).some(r => r.type === ReactionType.DOWNVOTE && r.userId === currentUserId);

  return (
    <div className="flex gap-2 mb-3 last:mb-0">
      <div className="avatar">
        <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
          {commentState.user ? (
            commentState.user.imageUrl ? (
              <Image src={commentState.user.imageUrl} alt={commentState.user.name || "User"} className="w-full h-full object-cover" width={32} height={32} />
            ) : (
              <span className="text-sm font-semibold text-gray-600">{(commentState.user.name || commentState.user.email)?.charAt(0).toUpperCase()}</span>
            )
          ) : (
            <span className="text-sm font-semibold text-gray-600">?</span>
          )}
        </div>
      </div>
      <div className="flex flex-col flex-grow">
        <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded-xl">
          <div className="flex flex-col md:flex-row md:items-baseline md:justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-baseline gap-1 md:order-2 md:ml-auto">
              {format(new Date(commentState.createdAt), 'dd/MM/yyyy HH:mm', { locale: fr })}
              {commentState.createdAt.getTime() !== commentState.updatedAt.getTime() && (
                <span className="italic">(modifié)</span>
              )}
            </span>
            <span className="font-bold text-gray-900 dark:text-white text-sm md:order-1">
              {commentState.user ? (commentState.user.name || commentState.user.email) : 'Utilisateur inconnu'}
            </span>
          </div>
          {isEditing ? (
            <textarea
              className="textarea textarea-bordered w-full text-sm mt-1 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              rows={3}
            />
          ) : (
            <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-normal">{commentState.content}</p>
          )}
        </div>
        <div className="flex items-center mt-1 gap-2 text-xs text-gray-600 pl-2 flex-wrap w-full md:flex-nowrap">
          {isAuthor && !isEditing && (
            <>
              <button className="btn btn-link btn-xs text-gray-600 hover:text-blue-500 p-0 h-auto min-h-0" onClick={() => setIsEditing(true)}>Modifier</button>
              <span className="text-gray-400">•</span>
            </>
          )}
          {canEditOrDelete && !isEditing && (
            <>
              <button className="btn btn-link btn-xs text-error hover:text-red-500 p-0 h-auto min-h-0" onClick={handleDelete}>Supprimer</button>
              <span className="text-gray-400">•</span>
            </>
          )}
          {isEditing && (
            <button className="btn btn-primary btn-xs p-0 h-auto min-h-0" onClick={handleEdit}>Enregistrer</button>
          )}
          <button className="btn btn-link btn-xs text-gray-600 hover:text-blue-500 p-0 h-auto min-h-0" onClick={() => setIsReplying(!isReplying)}>Répondre</button>
          <div className="flex items-center ml-auto gap-1">
            {/* Upvote Button */}
            <button
              className={`btn btn-ghost btn-sm rounded-full flex items-center gap-1 text-gray-600 ${userUpvoted ? 'text-green-500' : ''}`}
              onClick={() => handleReaction(ReactionType.UPVOTE)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.626 10.612a1 1 0 01.828.122l3.038 2.301a1 1 0 001.267 0l3.038-2.302a1 1 0 01.828-.122A2 2 0 0119.5 12.088V22.5H4.5v-10.413a2 2 0 012.126-1.975z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a.75.75 0 00-.75.75V15a.75.75 0 001.5 0V6.75a.75.75 0 00-.75-.75z" />
              </svg>
              {groupedReactions[ReactionType.UPVOTE] || 0}
            </button>

            {/* Downvote Button */}
            <button
              className={`btn btn-ghost btn-sm rounded-full flex items-center gap-1 text-gray-600 ${userDownvoted ? 'text-red-500' : ''}`}
              onClick={() => handleReaction(ReactionType.DOWNVOTE)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.373 13.388a1 1 0 01-.828-.122l-3.038-2.301a1 1 0 00-1.267 0l-3.038 2.302a1 1 0 01-.828.122A2 2 0 014.5 11.912V1.5h15v10.413a2 2 0 01-2.126 1.975z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 18a.75.75 0 00.75-.75V9a.75.75 0 00-1.5 0v8.25a.75.75 0 00.75.75z" />
              </svg>
              {groupedReactions[ReactionType.DOWNVOTE] || 0}
            </button>
          </div>
        </div>

        {isReplying && currentUserId && (
          <div className="mt-2 pl-2">
            <CommentForm
              taskId={commentState.taskId}
              userId={currentUserId}
              parentId={commentState.id}
              onCommentAdded={(newComment) => { onCommentAdded(newComment); setIsReplying(false); }}
              placeholderText={`Répondre à ${commentState.user ? (commentState.user.name || commentState.user.email) : 'quelqu\'un'}...`}
            />
          </div>
        )}

        {commentState.replies?.length > 0 && (
          <div className="mt-2 pl-4 border-l-2 border-base-300">
            <button className="btn btn-link btn-xs text-blue-500 mb-1 p-0 h-auto min-h-0" onClick={() => setShowReplies(!showReplies)}>
              {showReplies ? 'Masquer les réponses' : `Afficher ${commentState.replies.length} réponse(s)`}
            </button>
            {showReplies && (
              <div className="flex flex-col gap-2 pt-2">
                {commentState.replies.map(reply => (
                  <CommentComponent
                    key={reply.id}
                    comment={reply}
                    currentUserId={currentUserId}
                    userRole={userRole}
                    onCommentModified={onCommentModified}
                    onCommentDeleted={onCommentDeleted}
                    onCommentAdded={onCommentAdded}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CommentComponent;
