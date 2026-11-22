export const IOS_EASE = [0.22, 1, 0.36, 1] as const;

export const IOS_SPRING = {
  type: "spring" as const,
  stiffness: 340,
  damping: 30,
  mass: 0.78,
};

export const IOS_SHEET_SPRING = {
  type: "spring" as const,
  stiffness: 360,
  damping: 32,
  mass: 0.82,
};

export const TAP_SCALE = {
  scale: 0.96,
};

export const STAGGER_CONTAINER = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.01,
    },
  },
};

export const STAGGER_ITEM = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: IOS_EASE,
    },
  },
};

export const TAB_TRANSITION = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.18,
      ease: IOS_EASE,
    },
  },
};
