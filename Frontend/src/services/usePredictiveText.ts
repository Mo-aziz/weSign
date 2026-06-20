import { useState, useEffect } from 'react';

// Simple dictionary of common n-grams for sign language phrasing
const DICTIONARY: Record<string, string> = {
  // Greetings & Intros
  'my': 'name is',
  'what': 'is your name',
  'how': 'are you',
  'good': 'morning',
  'nice': 'to meet you',
  'where': 'is the bathroom',
  
  // Politeness
  'thank': 'you',
  'you': 'are welcome',
  'please': 'help me',
  'can': 'you sign slower',
  
  // Basic Questions/Statements
  'do': 'you understand',
  'i': 'am',
  'your': 'name',
};

export const usePredictiveText = (currentText: string | null) => {
  const [suggestion, setSuggestion] = useState<string | null>(null);

  useEffect(() => {
    if (!currentText) {
      setSuggestion(null);
      return;
    }

    // Get the last word of the current text
    const words = currentText.trim().toLowerCase().split(/\s+/);
    const lastWord = words[words.length - 1];

    if (lastWord && DICTIONARY[lastWord]) {
      setSuggestion(DICTIONARY[lastWord]);
    } else {
      setSuggestion(null);
    }
  }, [currentText]);

  return suggestion;
};
