# Progressive Web App (PWA) Support

This application now supports Progressive Web App functionality, allowing users to install it on their Android devices and access it like a native app.

## Features

### 🚀 Installable App
- Users can install the app on their Android devices
- App appears in the app drawer with a custom icon
- Runs in standalone mode (no browser UI)

### 📱 Mobile Optimized
- Responsive design for mobile devices
- Touch-friendly interface
- Optimized for portrait orientation

### 🔄 Offline Support
- Service worker caches essential resources
- App works offline for cached content
- Automatic cache updates when online

### 🎨 Native App Experience
- Custom splash screen
- App-like navigation
- Status bar theming

## Installation

### For Users (Android)
1. Open the website in Chrome on Android
2. Look for the "📱 התקן אפליקציה" (Install App) button
3. Tap the button and follow the installation prompt
4. The app will be installed and appear in your app drawer

### For Users (iOS)
1. Open the website in Safari on iOS
2. Tap the Share button
3. Select "Add to Home Screen"
4. The app will be added to your home screen

## Technical Implementation

### Files Added
- `manifest.json` - Web app manifest
- `sw.js` - Service worker for offline functionality
- `js/pwa-installer.js` - PWA installation logic
- `browserconfig.xml` - Windows tile configuration

### Files Modified
- `index.html` - Added PWA meta tags and manifest
- `tax_return.html` - Added PWA support
- `css/index.css` - Added PWA-specific styles
- `package.json` - Added PWA configuration

### Service Worker
The service worker (`sw.js`) handles:
- Caching of essential resources
- Offline functionality
- Cache management and updates

### Manifest
The web app manifest (`manifest.json`) defines:
- App name and description
- Icons for different sizes
- Display mode and orientation
- Theme colors

## Browser Support

- **Chrome/Edge**: Full PWA support
- **Firefox**: Basic PWA support
- **Safari**: Limited PWA support (iOS only)
- **Samsung Internet**: Full PWA support

## Testing

### Chrome DevTools
1. Open DevTools (F12)
2. Go to Application tab
3. Check Manifest and Service Workers sections
4. Test offline functionality

### Lighthouse
1. Run Lighthouse audit
2. Check PWA score
3. Verify all PWA requirements are met

## Deployment

The PWA files are automatically included in the build process and deployed to Cloudflare Workers. No additional configuration is needed.

## Troubleshooting

### App Not Installing
- Ensure HTTPS is enabled
- Check if service worker is registered
- Verify manifest.json is accessible

### Offline Not Working
- Check service worker registration
- Verify cache is populated
- Check browser console for errors

### Icons Not Displaying
- Ensure icon files exist
- Check manifest.json icon paths
- Verify icon formats are supported

## Future Enhancements

- Push notifications
- Background sync
- Advanced offline strategies
- App store integration
