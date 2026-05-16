class NotificationManager {
  constructor() {
    this.permission = Notification.permission;
  }

  async requestPermission() {
    if (!("Notification" in window)) {
      console.warn("This browser does not support desktop notification");
      return false;
    }

    if (Notification.permission !== "granted") {
      this.permission = await Notification.requestPermission();
    }
    return this.permission === "granted";
  }

  show(title, options = {}) {
    if (this.permission !== "granted") return;

    const defaultOptions = {
      icon: "/logo192.png",
      badge: "/logo192.png",
      silent: false,
      timestamp: Date.now(),
    };

    const notification = new Notification(title, {
      ...defaultOptions,
      ...options,
    });

    notification.onclick = (event) => {
      event.preventDefault();
      window.focus();
      if (options.url) {
        window.location.href = options.url;
      }
      notification.close();
    };

    // Auto-close after 5 seconds
    setTimeout(() => notification.close(), 5000);
  }
}

export default new NotificationManager();
