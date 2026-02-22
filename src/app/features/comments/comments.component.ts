import {
  Component,
  Input,
  OnInit,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  inject,
  signal,
  computed,
  ViewChildren,
  QueryList,
  ElementRef,
  AfterViewInit,
  DestroyRef,
  effect,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '@app/core/services/auth.service';
import { ConfirmDialogService } from '@app/shared/services/confirm-dialog.service';
import { CommentsStore } from './comments.store';
import { Comment } from './comments.model';
import { LucideAngularModule, Smile, Pin, PinOff } from 'lucide-angular';

import { TimeAgoPipe } from '@app/shared/pipes/time-ago.pipe';
import { SafeHtmlPipe } from '@app/shared/pipes/safe-html.pipe';
import { PaginationComponent } from '@app/shared/components/pagination/pagination.component';

@Component({
  selector: 'app-comments',
  imports: [CommonModule, FormsModule, LucideAngularModule, TimeAgoPipe, SafeHtmlPipe, PaginationComponent],
  templateUrl: './comments.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommentsComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @Input() pagePath!: string;

  @ViewChildren('reactionDropdown', { read: ElementRef })
  dropdowns!: QueryList<ElementRef<HTMLDetailsElement>>;

  readonly store = inject(CommentsStore);
  private readonly authService = inject(AuthService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly destroyRef = inject(DestroyRef);

  readonly Smile = Smile;
  readonly Pin = Pin;
  readonly PinOff = PinOff;

  /** 定期遞增以觸發 TimeAgoPipe 重新計算 */
  refreshTick = signal(0);
  private refreshInterval?: ReturnType<typeof setInterval>;

  newCommentBody = signal('');
  replyingTo = signal<string | null>(null);
  replyBody = signal('');

  // 分頁相關
  currentPage = signal(1);
  readonly pageSize = 10;

  loginWithGoogle = () => this.authService.loginWithGoogle();
  isAuthenticated = this.authService.isAuthenticated;
  userDisplayName = this.authService.userDisplayName;
  userPhotoURL = this.authService.userPhotoURL;
  isAdmin = this.authService.isAdmin;

  sortOrder = this.store.sortOrder;

  // 排序變更時自動重置分頁至第 1 頁
  private sortResetEffect = effect(() => {
    this.store.sortOrder();
    this.currentPage.set(1);
  });

  // 計算總頁數
  totalPages = computed(() => {
    const total = this.store.sortedComments().length;
    return Math.ceil(total / this.pageSize) || 1;
  });

  // 計算當前頁的留言
  paginatedComments = computed(() => {
    const all = this.store.sortedComments();
    const start = (this.currentPage() - 1) * this.pageSize;
    const end = start + this.pageSize;
    return all.slice(start, end);
  });

  // 計算總留言數（供 pagination 使用）
  totalComments = computed(() => this.store.sortedComments().length);

  readonly availableReactions = [
    { type: 'thumbsUp', emoji: '👍' },
    { type: 'heart', emoji: '❤️' },
    { type: 'laugh', emoji: '😄' },
    { type: 'hooray', emoji: '😮' },
    { type: 'confused', emoji: '😢' },
    { type: 'thumbsDown', emoji: '👎' },
  ] as const;

  get sortedComments(): Comment[] {
    return this.paginatedComments();
  }

  // 分頁方法
  onPageChange(page: number) {
    this.currentPage.set(page);
  }

  async ngOnInit() {
    this.loadComments();
    // 每 60 秒遞增 refreshTick，觸發 TimeAgoPipe 重新計算
    this.refreshInterval = setInterval(() => {
      this.refreshTick.update((v) => v + 1);
    }, 60_000);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['pagePath'] && !changes['pagePath'].firstChange) {
      this.loadComments();
    }
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  ngAfterViewInit() {
    this.dropdowns.changes
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
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

  async deleteComment(commentId: string): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: '刪除留言',
      message: '確定要刪除這則留言嗎？',
      confirmText: '刪除',
      confirmStyle: 'error',
    });
    if (!confirmed) return;

    this.store.deleteComment(commentId);
  }

  togglePin(commentId: string) {
    if (!this.isAdmin()) return;
    this.store.togglePin(commentId);
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
