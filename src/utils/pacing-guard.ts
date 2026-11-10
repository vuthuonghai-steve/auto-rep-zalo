export type CircuitBreakerState = 'NORMAL' | 'PAUSED_BY_CAPTCHA' | 'EMERGENCY_STOPPED';

/**
 * Sinh khoảng thời gian chờ ngẫu nhiên giữa minMs và maxMs (mặc định 1000ms - 2000ms).
 */
export async function randomJitter(minMs = 1000, maxMs = 2000): Promise<number> {
  const duration = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  await new Promise((resolve) => setTimeout(resolve, duration));
  return duration;
}

/**
 * Sinh độ trễ gõ phím con người (mặc định 30ms - 80ms/ký tự).
 */
export async function microDelay(minMs = 30, maxMs = 80): Promise<number> {
  const duration = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  await new Promise((resolve) => setTimeout(resolve, duration));
  return duration;
}

export class CircuitBreaker {
  private state: CircuitBreakerState = 'NORMAL';
  private listeners: Set<(state: CircuitBreakerState, reason?: string) => void> = new Set();
  private lastReason?: string | undefined;

  /**
   * Kích hoạt dừng khẩn cấp do gặp Captcha hoặc yêu cầu xác minh bảo mật.
   */
  tripCaptcha(reason = 'Captcha verification detected'): void {
    this.setState('PAUSED_BY_CAPTCHA', reason);
  }

  /**
   * Kích hoạt nút dừng thủ công của người dùng (Emergency Stop).
   */
  emergencyStop(reason = 'User activated Emergency Stop'): void {
    this.setState('EMERGENCY_STOPPED', reason);
  }

  /**
   * Khôi phục trạng thái hoạt động bình thường.
   */
  resume(): void {
    this.setState('NORMAL');
  }

  /**
   * Kiểm tra hệ thống có đang bị chặn hay không.
   */
  isBlocked(): boolean {
    return this.state !== 'NORMAL';
  }

  /**
   * Ném ngoại lệ Fail-Fast nếu Circuit Breaker đang bị chặn.
   */
  assertNotBlocked(): void {
    if (this.state === 'PAUSED_BY_CAPTCHA') {
      throw new Error(`CircuitBreaker Blocked: ${this.lastReason || 'Captcha pause'}`);
    }
    if (this.state === 'EMERGENCY_STOPPED') {
      throw new Error(`CircuitBreaker Blocked: ${this.lastReason || 'Emergency stop'}`);
    }
  }

  /**
   * Lấy trạng thái hiện tại.
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Đăng ký hàm lắng nghe sự thay đổi trạng thái của Circuit Breaker.
   */
  onStateChange(listener: (state: CircuitBreakerState, reason?: string) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setState(newState: CircuitBreakerState, reason?: string): void {
    if (this.state === newState) return;
    this.state = newState;
    this.lastReason = reason;

    for (const listener of this.listeners) {
      try {
        listener(newState, reason);
      } catch {
        // Bỏ qua lỗi trong listener
      }
    }
  }
}

export const circuitBreaker = new CircuitBreaker();
