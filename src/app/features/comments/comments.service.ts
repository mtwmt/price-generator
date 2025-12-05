import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';
import { AuthService } from '@app/core/services/auth.service';
import { Comment, CommentResponse, ReactionResponse } from './comments.model';

@Injectable({
  providedIn: 'root',
})
export class CommentsService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly webAppUrl = environment.googleSheets.commentsWebAppUrl;

  fetchComments(pagePath: string): Observable<Comment[]> {
    const params = new URLSearchParams({
      action: 'getComments',
      pagePath: pagePath,
    });

    console.log(
      'Fetching comments from:',
      `${this.webAppUrl}?${params.toString()}`
    );

    return this.http
      .get<CommentResponse>(`${this.webAppUrl}?${params.toString()}`)
      .pipe(
        map((response) => {
          console.log('Comments API response:', response);

          if (response.success && response.data) {
            return this.organizeComments(response.data);
          }

          if (response.success) {
            return [];
          }

          throw new Error(response.message || 'Failed to fetch comments');
        })
      );
  }

  createComment(
    body: string,
    discussionId: string,
    replyToId?: string
  ): Observable<Comment> {
    const user = this.authService.currentUser();
    if (!user) {
      return throwError(() => new Error('User not authenticated'));
    }

    const params = new URLSearchParams({
      action: 'addComment',
      discussionId: discussionId,
      authorUserId: user.uid,
      authorLogin: user.displayName || 'Anonymous',
      authorEmail: user.email || '',
      authorAvatarUrl: user.photoURL || '',
      body: body,
      replyToId: replyToId || '',
    });

    return this.http
      .get<CommentResponse>(`${this.webAppUrl}?${params.toString()}`)
      .pipe(
        map((response) => {
          if (response.success && response.data) {
            return response.data as Comment;
          }
          throw new Error(response.message);
        })
      );
  }

  deleteComment(commentId: string): Observable<void> {
    const user = this.authService.currentUser();
    if (!user) {
      return throwError(() => new Error('User not authenticated'));
    }

    const params = new URLSearchParams({
      action: 'deleteComment',
      commentId: commentId,
      userId: user.uid,
    });

    return this.http
      .get<CommentResponse>(`${this.webAppUrl}?${params.toString()}`)
      .pipe(
        map((response) => {
          if (!response.success) {
            throw new Error(response.message);
          }
        })
      );
  }

  createReaction(
    commentId: string,
    reactionType: string
  ): Observable<ReactionResponse> {
    const user = this.authService.currentUser();
    if (!user) {
      return throwError(() => new Error('User not authenticated'));
    }

    const params = new URLSearchParams({
      action: 'addReaction',
      commentId: commentId,
      reactionType: reactionType,
      userId: user.uid,
    });

    return this.http
      .get<CommentResponse>(`${this.webAppUrl}?${params.toString()}`)
      .pipe(
        map((response) => {
          if (response.success && response.data) {
            return {
              count: response.data.count,
              total: response.data.total,
            };
          }
          throw new Error(response.message);
        })
      );
  }

  removeReaction(
    commentId: string,
    reactionType: string
  ): Observable<ReactionResponse> {
    const user = this.authService.currentUser();
    if (!user) {
      return throwError(() => new Error('User not authenticated'));
    }

    const params = new URLSearchParams({
      action: 'removeReaction',
      commentId: commentId,
      reactionType: reactionType,
      userId: user.uid,
    });

    return this.http
      .get<CommentResponse>(`${this.webAppUrl}?${params.toString()}`)
      .pipe(
        map((response) => {
          if (response.success && response.data) {
            return {
              count: response.data.count,
              total: response.data.total,
            };
          }
          throw new Error(response.message);
        })
      );
  }

  togglePin(commentId: string): Observable<{ isPinned: boolean }> {
    const user = this.authService.currentUser();
    if (!user) {
      return throwError(() => new Error('User not authenticated'));
    }

    const params = new URLSearchParams({
      action: 'togglePin',
      commentId: commentId,
      userId: user.uid,
    });

    return this.http
      .get<CommentResponse>(`${this.webAppUrl}?${params.toString()}`)
      .pipe(
        map((response) => {
          if (response.success && response.data) {
            return {
              isPinned: response.data.isPinned,
            };
          }
          throw new Error(response.message);
        })
      );
  }

  private organizeComments(comments: Comment[]): Comment[] {
    const commentMap = new Map<string, Comment>();
    const rootComments: Comment[] = [];

    comments.forEach((comment) => {
      comment.replies = [];
      comment.reactionsThumbsUp = this.parseReactionField(
        comment.reactionsThumbsUp
      );
      comment.reactionsLaugh = this.parseReactionField(comment.reactionsLaugh);
      comment.reactionsHeart = this.parseReactionField(comment.reactionsHeart);
      comment.reactionsHooray = this.parseReactionField(
        comment.reactionsHooray
      );
      comment.reactionsConfused = this.parseReactionField(
        comment.reactionsConfused
      );
      comment.reactionsThumbsDown = this.parseReactionField(
        comment.reactionsThumbsDown
      );
      commentMap.set(comment.id, comment);
    });

    comments.forEach((comment) => {
      if (comment.replyToId) {
        const parent = commentMap.get(comment.replyToId);
        if (parent) {
          parent.replies!.push(comment);
        }
      } else {
        rootComments.push(comment);
      }
    });

    return rootComments;
  }

  private parseReactionField(field: any): string[] {
    if (Array.isArray(field)) {
      return field;
    }
    if (typeof field === 'string' && field.trim()) {
      return field
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id);
    }
    return [];
  }
}
