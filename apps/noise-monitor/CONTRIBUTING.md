# Contributing to Sound Level Monitor

Thank you for your interest in contributing! This project is designed to help teachers manage classroom noise, and we welcome improvements from the community.

## How to Contribute

### Reporting Bugs
1. Check if the issue already exists
2. Create a new issue with:
   - Clear description
   - Steps to reproduce
   - Browser/device info
   - Screenshots if applicable

### Suggesting Features
1. Open an issue with "Feature Request:" prefix
2. Explain the use case
3. Describe expected behavior

### Code Contributions

#### Setup
```bash
git clone https://github.com/dryck/sound-level-monitor.git
cd sound-level-monitor
npm install
npm run dev
```

#### Guidelines
- Follow existing code style
- Write clear commit messages
- Test on mobile and desktop
- Update documentation if needed

#### Areas for Contribution
- 🎨 New visual themes
- 🔊 Additional sound options
- 🌍 Translations
- ♿ Accessibility improvements
- 📱 Mobile optimizations

### Creating New Themes

Themes are React components in `src/themes/`. To create one:

1. Create `YourTheme.tsx` in `src/themes/`
2. Implement `ThemeProps` interface
3. Add to theme selector
4. Include preview image

Example structure:
```tsx
export function YourTheme({ noiseLevel, threshold, isTooLoud }: ThemeProps) {
  // Your animation logic
  return <svg>...</svg>
}
```

## Code of Conduct

- Be respectful and constructive
- Focus on helping teachers and students
- Welcome newcomers

## Questions?

Open an issue or reach out to the maintainers.

Thank you for helping improve classroom management tools! 🎓
