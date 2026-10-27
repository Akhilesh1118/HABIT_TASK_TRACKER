import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Edit2, Check, RefreshCw, AlertCircle, Tag, Palette } from 'lucide-react';
import { CategoryItem } from '../types';
import { storageService } from '../services/storageService';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoriesChanged?: (categories: CategoryItem[]) => void;
}

const EMOJI_OPTIONS = ['🎯', '💻', '🗣️', '💪', '📖', '📌', '⚡', '🚀', '📚', '✍️', '🔬', '🎨', '🧠', '🏆', '🧪', '💼'];

const COLOR_OPTIONS = [
  { label: 'Blue', color: '#2563eb', bg: 'bg-blue-50 text-blue-700 border-blue-200' },
  { label: 'Emerald', color: '#059669', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { label: 'Amber', color: '#d97706', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  { label: 'Purple', color: '#7c3aed', bg: 'bg-purple-50 text-purple-700 border-purple-200' },
  { label: 'Rose', color: '#e11d48', bg: 'bg-rose-50 text-rose-700 border-rose-200' },
  { label: 'Cyan', color: '#0891b2', bg: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { label: 'Indigo', color: '#4f46e5', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { label: 'Slate', color: '#475569', bg: 'bg-stone-100 text-stone-700 border-stone-200' },
];

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  onCategoriesChanged,
}) => {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingIcon, setEditingIcon] = useState('');
  
  // New category creation form
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('📌');
  const [newColorIndex, setNewColorIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadCategories();
      setError(null);
      setEditingId(null);
    }
  }, [isOpen]);

  const loadCategories = () => {
    const list = storageService.getCategories();
    setCategories(list);
  };

  if (!isOpen) return null;

  const handleAddCategory = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) {
      setError('Category name cannot be empty');
      return;
    }

    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      setError(`A category named "${trimmed}" already exists`);
      return;
    }

    const selectedColor = COLOR_OPTIONS[newColorIndex];
    storageService.addCategory({ name: trimmed, icon: newIcon, color: selectedColor.color });
    const updated = storageService.getCategories();
    setCategories(updated);
    if (onCategoriesChanged) onCategoriesChanged(updated);

    // Reset inputs
    setNewName('');
    setNewIcon('📌');
    setError(null);
  };

  const handleStartEdit = (cat: CategoryItem) => {
    setEditingId(cat.id);
    setEditingName(cat.name);
    setEditingIcon(cat.icon || '📌');
    setError(null);
  };

  const handleSaveEdit = (id: string) => {
    const trimmed = editingName.trim();
    if (!trimmed) {
      setError('Category name cannot be empty');
      return;
    }

    // Check collision with another category
    if (categories.some((c) => c.id !== id && c.name.toLowerCase() === trimmed.toLowerCase())) {
      setError(`Another category is already named "${trimmed}"`);
      return;
    }

    storageService.updateCategory(id, { name: trimmed, icon: editingIcon });
    const updated = storageService.getCategories();
    setCategories(updated);
    if (onCategoriesChanged) onCategoriesChanged(updated);
    setEditingId(null);
    setError(null);
  };

  const handleDeleteCategory = (cat: CategoryItem) => {
    if (cat.isDefault) {
      const confirmSys = window.confirm(
        `"${cat.name}" is a default category. Are you sure you want to remove it? You can restore defaults at any time.`
      );
      if (!confirmSys) return;
    } else {
      const confirmDelete = window.confirm(`Delete category "${cat.name}"?`);
      if (!confirmDelete) return;
    }

    storageService.deleteCategory(cat.id);
    const updated = storageService.getCategories();
    setCategories(updated);
    if (onCategoriesChanged) onCategoriesChanged(updated);
  };

  const handleResetDefaults = () => {
    if (window.confirm('Reset categories back to default (Personal Learning)?')) {
      const defaults = storageService.resetCategories();
      setCategories(defaults);
      if (onCategoriesChanged) onCategoriesChanged(defaults);
      setError(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900">Manage Categories</h2>
              <p className="text-xs text-stone-500">Create, edit, or customize your task categories</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Add Category Form */}
          <div className="p-4 bg-purple-50/50 border border-purple-100 rounded-xl space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-purple-600" />
              Add New Category
            </h3>

            <div className="flex flex-col sm:flex-row gap-2">
              {/* Icon Picker */}
              <div className="relative">
                <select
                  value={newIcon}
                  onChange={(e) => setNewIcon(e.target.value)}
                  className="h-10 px-3 bg-white border border-stone-300 rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                >
                  {EMOJI_OPTIONS.map((emoji) => (
                    <option key={emoji} value={emoji}>
                      {emoji}
                    </option>
                  ))}
                </select>
              </div>

              {/* Name Input */}
              <input
                type="text"
                placeholder="Category name (e.g., General Studies, Math, Reading)"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCategory();
                  }
                }}
                className="flex-1 h-10 px-3 bg-white border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />

              <button
                type="button"
                onClick={() => handleAddCategory()}
                className="h-10 px-4 bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs rounded-xl shadow-xs transition-colors shrink-0 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </button>
            </div>

            {/* Color preview selection */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-stone-500 flex items-center gap-1">
                <Palette className="w-3 h-3 text-stone-400" />
                Color:
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {COLOR_OPTIONS.map((col, idx) => (
                  <button
                    key={col.label}
                    type="button"
                    onClick={() => setNewColorIndex(idx)}
                    className={`w-5 h-5 rounded-full border-2 transition-transform cursor-pointer ${
                      newColorIndex === idx ? 'scale-125 border-stone-900 shadow-xs' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: col.color }}
                    title={col.label}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Existing Categories List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                Active Categories ({categories.length})
              </span>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="text-xs text-stone-500 hover:text-stone-800 flex items-center gap-1 cursor-pointer transition-colors"
                title="Restore initial default category list"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reset Defaults</span>
              </button>
            </div>

            <div className="space-y-2">
              {categories.map((cat) => {
                const isEditing = editingId === cat.id;

                if (isEditing) {
                  return (
                    <div
                      key={cat.id}
                      className="p-3 bg-stone-50 border border-purple-300 rounded-xl flex items-center gap-2"
                    >
                      <select
                        value={editingIcon}
                        onChange={(e) => setEditingIcon(e.target.value)}
                        className="h-8 px-2 bg-white border border-stone-300 rounded-lg text-base"
                      >
                        {EMOJI_OPTIONS.map((emoji) => (
                          <option key={emoji} value={emoji}>
                            {emoji}
                          </option>
                        ))}
                      </select>

                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="flex-1 h-8 px-2 text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveEdit(cat.id);
                          }
                        }}
                        autoFocus
                      />

                      <button
                        type="button"
                        onClick={() => handleSaveEdit(cat.id)}
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg cursor-pointer"
                        title="Save"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="p-1.5 text-stone-400 hover:bg-stone-200 rounded-lg cursor-pointer"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                }

                return (
                  <div
                    key={cat.id}
                    className="group p-2.5 bg-stone-50/60 hover:bg-stone-100/80 border border-stone-200/70 rounded-xl flex items-center justify-between transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-lg shrink-0">{cat.icon || '📌'}</span>
                      <span className="text-sm font-semibold text-stone-800 truncate">
                        {cat.name}
                      </span>
                      {cat.isSystem && (
                        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-stone-200/70 text-stone-600 shrink-0">
                          Default
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(cat)}
                        className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-white rounded-lg transition-colors cursor-pointer"
                        title="Rename or change icon"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat)}
                        className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                        title="Delete category"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {categories.length === 0 && (
                <div className="text-center py-6 text-stone-400 text-xs">
                  No categories found. Click &quot;Reset Defaults&quot; to restore defaults.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-stone-50 border-t border-stone-100 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
