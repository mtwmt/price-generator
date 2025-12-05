import {
  Component,
  Input,
  OnInit,
  OnChanges,
  SimpleChanges,
  inject,
  signal,
  ViewChildren,
  QueryList,
  ElementRef,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '@app/core/services/auth.service';
import { CommentsStore } from './comments.store';
import { Comment } from './comments.model';
import { LucideAngularModule, Smile, Pin, PinOff, LogIn } from 'lucide-angular';

import { TimeAgoPipe } from '@app/shared/pipes/time-ago.pipe';

@Component({
  selector: 'app-comments',
  imports: [CommonModule, FormsModule, LucideAngularModule, TimeAgoPipe],
  templateUrl: './comments.component.html',
})
export class CommentsComponent implements OnInit, OnChanges, AfterViewInit {
  @Input() pagePath!: string;

  @ViewChildren('reactionDropdown', { read: ElementRef })
  dropdowns!: QueryList<ElementRef<HTMLDetailsElement>>;

  readonly store = inject(CommentsStore);
  private readonly authService = inject(AuthService);

  readonly Smile = Smile;
  readonly Pin = Pin;
  readonly PinOff = PinOff;
  readonly LogIn = LogIn;

  newCommentBody = signal('');
  replyingTo = signal<string | null>(null);
  replyBody = signal('');

  isAuthenticated = this.authService.isAuthenticated;
  userDisplayName = this.authService.userDisplayName;
  userPhotoURL = this.authService.userPhotoURL;
  isAdmin = this.authService.isAdmin;

  sortOrder = this.store.sortOrder;

  readonly availableReactions = [
    { type: 'thumbsUp', emoji: '👍' },
    { type: 'heart', emoji: '❤️' },
    { type: 'laugh', emoji: '😄' },
    { type: 'hooray', emoji: '😮' },
    { type: 'confused', emoji: '😢' },
    { type: 'thumbsDown', emoji: '👎' },
  ] as const;

  get sortedComments(): Comment[] {
    return this.store.sortedComments();
  }

  async ngOnInit() {
    this.loadComments();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['pagePath'] && !changes['pagePath'].firstChange) {
      this.loadComments();
    }
  }

  ngAfterViewInit() {
    this.dropdowns.changes.subscribe(() => {
      setTimeout(() => this.setupDropdownListeners(), 100);
    });
    setTimeout(() => this.setupDropdownListeners(), 200);
  }

  private setupDropdownListeners() {
    this.dropdowns.forEach((dropdown) => {
      const detailsEl = dropdown.nativeElement;
      detailsEl.removeEventListener('toggle', this.handleDropdownToggle);
      detailsEl.addEventListener('toggle', this.handleDropdownToggle);
    });
  }

  private handleDropdownToggle = (event: Event) => {
    const target = event.target as HTMLDetailsElement;
    if (target.open) {
      this.closeOtherDropdowns(target);
    }
  };

  private closeOtherDropdowns(currentDropdown: HTMLDetailsElement) {
    this.dropdowns.forEach((dropdown) => {
      const detailsEl = dropdown.nativeElement;
      if (detailsEl !== currentDropdown && detailsEl.open) {
        detailsEl.open = false;
      }
    });
  }

  loadComments() {
    this.store.loadComments(this.pagePath);
  }

  postComment() {
    const body = this.newCommentBody().trim();
    if (!body) return;

    this.store.addComment({
      body,
      discussionId: this.pagePath,
    });
    this.newCommentBody.set('');
  }

  postReply(parentId: string) {
    const body = this.replyBody().trim();
    if (!body) return;

    this.store.addComment({
      body,
      discussionId: this.pagePath,
      replyToId: parentId,
    });
    this.replyBody.set('');
    this.replyingTo.set(null);
  }

  deleteComment(commentId: string) {
    if (!confirm('確定要刪除這則留言嗎?')) return;

    this.store.deleteComment(commentId);
  }

  togglePin(commentId: string) {
    if (!this.isAdmin()) return;
    this.store.togglePin(commentId);
  }

  loginWithGoogle() {
    this.authService.loginWithGoogle();
  }

  selectReaction(commentId: string, reactionType: string) {
    this.toggleReaction(commentId, reactionType);
    this.dropdowns.forEach((dropdown) => {
      dropdown.nativeElement.open = false;
    });
  }

  getActiveReactions(comment: Comment) {
    return this.availableReactions.filter((reaction) => {
      const count = this.getReactionCount(comment, reaction.type);
      return count > 0;
    });
  }

  getReactionCount(comment: Comment, reactionType: string): number {
    const key =
      `reactions${reactionType.charAt(0).toUpperCase() + reactionType.slice(1)}` as keyof Comment;
    const reactionArray = comment[key] as string[];
    return reactionArray?.length || 0;
  }

  hasUserReacted(comment: Comment, reactionType: string): boolean {
    const user = this.authService.currentUser();
    if (!user) return false;

    const key =
      `reactions${reactionType.charAt(0).toUpperCase() + reactionType.slice(1)}` as keyof Comment;
    const reactionArray = comment[key] as string[];
    return reactionArray?.includes(user.uid) || false;
  }

  toggleReaction(commentId: string, reactionType: string) {
    const user = this.authService.currentUser();
    if (!user) return;

    const comment = this.findCommentById(this.store.comments(), commentId);
    if (!comment) return;

    const isRemoving = this.hasUserReacted(comment, reactionType);
    this.store.toggleReaction(commentId, reactionType, isRemoving);
  }

  private findCommentById(
    comments: Comment[],
    commentId: string
  ): Comment | null {
    for (const comment of comments) {
      if (comment.id === commentId) return comment;
      if (comment.replies) {
        const found = this.findCommentById(comment.replies, commentId);
        if (found) return found;
      }
    }
    return null;
  }

  startReply(commentId: string) {
    this.replyingTo.set(commentId);
    this.replyBody.set('');
  }

  cancelReply() {
    this.replyingTo.set(null);
    this.replyBody.set('');
  }

  isCommentAuthor(comment: Comment): boolean {
    const user = this.authService.currentUser();
    return user !== null && user.uid === comment.authorUserId;
  }
}
