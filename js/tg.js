/* ==========================================================================
   MINI METRO - Telegram Mini App (TMA) Bridge
   Haptic feedback, theme synchronization, viewport expansion,
   and swipe-down-to-close protection
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

        // Disable native swipe down to close gesture (prevents window from closing when dragging finger!)
        if (this.tg.disableVerticalSwipes) {
          this.tg.disableVerticalSwipes();
        }
        if ('isVerticalSwipesEnabled' in this.tg) {
          this.tg.isVerticalSwipesEnabled = false;
        }

        // Enable closing confirmation prompt so player doesn't accidentally exit
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
      return this.tg.colorScheme;
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

  // Haptics: Selection changed
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

  // Share score
  shareScore(cityName, score, days) {
    const text = encodeURIComponent(
      `🚇 Я перевёз ${score} пассажиров за ${days} дней в Mini Metro (${cityName})! Попробуй побить мой рекорд:`
    );
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${text}`;
    if (this.tg?.openTelegramLink) {
      this.tg.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank');
    }
  }
}
