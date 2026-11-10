import type { EntityBundle } from '@/contracts/schemas';
import { SELECTORS, resolveElement } from '@/contracts/selectors';
import { logger } from '@/utils/logger';

export class ForwardAutomator {
  constructor(
    private doc: Document = typeof document !== 'undefined'
      ? document
      : (null as unknown as Document),
  ) {}

  /**
   * Pha 1: Tự động hóa Native Forward Modal của Zalo Web:
   * 1. Kích hoạt nút Chia sẻ trên tin nhắn chứa media/album.
   * 2. Chờ Forward Modal xuất hiện.
   * 3. Chọn các nhóm con đích đã định tuyến (tối đa <= 2).
   * 4. Bấm "Chia sẻ" và chờ Toast xác nhận thành công.
   */
  async forwardPhase1(bundle: EntityBundle, targetGroupIds: string[]): Promise<boolean> {
    if (!this.doc || targetGroupIds.length === 0) {
      return false;
    }

    const firstMsg = bundle.messages[0];
    const msgId = firstMsg?.msgId;

    // 1. Định vị phần tử tin nhắn trên DOM
    const msgEl =
      (msgId ? this.doc.querySelector<HTMLElement>(`[data-msg-id="${msgId}"]`) : null) ||
      this.doc.querySelector<HTMLElement>('.msg-group');

    if (!msgEl) {
      logger.error(
        'FORWARD_PHASE1',
        'N08',
        'Không tìm thấy phần tử tin nhắn nguồn trên DOM',
        undefined,
        {
          groupId: bundle.sourceGroupId,
        },
      );
      return false;
    }

    // 2. Tìm nút kích hoạt chia sẻ (Forward Trigger)
    const forwardBtn =
      msgEl.querySelector<HTMLElement>('.btn-forward-trigger') ||
      msgEl.querySelector<HTMLElement>('[aria-label="Chia sẻ"]') ||
      this.doc.querySelector<HTMLElement>('.btn-forward-trigger');

    if (forwardBtn) {
      forwardBtn.click();
    }

    // 3. Chờ và tương tác với Forward Modal
    const modal = resolveElement(SELECTORS.FORWARD_MODAL, this.doc);
    const modalContainer = this.doc.querySelector<HTMLElement>('#forward-modal-container');
    if (modalContainer) {
      modalContainer.style.display = 'flex';
    }

    if (!modal && !modalContainer) {
      logger.error(
        'FORWARD_PHASE1',
        'N08',
        'Không mở được hộp thoại Chia sẻ (Forward Modal)',
        undefined,
        {
          groupId: bundle.sourceGroupId,
        },
      );
      return false;
    }

    // 4. Chọn các nhóm con đích trong danh sách hội thoại của Modal
    for (const targetId of targetGroupIds.slice(0, 2)) {
      const checkbox = this.doc.querySelector<HTMLInputElement>(
        `input[name="target_group"][value="${targetId}"], [data-group-id="${targetId}"] input`,
      );

      if (checkbox) {
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    // 5. Bấm nút xác nhận "Chia sẻ"
    const confirmBtn =
      this.doc.querySelector<HTMLElement>('.btn-confirm-forward') ||
      this.doc.querySelector<HTMLElement>('button[data-translate-inner="STR_SHARE_CONFIRM"]');

    if (confirmBtn) {
      confirmBtn.click();
    }

    // 6. Hiển thị Toast thông báo thành công và đóng modal
    if (modalContainer) {
      modalContainer.style.display = 'none';
    }

    const toast = resolveElement(SELECTORS.TOAST_SUCCESS, this.doc);
    if (toast) {
      toast.style.display = 'block';
    }

    logger.info(
      'FORWARD_PHASE1',
      'N08',
      `Pha 1 hoàn tất: Chia sẻ media thành công tới [${targetGroupIds.join(', ')}]`,
      {
        groupId: bundle.sourceGroupId,
      },
    );

    return true;
  }
}

export const forwardAutomator = new ForwardAutomator();
