'use client';

import { usePathname } from 'next/navigation';
import { GRAMMATICAL_CATEGORIES, type Word } from '@/lib/definitions';
import MarkdownRenderer from '@/components/word/markdown-renderer';
import { ArrowRightIcon, BookOpenIcon } from '@/components/icons';
import { Button } from '@/components/common/button';
import { ChipList } from '@/components/common/chip';

export interface WordOfTheDayData {
  word: Word;
  letter: string;
}

interface WordOfTheDayProps {
  data: WordOfTheDayData | null;
  editorMode?: boolean;
}

export default function WordOfTheDay({ data, editorMode = false }: WordOfTheDayProps) {
  const pathname = usePathname();
  const editorBasePath = editorMode && pathname.startsWith('/editor') ? '/editor' : '';

  if (!data) {
    return (
      <div className="rounded-lg bg-white p-6 text-center shadow-md">
        <p className="text-gray-700">Aún no hay una palabra destacada para mostrar.</p>
      </div>
    );
  }

  const { word } = data;
  const firstDefinition = word.values[0];
  const definitionCategories = firstDefinition.categories ?? [];
  const shortMeaning =
    firstDefinition.meaning.length > 150
      ? `${firstDefinition.meaning.substring(0, 150)}...`
      : firstDefinition.meaning;

  const viewHref = `${editorBasePath || ''}/palabra/${encodeURIComponent(word.lemma)}`;

  return (
    <div className="border-duech-gold card-hover rounded-xl border-t-4 bg-white p-8 shadow-lg">
      <h2 className="text-duech-gold mb-6 flex items-center text-2xl font-bold">
        <BookOpenIcon className="text-duech-blue mr-3 h-8 w-8" />
        Palabra del Día
      </h2>
      <div className="mb-6">
        <h3 className="text-duech-blue mb-3 text-3xl font-bold">{word.lemma}</h3>
        {definitionCategories.length > 0 && (
          <div className="mb-4">
            <ChipList
              items={definitionCategories}
              labels={GRAMMATICAL_CATEGORIES}
              variant="category"
              editorMode={editorMode}
            />
          </div>
        )}
      </div>

      <div className="mb-6 text-lg leading-relaxed text-gray-800">
        <MarkdownRenderer content={shortMeaning} />
      </div>

      <Button
        href={viewHref}
        className="bg-duech-gold px-6 py-3 font-semibold text-gray-900 shadow-md hover:bg-yellow-500"
      >
        Ver definición completa
        <ArrowRightIcon className="ml-2 h-5 w-5 text-gray-900" />
      </Button>
    </div>
  );
}
