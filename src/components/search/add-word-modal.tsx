'use client';

import { useState, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Popup from 'reactjs-popup';
import { SelectDropdown, MultiSelectDropdown } from '@/components/common/dropdown';
import { Button } from '@/components/common/button';
import { getLexicographerByRole, type User } from '@/lib/search-utils';
import { useUserRole } from '@/hooks/useUserRole';
interface AddWordModalProps {
  availableUsers: User[];
}

const LETTER_OPTIONS = 'abcdefghijklmnñopqrstuvwxyz'.split('').map((letter) => ({
  value: letter,
  label: letter.toUpperCase(),
}));

export function AddWordModal({ availableUsers }: AddWordModalProps) {
  const router = useRouter();
  const pathname = usePathname();
  const editorBasePath = pathname.startsWith('/editor') ? '/editor' : '';

  const [newWordRoot, setNewWordRoot] = useState('');
  const [newWordLemma, setNewWordLemma] = useState('');
  const [newWordLetter, setNewWordLetter] = useState('');
  const [newWordAssignedTo, setNewWordAssignedTo] = useState<string[]>([]);

  const { isAdmin, isCoordinator, isLexicographer, username, currentId } = useUserRole(true);

  const userOptions = useMemo(
    () => getLexicographerByRole(availableUsers, username, isAdmin, isCoordinator, isLexicographer),
    [availableUsers, username, isAdmin, isCoordinator, isLexicographer] // ← Todas las dependencias
  );
  const createdById = currentId;
  const autoLetterForLemma = newWordLemma.trim().charAt(0).toLowerCase();
  const selectedLetter = newWordLetter || autoLetterForLemma;

  const handleAddWord = async (close: () => void) => {
    const trimmedLemma = newWordLemma.trim();
    if (!trimmedLemma) {
      alert('El lema es requerido');
      return;
    }

    const rawAssignedTo = newWordAssignedTo.length > 0 ? parseInt(newWordAssignedTo[0], 10) : null;
    const assignedToValue =
      typeof rawAssignedTo === 'number' && Number.isInteger(rawAssignedTo) ? rawAssignedTo : null;
    const trimmedRoot = newWordRoot.trim();
    const autoLetter = trimmedLemma ? trimmedLemma[0].toLowerCase() : '';
    const trimmedLetter = newWordLetter.trim().toLowerCase();
    const letterToSend = trimmedLetter || autoLetter;

    try {
      const response = await fetch(`/api/words/${encodeURIComponent(trimmedLemma)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lemma: trimmedLemma,
          root: trimmedRoot,
          letter: letterToSend || undefined,
          assignedTo: assignedToValue,
          values: [],
          createdBy: createdById,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          (result && typeof result.error === 'string' && result.error) ||
          'Error al agregar la palabra';
        throw new Error(message);
      }

      const createdLemma =
        (result &&
          result.data &&
          typeof result.data.lemma === 'string' &&
          result.data.lemma.trim()) ||
        trimmedLemma;

      // Reset form
      setNewWordRoot('');
      setNewWordLemma('');
      setNewWordLetter('');
      setNewWordAssignedTo([]);

      // Close modal
      close();

      // Navigate to word page
      const destination = editorBasePath
        ? `${editorBasePath}/palabra/${encodeURIComponent(createdLemma)}`
        : `/palabra/${encodeURIComponent(createdLemma)}`;

      router.push(destination);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al agregar la palabra');
    }
  };

  return (
    <Popup
      trigger={
        <Button className="bg-duech-blue rounded-full px-8 py-3 text-lg font-semibold text-white shadow-lg hover:bg-blue-800">
          Agregar palabra
        </Button>
      }
      position="center center"
      modal
      overlayStyle={{ background: 'rgba(0, 0, 0, 0.8)' }}
      contentStyle={{
        background: 'transparent',
        border: 'none',
        width: 'auto',
      }}
      nested
    >
      {
        ((close: () => void) => (
          <div className="relative w-[500px] rounded-lg bg-white p-6 shadow-xl">
            <Button
              className="absolute top-3 right-3 text-2xl leading-none font-light text-gray-400 hover:text-gray-600"
              onClick={close}
            >
              &times;
            </Button>

            <h3 className="text-duech-blue mb-4 text-xl font-semibold">Agregar palabra</h3>

            <div className="mb-4 flex flex-col gap-3">
              <div>
                <label htmlFor="raiz" className="mb-1 block text-sm font-medium text-gray-900">
                  Palabra base
                </label>
                <input
                  type="text"
                  id="raiz"
                  placeholder=""
                  value={newWordRoot}
                  onChange={(e) => setNewWordRoot(e.target.value)}
                  className="focus:border-duech-blue focus:ring-duech-blue w-full rounded border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="lema" className="mb-1 block text-sm font-medium text-gray-900">
                  Lema
                </label>
                <input
                  type="text"
                  id="lema"
                  placeholder=""
                  value={newWordLemma}
                  onChange={(e) => setNewWordLemma(e.target.value)}
                  className="focus:border-duech-blue focus:ring-duech-blue w-full rounded border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:outline-none"
                />
              </div>
              <div>
                <SelectDropdown
                  label="Letra"
                  options={[{ value: '', label: 'Seleccionar letra' }, ...LETTER_OPTIONS]}
                  selectedValue={selectedLetter}
                  onChange={(value) => setNewWordLetter(value.toLowerCase())}
                  placeholder="Seleccionar letra"
                />
              </div>
            </div>
            <MultiSelectDropdown
              label="Asignado a"
              options={userOptions}
              selectedValues={newWordAssignedTo}
              onChange={setNewWordAssignedTo}
            />

            <div className="mt-5 flex justify-end">
              <Button
                className="bg-duech-blue rounded px-6 py-2 font-semibold text-white transition-colors hover:bg-blue-800"
                onClick={() => handleAddWord(close)}
              >
                Guardar
              </Button>
            </div>
          </div>
        )) as unknown as React.ReactNode
      }
    </Popup>
  );
}
