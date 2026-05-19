import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { GreekKeyboard } from '../components/GreekKeyboard';

// Mock expo-haptics
jest.mock('expo-haptics', () => {
  return {
    impactAsync: jest.fn().mockResolvedValue(true),
    notificationAsync: jest.fn().mockResolvedValue(true),
    ImpactFeedbackStyle: {
      Light: 0,
      Medium: 1,
      Heavy: 2,
    },
  };
});

describe('GreekKeyboard Component', () => {
  it('should render all Greek letter keys correctly', () => {
    const handleKeyPress = jest.fn();
    const handleBackspace = jest.fn();

    const { getByText } = render(
      <GreekKeyboard onKeyPress={handleKeyPress} onBackspace={handleBackspace} />
    );

    // Verify key existence for letters
    expect(getByText('Α')).toBeTruthy();
    expect(getByText('Ω')).toBeTruthy();
    expect(getByText('Ε')).toBeTruthy();
  });

  it('should call onKeyPress when a letter key is pressed', () => {
    const handleKeyPress = jest.fn();
    const handleBackspace = jest.fn();

    const { getByText } = render(
      <GreekKeyboard onKeyPress={handleKeyPress} onBackspace={handleBackspace} />
    );

    const keyA = getByText('Α');
    fireEvent.press(keyA);

    expect(handleKeyPress).toHaveBeenCalledWith('Α');
  });

  it('should call onBackspace when backspace key is pressed', () => {
    const handleKeyPress = jest.fn();
    const handleBackspace = jest.fn();

    const { getByTestId } = render(
      <GreekKeyboard onKeyPress={handleKeyPress} onBackspace={handleBackspace} />
    );

    const backspaceBtn = getByTestId('keyboard-backspace-btn');
    fireEvent.press(backspaceBtn);

    expect(handleBackspace).toHaveBeenCalled();
  });

  it('should call onClear when clear key is pressed', () => {
    const handleKeyPress = jest.fn();
    const handleBackspace = jest.fn();
    const handleClear = jest.fn();

    const { getByTestId } = render(
      <GreekKeyboard 
        onKeyPress={handleKeyPress} 
        onBackspace={handleBackspace} 
        onClear={handleClear} 
      />
    );

    const clearBtn = getByTestId('keyboard-clear-btn');
    fireEvent.press(clearBtn);

    expect(handleClear).toHaveBeenCalled();
  });
});
