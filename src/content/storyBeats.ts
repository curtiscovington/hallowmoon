export type StoryBeatKey = 'arrival';

interface StoryBeat {
  key: StoryBeatKey;
  entries: string[];
}

const STORY_BEATS: Record<StoryBeatKey, StoryBeat> = {
  arrival: {
    key: 'arrival',
    entries: [
      'Night gathers as you step from the winding forest path and the manor reveals itself at last.',
      'Ancient pines hem the clearing, their needles whispering with secrets carried on the mist.',
      'The manor\'s doors groan open just enough to invite you inside, promising dust-drowned memories waiting to be stirred.'
    ]
  }
};

export function getStoryBeatEntries(key: StoryBeatKey): string[] {
  return STORY_BEATS[key].entries;
}

export function buildStoryLog(keys: StoryBeatKey | StoryBeatKey[]): string[] {
  const beatKeys = Array.isArray(keys) ? keys : [keys];
  return beatKeys.flatMap((beatKey) => getStoryBeatEntries(beatKey));
}
