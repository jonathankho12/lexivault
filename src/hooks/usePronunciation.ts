"use client";

import { useCallback, useEffect, useState } from "react";
import {
  buildAudioKey,
  playPronunciation,
  stopPronunciation,
  subscribeAudioState,
  type AudioPlaybackState,
} from "@/lib/audioCache";
import type { AccentType } from "@/types/lexivault";

export function usePronunciation() {
  const [state, setState] = useState<AudioPlaybackState>({
    playingKey: null,
    loadingKey: null,
  });

  useEffect(() => {
    return subscribeAudioState(setState);
  }, []);

  const play = useCallback(
    async (options: {
      text: string;
      accent: AccentType;
      remoteUrl?: string | null;
      wordId?: string;
      onRemoteUrlDiscovered?: (url: string) => void;
    }) => {
      await playPronunciation(options);
    },
    []
  );

  const isPlaying = useCallback(
    (text: string, accent: AccentType) => {
      return state.playingKey === buildAudioKey(text, accent);
    },
    [state.playingKey]
  );

  const isLoading = useCallback(
    (text: string, accent: AccentType) => {
      return state.loadingKey === buildAudioKey(text, accent);
    },
    [state.loadingKey]
  );

  const stop = useCallback(() => {
    stopPronunciation();
  }, []);

  return {
    play,
    isPlaying,
    isLoading,
    stop,
    playingKey: state.playingKey,
    loadingKey: state.loadingKey,
  };
}
