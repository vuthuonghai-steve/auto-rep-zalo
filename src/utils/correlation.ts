export class CorrelationContext {
  private currentId: string | null = null;

  /**
   * Sinh Correlation ID dạng chuỗi duy nhất theo chuẩn: corr_<timestamp>_<random>
   */
  generate(): string {
    const timestamp = Date.now();
    const randomHex =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID().replace(/-/g, '').substring(0, 12)
        : Math.random().toString(36).substring(2, 10);
    return `corr_${timestamp}_${randomHex}`;
  }

  /**
   * Thiết lập Correlation ID thủ công trong phạm vi hiện tại.
   */
  set(id: string): void {
    this.currentId = id;
  }

  /**
   * Xóa Correlation ID hiện tại.
   */
  clear(): void {
    this.currentId = null;
  }

  /**
   * Lấy Correlation ID hiện hành hoặc tự sinh mới nếu chưa được khởi tạo.
   */
  get(): string {
    return this.currentId || this.generate();
  }

  /**
   * Thực thi một khối hàm (đồng bộ hoặc bất đồng bộ) trong phạm vi Correlation ID chỉ định.
   * Đảm bảo khôi phục lại ID trước đó sau khi kết thúc phạm vi.
   */
  runWith<T>(correlationId: string, fn: () => T): T {
    const previousId = this.currentId;
    this.currentId = correlationId;

    try {
      const result = fn();
      if (result && typeof (result as unknown as Promise<unknown>).then === 'function') {
        return (result as unknown as Promise<unknown>).finally(() => {
          this.currentId = previousId;
        }) as unknown as T;
      }
      this.currentId = previousId;
      return result;
    } catch (error) {
      this.currentId = previousId;
      throw error;
    }
  }

  // Static convenience wrappers to maintain exact contract with plan.md and specs
  private static instance = new CorrelationContext();

  static generate(): string {
    return CorrelationContext.instance.generate();
  }

  static set(id: string): void {
    CorrelationContext.instance.set(id);
  }

  static clear(): void {
    CorrelationContext.instance.clear();
  }

  static get(): string {
    return CorrelationContext.instance.get();
  }

  static runWith<T>(correlationId: string, fn: () => T): T {
    return CorrelationContext.instance.runWith(correlationId, fn);
  }
}

export const correlationContext = new CorrelationContext();
