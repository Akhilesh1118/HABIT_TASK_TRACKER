import React, { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, Check, X, ChevronDown, Sparkles, AlertCircle } from 'lucide-react';
import { CategoryItem } from '../types';
import { storageService } from '../services/storageService';
import { CATEGORY_DETAILS } from '../utils/calendarUtils';

interface CategorySelectorProps {
  value: string;
  onChange: (categoryName: string) => void;
  className?: string;
  id?: string;
}

const POPULAR_EMOJIS = ['🎯', '💻', '🗣️', '💪', '📖', '🔬', '🧮', '📊', '📝', '⚡', '🎨', '📌', '⚖️', '🧠', '💼'];

export const CategorySelector: React.FC<CategorySelectorProps> = ({
  value,
  onChange,
  className = '',
  id = 'category-selector',
}) => {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  
  // Adding state
  const [isAdding, setIsAdding] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('🎯');

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');

  // Delete confirmation state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputAddRef = useRef<HTMLInputElement>(null);

  // Load categories from storage
  const refreshCategories = () => {
    const cats = storageService.getCategories();
    setCategories(cats);
  };

  useEffect(() => {
    refreshCategories();
    const handleUpdated = (e?: any) => {
      const cats = e?.detail || storageService.getCategories();
      setCategories(cats);
    };
    window.addEventListener('habits:categories_updated', handleUpdated);
    return () => {
      window.removeEventListener('habits:categories_updated', handleUpdated);
    };
  }, []);

  // Ensure selected value is valid among active categories
  useEffect(() => {
    if (categories.length > 0 && !categories.some((c) => c.name === value)) {
      onChange(categories[0].name);
    }
  }, [categories, value, onChange]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsAdding(false);
        setEditingId(null);
        setDeleteConfirmId(null);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus add input when adding is opened
  useEffect(() => {
    if (isAdding && inputAddRef.current) {
      inputAddRef.current.focus();
    }
  }, [isAdding]);

  // Find currently selected category item
  const selectedItem = categories.find((c) => c.name === value) || {
    id: 'unknown',
    name: value || 'Select Category',
    icon: CATEGORY_DETAILS[value]?.icon || '🏷️',
  };

  const handleSelect = (catName: string) => {
    onChange(catName);
    setIsOpen(false);
    setIsAdding(false);
    setEditingId(null);
    setDeleteConfirmId(null);
  };

  const handleStartAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAdding(true);
    setEditingId(null);
    setDeleteConfirmId(null);
    setNewCatName('');
    setNewCatIcon('🎯');
  };

  const handleSaveAdd = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = newCatName.trim();
    if (!clean) return;

    const created = storageService.addCategory({
      name: clean,
      icon: newCatIcon || '🏷️',
    });

    refreshCategories();
    onChange(created.name);
    setIsAdding(false);
    setNewCatName('');
    setIsOpen(false);
  };

  const handleStartEdit = (cat: CategoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditIcon(cat.icon || '🏷️');
    setIsAdding(false);
    setDeleteConfirmId(null);
  };

  const handleSaveEdit = (id: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = editName.trim();
    if (!clean) return;

    const updated = storageService.updateCategory(id, {
      name: clean,
      icon: editIcon,
    });

    refreshCategories();
    if (updated && value === categories.find((c) => c.id === id)?.name) {
      onChange(updated.name);
    }
    setEditingId(null);
  };

  const handleConfirmDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmId(id);
    setEditingId(null);
    setIsAdding(false);
  };

  const executeDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const catToDelete = categories.find((c) => c.id === id);
    if (!catToDelete) return;

    const wasSelected = value === catToDelete.name;
    storageService.deleteCategory(id, 'Other');
    const remaining = storageService.getCategories();
    setCategories(remaining);
    setDeleteConfirmId(null);

    if (wasSelected) {
      const fallback = remaining.find((c) => c.name === 'Other') || remaining[0];
      if (fallback) {
        onChange(fallback.name);
      }
    }
  };

  return (
    <div className={`relative ${className}`} ref={containerRef} id={id}>
      {/* Dropdown Toggle Button */}
      <button
        type="button"
        id={`${id}-trigger`}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-900 text-sm bg-white flex items-center justify-between text-left transition-colors hover:border-stone-400"
      >
        <span className="flex items-center space-x-2 truncate">
          <span className="text-base shrink-0">{selectedItem.icon}</span>
          <span className="font-semibold text-stone-900 truncate">{selectedItem.name}</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform duration-200 shrink-0 ml-1.5 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          id={`${id}-dropdown`}
          className="absolute z-50 mt-1.5 w-full min-w-[270px] bg-white rounded-xl shadow-xl border border-stone-200 py-1 text-sm animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
        >
          {/* Header with Quick Info and Add Button */}
          <div className="px-3 py-2 border-b border-stone-100 flex items-center justify-between bg-stone-50/80">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Select or Manage Category
            </span>
            {!isAdding && (
              <button
                type="button"
                id={`${id}-header-add-btn`}
                onClick={handleStartAdd}
                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                title="Add a new category"
              >
                <Plus className="w-3 h-3" />
                <span>Add</span>
              </button>
            )}
          </div>

          {/* Inline Add Category Form */}
          {isAdding && (
            <div className="p-3 bg-stone-50 border-b border-stone-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-800 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Create New Category</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="p-1 text-stone-400 hover:text-stone-700 rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Emoji choices */}
              <div className="flex items-center gap-1.5 flex-wrap overflow-x-auto py-1">
                {POPULAR_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setNewCatIcon(emoji)}
                    className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition-all ${
                      newCatIcon === emoji
                        ? 'bg-stone-900 text-white scale-110 shadow-2xs'
                        : 'bg-white hover:bg-stone-200 border border-stone-200'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Input for category name */}
              <div className="flex items-center gap-2">
                <input
                  ref={inputAddRef}
                  type="text"
                  placeholder="Category Name (e.g. Maths, GS)"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveAdd();
                    }
                  }}
                  className="flex-1 px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-stone-900"
                />
                <button
                  type="button"
                  onClick={() => handleSaveAdd()}
                  disabled={!newCatName.trim()}
                  className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 text-white font-bold text-xs rounded-lg transition-colors shrink-0"
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {/* List of Categories */}
          <div className="max-h-56 overflow-y-auto py-1 divide-y divide-stone-100">
            {categories.map((cat) => {
              const isSelected = value === cat.name;
              const isEditing = editingId === cat.id;
              const isConfirmingDelete = deleteConfirmId === cat.id;

              if (isEditing) {
                return (
                  <div key={cat.id} className="p-2.5 bg-amber-50/70 border-y border-amber-200 space-y-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {POPULAR_EMOJIS.slice(0, 8).map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setEditIcon(emoji)}
                          className={`w-6 h-6 rounded text-xs flex items-center justify-center ${
                            editIcon === emoji ? 'bg-amber-700 text-white' : 'bg-white border border-stone-200'
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveEdit(cat.id);
                          }
                        }}
                        className="flex-1 px-2 py-1 bg-white border border-stone-300 rounded-md text-xs font-bold focus:outline-none focus:ring-1 focus:ring-stone-900"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(cat.id)}
                        disabled={!editName.trim()}
                        className="p-1 text-emerald-700 hover:bg-emerald-100 rounded"
                        title="Save Changes"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="p-1 text-stone-400 hover:bg-stone-200 rounded"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              }

              if (isConfirmingDelete) {
                return (
                  <div key={cat.id} className="p-2.5 bg-rose-50 border-y border-rose-200 space-y-1.5">
                    <p className="text-[11px] font-bold text-rose-800 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>Delete "{cat.name}"?</span>
                    </p>
                    <p className="text-[10px] text-rose-600">
                      Associated tasks & habits will be moved to 'Other'.
                    </p>
                    <div className="flex items-center justify-end space-x-1.5 pt-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(null);
                        }}
                        className="px-2 py-1 bg-white border border-stone-200 text-stone-600 rounded text-[11px] font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={(e) => executeDelete(cat.id, e)}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-bold"
                      >
                        Confirm Delete
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={cat.id}
                  onClick={() => handleSelect(cat.name)}
                  className={`group flex items-center justify-between px-3 py-2 cursor-pointer transition-colors ${
                    isSelected ? 'bg-stone-100 font-bold text-stone-900' : 'hover:bg-stone-50 text-stone-700'
                  }`}
                >
                  <div className="flex items-center space-x-2 truncate">
                    <span className="text-base shrink-0">{cat.icon || '🏷️'}</span>
                    <span className="truncate text-xs font-semibold">{cat.name}</span>
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 ml-1 shrink-0" />
                    )}
                  </div>

                  {/* Actions: Edit & Delete buttons */}
                  <div className="flex items-center space-x-1 opacity-70 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => handleStartEdit(cat, e)}
                      className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-200/80 rounded transition-colors"
                      title="Edit Category Name & Emoji"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {categories.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => handleConfirmDelete(cat.id, e)}
                        className="p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-100 rounded transition-colors"
                        title="Delete Category"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom "+ Add New Category" button (exactly requested by user) */}
          {!isAdding && (
            <div className="p-2 border-t border-stone-100 bg-stone-50/50">
              <button
                type="button"
                id={`${id}-bottom-add-btn`}
                onClick={handleStartAdd}
                className="w-full py-2 px-3 border border-dashed border-stone-300 hover:border-stone-400 hover:bg-white text-stone-700 font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-600" />
                <span>+ Add New Category</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
