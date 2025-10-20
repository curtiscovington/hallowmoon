import type { SlotType } from '../state/types';

export const SLOT_TYPE_INFO: Record<SlotType, { label: string; icon: string }> = {
  hearth: { label: 'Hearth', icon: '🔥' },
  work: { label: 'Work', icon: '🛠' },
  study: { label: 'Study', icon: '📚' },
  ritual: { label: 'Ritual', icon: '🔮' },
  expedition: { label: 'Expedition', icon: '🧭' },
  manor: { label: 'Manor', icon: '🏚️' },
  bedroom: { label: 'Bedroom', icon: '🛏️' }
};
