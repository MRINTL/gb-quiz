import { useEffect, useState } from 'react';
import { MAX_CATEGORY_NAME_LENGTH } from '../types';

interface CategoryHeaderProps {
  name: string;
  categoryIndex: number;
  isEditable: boolean;
  onRename?: (categoryIndex: number, newName: string) => void;
}

export function CategoryHeader({ name, categoryIndex, isEditable, onRename }: CategoryHeaderProps) {
  const [draftName, setDraftName] = useState(name);

  // Keep the draft in sync with remote changes while the input is not being edited.
  useEffect(() => setDraftName(name), [name]);

  const commit = (): void => {
    const trimmed = draftName.trim();
    if (trimmed !== name) onRename?.(categoryIndex, trimmed);
  };

  if (isEditable) {
    return (
      <div className="category-header category-header--editing">
        <input
          className="category-header__input"
          value={draftName}
          maxLength={MAX_CATEGORY_NAME_LENGTH}
          placeholder={`Категория ${categoryIndex + 1}`}
          aria-label={`Название категории ${categoryIndex + 1}`}
          onChange={(event) => setDraftName(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') {
              setDraftName(name);
              event.currentTarget.blur();
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="category-header" title={name}>
      <span className="category-header__name">{name || `Категория ${categoryIndex + 1}`}</span>
    </div>
  );
}
