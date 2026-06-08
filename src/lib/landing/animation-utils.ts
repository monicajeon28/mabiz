export const getAnimationClass = (isVisible: boolean, enterClass: string, leaveClass: string = 'opacity-0'): string => {
  return isVisible ? enterClass : leaveClass;
};

export const staggerDelay = (index: number, baseDelay: number = 0.1): number => {
  return index * baseDelay;
};

export const easeOutCubic = (t: number): number => {
  return 1 - Math.pow(1 - t, 3);
};
