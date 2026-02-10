import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, firstValueFrom, pipe, switchMap, tap } from 'rxjs';
import { tapResponse } from '@ngrx/operators';
import { Comment, CommentsState } from './comments.model';
import { CommentsService } from './comments.service';
import { AuthService } from '@app/core/services/auth.service';

const initialState: CommentsState = {
  comments: [],
  loading: false,
  error: null,
  currentPagePath: null,
  sortOrder: 'newest',
};

export const CommentsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ comments, sortOrder }) => ({
    commentsCount: computed(() => comments().length),
    hasComments: computed(() => comments().length > 0),
    sortedComments: computed(() => {
      const order = sortOrder();
      const currentComments = comments();

      const sorted = [...currentComments].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;

        if (order === 'newest') {
          return b.createdAt - a.createdAt;
        } else {
          return a.createdAt - b.createdAt;
        }
      });

      sorted.forEach((comment) => {
        if (comment.replies && comment.replies.length > 0) {
          comment.replies = [...comment.replies].sort(
            (a, b) => a.createdAt - b.createdAt
          );
        }
      });

      return sorted;
    }),
  })),

  withMethods(
    (
      store,
      commentsService = inject(CommentsService),
      authService = inject(AuthService)
    ) => ({
      loadComments: rxMethod<string>(
        pipe(
          tap((pagePath) =>
            patchState(store, {
              loading: true,
              error: null,
              currentPagePath: pagePath,
            })
          ),
          switchMap((pagePath) =>
            commentsService.fetchComments(pagePath).pipe(
              tapResponse({
                next: (comments) =>
                  patchState(store, { comments, loading: false }),
                error: (error: Error) =>
                  patchState(store, {
                    error: error.message || '載入留言失敗',
                    loading: false,
                  }),
              })
            )
          )
        )
      ),

      addComment: rxMethod<{
        body: string;
        discussionId: string;
        replyToId?: string;
      }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ body, discussionId, replyToId }) =>
            commentsService.createComment(body, discussionId, replyToId).pipe(
              switchMap(() => {
                const currentPath = store.currentPagePath();
                if (currentPath) {
                  return commentsService.fetchComments(currentPath);
                }
                return EMPTY;
              }),
              tapResponse({
                next: (comments) =>
                  patchState(store, { comments, loading: false }),
                error: (error: Error) =>
                  patchState(store, {
                    error: error.message || '發布留言失敗',
                    loading: false,
                  }),
              })
            )
          )
        )
      ),

      deleteComment: rxMethod<string>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap((commentId) =>
            commentsService.deleteComment(commentId).pipe(
              switchMap(() => {
                const currentPath = store.currentPagePath();
                if (currentPath) {
                  return commentsService.fetchComments(currentPath);
                }
                return EMPTY;
              }),
              tapResponse({
                next: (comments) =>
                  patchState(store, { comments, loading: false }),
                error: (error: Error) =>
                  patchState(store, {
                    error: error.message || '刪除留言失敗',
                    loading: false,
                  }),
              })
            )
          )
        )
      ),

      toggleReaction(
        commentId: string,
        reactionType: string,
        isRemoving: boolean
      ) {
        const user = authService.currentUser();
        if (!user) return;

        const currentComments = store.comments();
        const optimisticComments = updateReactionInComments(
          currentComments,
          commentId,
          reactionType,
          isRemoving ? -1 : 1,
          user.uid
        );
        patchState(store, { comments: optimisticComments });

        const request$ = isRemoving
          ? commentsService.removeReaction(commentId, reactionType)
          : commentsService.createReaction(commentId, reactionType);

        firstValueFrom(request$).catch((error) => {
          patchState(store, { comments: currentComments });
          console.error('Failed to toggle reaction:', error);
        });
      },

      togglePin(commentId: string) {
        const currentComments = store.comments();
        const optimisticComments = togglePinInComments(
          currentComments,
          commentId
        );
        patchState(store, { comments: optimisticComments });

        firstValueFrom(commentsService.togglePin(commentId)).catch((error) => {
          patchState(store, { comments: currentComments });
          console.error('Failed to toggle pin:', error);
        });
      },

      setSortOrder(sortOrder: 'newest' | 'oldest') {
        patchState(store, { sortOrder });
      },
    })
  )
);

function updateReactionInComments(
  comments: Comment[],
  commentId: string,
  reactionType: string,
  delta: number,
  userId?: string
): Comment[] {
  return comments.map((comment) => {
    if (comment.id === commentId) {
      const reactionKey =
        `reactions${reactionType.charAt(0).toUpperCase() + reactionType.slice(1)}` as keyof Comment;
      const currentArray = (comment[reactionKey] as string[]) || [];

      let newArray: string[];
      if (delta > 0 && userId) {
        newArray = currentArray.includes(userId)
          ? currentArray
          : [...currentArray, userId];
      } else if (delta < 0 && userId) {
        newArray = currentArray.filter((id) => id !== userId);
      } else {
        newArray = currentArray;
      }

      return {
        ...comment,
        [reactionKey]: newArray,
        reactionsTotal: Math.max(0, comment.reactionsTotal + delta),
      };
    }
    if (comment.replies && comment.replies.length > 0) {
      return {
        ...comment,
        replies: updateReactionInComments(
          comment.replies,
          commentId,
          reactionType,
          delta,
          userId
        ),
      };
    }
    return comment;
  });
}

function togglePinInComments(
  comments: Comment[],
  commentId: string
): Comment[] {
  return comments.map((comment) => {
    if (comment.id === commentId) {
      return {
        ...comment,
        isPinned: !comment.isPinned,
      };
    }
    if (comment.replies && comment.replies.length > 0) {
      return {
        ...comment,
        replies: togglePinInComments(comment.replies, commentId),
      };
    }
    return comment;
  });
}
