import { useState, useEffect, useCallback } from 'react';

export function useUserRole(editorMode: boolean) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCoordinator, setIsCoordinator] = useState(false);
  const [isLexicographer, setIsLexicographer] = useState(false);
  const [username, setUsername] = useState<string>('');
  const [createdBy, setCreatedBy] = useState<number | null>(null);
  const fetchUser = useCallback(async () => {
    if (!editorMode) {
      setIsAdmin(false);
      setIsCoordinator(false);
      setIsLexicographer(false);
      setUsername('');
      setCreatedBy(null);
      return;
    }

    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const role = data.user?.role;
        const username = data.user?.name;
        const createdBy = data.user?.id ? parseInt(data.user.id, 10) : null;
        setCreatedBy(createdBy);
        setIsAdmin(role === 'admin');
        setIsCoordinator(role === 'coordinator');
        setIsLexicographer(role === 'lexicographer');
        setUsername(username || '');
      } else {
        setIsAdmin(false);
        setIsCoordinator(false);
        setIsLexicographer(false);
      }
    } catch {
      setIsAdmin(false);
      setIsCoordinator(false);
      setIsLexicographer(false);
      setUsername('');
      setCreatedBy(null);
    }
  }, [editorMode]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return {
    isAdmin,
    isCoordinator,
    isLexicographer,
    username,
    currentId: createdBy,
  };
}
