# JP Typing — Japanese Typing Practice (Raycast Extension)

A Raycast extension for practicing Japanese romaji typing with real-time feedback and history management.

## Overview

### Key Features
- **Real-time Typing Practice**: Practice romaji input with Japanese words and sentences
- **Multiple Input Methods**: Support for JIS, Hepburn, and Liberal romaji input styles
- **Progress Visualization**: Real-time display of CPM/WPM, accuracy, and consecutive correct hits
- **History Management**: Save practice results locally and view statistics
- **Customizable Settings**: Adjust practice time, romaji rules, reading hints, and more
- **Practice Modes**: Choose between word mode and sentence mode
- **History Retention**: Configure the number of saved history entries (10-300 items)

### Supported Platforms
- macOS 13+
- Raycast latest stable version

## Commands

### JP Typing (Japanese Typing Practice)
Launch the typing practice interface with customizable settings.

#### Preferences
- **Practice Mode (Default)**: Choose between Word Mode or Sentence Mode
- **Practice Time (Default)**: Set default practice duration (30s/60s/180s)
- **Difficulty (Default)**: Select difficulty level (Beginner/Intermediate/Advanced)
- **Romaji Input Style**: Choose romaji conversion method (JIS/Hepburn/Liberal)
- **Show Kana Reading**: Toggle reading hints during practice

## Usage

1. Install the extension from Raycast Store
2. Run the "JP Typing" command
3. Configure your preferences in the command settings
4. Start practicing with real-time feedback
5. View your results and practice history

## Technical Details

### Repository Structure
```
src/
├── commands/
│   └── typing.tsx          # Main command entry point
├── views/
│   ├── Practice.tsx        # Practice screen component
│   ├── Result.tsx          # Results screen component
│   └── components/         # UI sub-components
├── engine/
│   ├── romanizer.ts        # Romaji conversion engine
│   ├── scorer.ts           # Scoring and metrics calculation
│   └── session.ts          # Session state management (FSM)
├── storage/
│   ├── history.ts          # History save/retrieve
│   ├── prefs.ts            # Settings management
│   └── schema.ts           # Schema definitions
├── data/
│   └── corpus.ts           # Built-in corpus (words/sentences)
├── types/
│   └── index.ts            # Type definitions
├── utils/
│   └── time.ts             # Time-related utilities
└── test/
    ├── romanizer.test.ts   # Romaji conversion tests
    ├── scorer.test.ts      # Scoring function tests
    ├── session.test.ts     # Session state tests
    ├── corpus.test.ts      # Corpus function tests
    └── prefs.test.ts       # Settings function tests
```

### Key Technologies
- **Framework**: React + TypeScript
- **Platform**: Raycast Extension API
- **Testing**: Vitest
- **Code Quality**: ESLint + Prettier

## Development

### Prerequisites
- Node.js 18+
- Raycast
- Git

### Setup
```bash
git clone https://github.com/raykeymas/jp-typing.git
cd jp-typing
npm install
```

### Development Commands
```bash
npm run dev          # Start development mode
npm run build        # Build for production
npm run test         # Run tests
npm run test:watch   # Run tests in watch mode
npm run lint         # Run ESLint and Prettier
npm run fix-lint     # Auto-fix linting issues
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

raykeymas

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for details.
