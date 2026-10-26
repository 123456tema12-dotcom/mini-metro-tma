/* ==========================================================================
   MINI METRO - Telegram Mini App (TMA) Bridge
   Haptic feedback, theme synchronization, viewport expansion, score sharing
   ========================================================================== */

export class TelegramBridge {
  constructor() {
    this.tg = window.Telegram?.WebApp || null;
    this.init();
  }

  init() {
    if (this.tg) {
      try {
        this.tg.ready();
        this.tg.expand();
        if (this.tg.enableClosingConfirmation) {
          this.tg.enableClosingConfirmation();
        }
      } catch (e) {
        console.warn('Telegram WebApp init notice:', e);
      }
    }
  }

  isTelegram() {
    return !!this.tg && !!this.tg.initData;
  }

  getThemeMode() {
    if (this.tg && this.tg.colorScheme) {
      return this.tg.colorScheme; // 'light' or 'dark'
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  // Haptics: Impact ('light', 'medium', 'heavy', 'rigid', 'soft')
  hapticImpact(style = 'light') {
    if (this.tg?.HapticFeedback) {
      try {
        this.tg.HapticFeedback.impactOccurred(style);
        return;
      } catch (_) {}
    }
    // Web fallback for mobile browsers
    if (navigator.vibrate) {
      const ms = style === 'heavy' ? 24 : style === 'medium' ? 14 : 8;
      navigator.vibrate(ms);
    }
  }

  // Haptics: Notification ('error', 'success', 'warning')
  hapticNotification(type = 'success') {
    if (this.tg?.HapticFeedback) {
      try {
        this.tg.HapticFeedback.notificationOccurred(type);
        return;
      } catch (_) {}
    }
    if (navigator.vibrate) {
      if (type === 'error') navigator.vibrate([30, 40, 30]);
      else if (type === 'warning') navigator.vibrate([20, 30, 20]);
      else navigator.vibrate(20);
    }
  }

  // Haptics: Selection changed (subtle tick)
  hapticSelection() {
    if (this.tg?.HapticFeedback) {
      try {
        this.tg.HapticFeedback.selectionChanged();
        return;
      } catch (_) {}
    }
    if (navigator.vibrate) {
      navigator.vibrate(6);
    }
  }

  // Share score via Telegram share dialog
  shareScore(cityName, score, days) {
    const text = encodeURIComponent(
      `🚇 I delivered ${score} passengers over ${days} days in Mini Metro (${cityName})! Can you beat my subway network?`
    );
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${text}`;
    if (this.tg?.openTelegramLink) {
      this.tg.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank');
    }
  }
}
