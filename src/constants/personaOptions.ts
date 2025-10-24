import { HERO_PERSONA_TEMPLATES } from '../state/content/cards';

export interface PersonaOptionDefinition {
  templateKey: string;
  accent: 'watcher' | 'weaver' | 'outcast';
  glyph: string;
  summary: string;
  name: string;
  quote: string;
}

const templateMap = new Map(
  HERO_PERSONA_TEMPLATES.map((template) => [template.key, { name: template.name, quote: template.description }])
);

const RAW_OPTIONS = [
  {
    templateKey: 'persona-watcher',
    accent: 'watcher',
    glyph: '👁️',
    summary: 'Attune to subtle omens and glimpse what others miss.'
  },
  {
    templateKey: 'persona-weaver',
    accent: 'weaver',
    glyph: '🕸️',
    summary: 'Spin threads between ideas, amplifying synergies and support.'
  },
  {
    templateKey: 'persona-outcast',
    accent: 'outcast',
    glyph: '🌘',
    summary: 'Endure alone, trading comfort for raw resolve and daring strides.'
  }
] as const satisfies readonly {
  templateKey: PersonaOptionDefinition['templateKey'];
  accent: PersonaOptionDefinition['accent'];
  glyph: string;
  summary: string;
}[];

export const PERSONA_OPTIONS: readonly PersonaOptionDefinition[] = RAW_OPTIONS.map((option) => {
  const template = templateMap.get(option.templateKey);
  if (!template) {
    throw new Error(`Unknown persona template: ${option.templateKey}`);
  }
  return {
    ...option,
    name: template.name,
    quote: template.quote
  } satisfies PersonaOptionDefinition;
});
