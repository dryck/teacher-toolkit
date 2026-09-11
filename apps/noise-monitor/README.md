# Sound Level Monitor

> A professional classroom noise management tool for teachers

[![Live Demo](https://img.shields.io/badge/Live-Demo-blue)](https://dryck.github.io/sound-level-monitor)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

## 🎯 What is it?

**Sound Level Monitor** is a browser-based tool that helps teachers manage classroom noise levels in real-time. It uses the device's microphone to detect noise and provides visual feedback through animated themes, making it easy for students to self-regulate their volume.

Perfect for:
- 🏫 Elementary, middle, and high school classrooms
- 📚 Libraries and study halls  
- 🎨 Art rooms and maker spaces
- 🏠 Homeschooling environments

---

## ✨ Features

### 🎨 Three Visual Themes

#### 🥚 Egg Theme
A cute animated egg character that reacts to noise:
- **Happy face** when quiet
- **Worried expression** when getting loud
- **Shocked + sweat drops** when too loud
- **Shake animation** at critical levels
- Color indicator ring (green → yellow → red)

#### 🥤 Glass Theme
An elegant glass that fills with liquid:
- **Liquid level** rises with noise
- **Wave animation** on surface
- **Rising bubbles** effect
- **Color gradient** (green → yellow → red)
- Measurement lines for reference

#### 🖼️ Custom Theme
Upload your own images:
- Support for multiple images (quiet/moderate/loud)
- Automatic image switching based on noise level
- Overlay effects and glow animations
- Perfect for school mascots or custom characters

### 🔊 Customizable Audio Alerts

**Built-in sounds:**
- 🔔 School Bell — classic attention signal
- 🎵 Gentle Chime — soft reminder
- 🚨 Alert Buzz — urgent warning

**Custom sounds:**
- Upload your own MP3/WAV/OGG files
- Preview before selecting
- Persistent storage

### ⚙️ Smart Settings

- **Noise threshold** — adjustable 30-100 dB scale
- **Mute button** — quick audio toggle
- **Fullscreen mode** — perfect for projectors
- **All settings persist** — saved to browser storage

### 📱 Progressive Web App (PWA)

Install on any device:
- **iOS/Android** — add to home screen
- **Desktop** — Chrome/Edge installation
- **Works offline** — service worker included
- **Native app feel** — standalone mode

---

## 🚀 Quick Start

### Online (Recommended)
Simply open in your browser:
```
https://dryck.github.io/sound-level-monitor
```

### Local Development
```bash
# Clone the repository
git clone https://github.com/dryck/sound-level-monitor.git

# Navigate to project
cd sound-level-monitor

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

---

## 📖 User Guide

### First Time Setup

1. **Open the app** in your browser
2. **Click "Start Monitoring"**
3. **Allow microphone access** when prompted
4. **Choose your theme** in settings
5. **Adjust the threshold** to match your classroom

### Using in Class

#### Starting a Session
1. Place device near the center of the classroom
2. Enable fullscreen mode for visibility
3. Set appropriate threshold (recommend 60-70 dB for active learning)
4. Monitor the visual indicator with students

#### Interpreting the Display

| Visual | Noise Level | Student Action |
|--------|-------------|----------------|
| 🟢 Green / Happy | Quiet (0-50%) | Good job! Keep it up |
| 🟡 Yellow / Worried | Moderate (50-80%) | Lower voices slightly |
| 🔴 Red / Shocked | Loud (80%+) | Too loud! Quiet down |

#### Settings Explained

**General Tab:**
- **Noise Threshold** — the dB level that triggers "too loud" warning
- **Mute** — silences audio alerts (visual still works)

**Themes Tab:**
- Select between Egg, Glass, or Custom
- For Custom: upload 1-3 images for different noise levels

**Sounds Tab:**
- Choose alert sound or upload your own
- Preview sounds before selecting

### Tips for Teachers

💡 **Start strict, then relax** — begin with a lower threshold and gradually increase as students learn to self-regulate

💡 **Make it a game** — challenge students to keep the indicator green for 5 minutes

💡 **Use positive reinforcement** — praise when the class maintains quiet levels

💡 **Position matters** — place the device equidistant from all students for accurate readings

---

## 🛠️ Technical Details

### Browser Requirements
- Chrome/Edge (recommended)
- Firefox
- Safari 14.5+ (iOS)
- Microphone permission required

### Privacy
- 🔒 **No data leaves your device**
- 🔒 **No server communication**
- 🔒 **All processing happens locally**
- 🔒 **Settings stored in browser only**

### Performance
- Optimized for 60fps animations
- Low CPU usage when idle
- Efficient audio processing
- Works on older devices

---

## 🎨 Customization Guide

### Creating Custom Images

For best results:
- **Format:** PNG or JPG
- **Size:** 512x512 pixels minimum
- **Style:** Simple, high contrast works best
- **Background:** Transparent or solid color

**Recommended approach:**
1. Create 3 versions of your character:
   - **Quiet:** Happy, relaxed pose
   - **Moderate:** Alert, attentive pose  
   - **Loud:** Alarmed, warning pose

2. Upload in Settings → Themes → Custom

3. Test and adjust threshold as needed

### Using School Mascot

Perfect for school spirit:
- Use your mascot in different emotional states
- Add school colors to the overlay
- Students love seeing familiar characters

---

## 🐛 Troubleshooting

### Microphone Not Working
1. Check browser permissions (click 🔒 icon in address bar)
2. Ensure no other app is using the microphone
3. Try refreshing the page
4. Check physical microphone connection

### Audio Alerts Not Playing
1. Check if device is muted
2. Verify app mute button is off
3. Some browsers block autoplay — click anywhere on page first

### Display Looks Wrong
1. Try fullscreen mode
2. Refresh the page
3. Check browser zoom level (should be 100%)

### PWA Installation Issues
**iOS:** Must use Safari (Chrome on iOS cannot install PWAs)
**Android:** Chrome or Samsung Browser recommended
**Desktop:** Chrome or Edge required

---

## 📝 Changelog

### v2.0.0 (Current)
- Complete rewrite with React + TypeScript
- Three visual themes (Egg, Glass, Custom)
- Custom sound upload support
- PWA support with offline mode
- Improved mobile responsiveness

### v1.0.0
- Initial release
- Single-file HTML version
- Basic egg theme

---

## 🤝 Contributing

This project is open source! Contributions welcome:
- Bug reports
- Feature suggestions
- New theme designs
- Translation help

Please open an issue or pull request on GitHub.

---

## 📄 License

MIT License — free for personal and educational use.

---

## 🙏 Credits

Made with ❤️ for teachers everywhere

Designed by educators, for educators.

---

**[⬆ Back to Top](#sound-level-monitor)**
