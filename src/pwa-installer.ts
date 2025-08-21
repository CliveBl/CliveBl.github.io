interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface InstallPromptEvent extends Event {
  readonly platform?: string;
}

class PWAInstaller {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private installButton: HTMLButtonElement | null = null;

  constructor() {
    this.init();
  }

  private init(): void {
    // Listen for the beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      this.showInstallButton();
    });

    // Listen for successful installation
    window.addEventListener('appinstalled', (e: Event) => {
      console.log('PWA was installed');
      this.hideInstallButton();
      this.deferredPrompt = null;
    });

    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      console.log('App is running in standalone mode');
    }
  }

  private showInstallButton(): void {
    // Create install button if it doesn't exist
    if (!this.installButton) {
      this.installButton = document.createElement('button');
      this.installButton.id = 'pwa-install-btn';
      this.installButton.className = 'pwa-install-button';
      this.installButton.innerHTML = '📱 התקן אפליקציה';
      this.installButton.addEventListener('click', () => this.installApp());
      
      // Add to the page
      const container = document.querySelector('.landing-container');
      if (container) {
        container.appendChild(this.installButton);
      }
    }
    
    if (this.installButton) {
      this.installButton.style.display = 'block';
    }
  }

  private hideInstallButton(): void {
    if (this.installButton) {
      this.installButton.style.display = 'none';
    }
  }

  private async installApp(): Promise<void> {
    if (!this.deferredPrompt) {
      return;
    }

    try {
      // Show the install prompt
      this.deferredPrompt.prompt();

      // Wait for the user to respond to the prompt
      const { outcome } = await this.deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
    } catch (error) {
      console.error('Error during installation:', error);
    } finally {
      this.deferredPrompt = null;
      this.hideInstallButton();
    }
  }

  // Check if the app can be installed
  public canInstall(): boolean {
    return this.deferredPrompt !== null;
  }
}

// Initialize PWA installer when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PWAInstaller();
});

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/js/sw.js')
      .then((registration: ServiceWorkerRegistration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError: Error) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}
