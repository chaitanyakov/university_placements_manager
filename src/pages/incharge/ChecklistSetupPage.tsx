import React, { useState } from 'react';
import {
  ClearanceCategory,
} from '../../services/placementNoDuesService';
import { PageHeader, FormField } from '../../components/ui/FeedbackComponents';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Drawer } from '../../components/ui/Drawer';
import { useToast } from '../../components/ui/Toast';
import {
  Plus,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Trash2,
} from 'lucide-react';

interface ChecklistSetupPageProps {
  categories: ClearanceCategory[];
  onUpdateCategories: (cats: ClearanceCategory[]) => void;
}

export const ChecklistSetupPage: React.FC<ChecklistSetupPageProps> = ({
  categories,
  onUpdateCategories,
}) => {
  const { showToast } = useToast();
  const [editingCategory, setEditingCategory] = useState<ClearanceCategory | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newMandatory, setNewMandatory] = useState(true);

  // Toggle Mandatory
  const handleToggleMandatory = (id: string) => {
    const updated = categories.map((c) =>
      c.id === id ? { ...c, isMandatory: !c.isMandatory } : c
    );
    onUpdateCategories(updated);
    showToast({
      type: 'info',
      message: 'Mandatory status updated. Student overall clearance recalculated automatically.',
    });
  };

  // Toggle Active
  const handleToggleActive = (id: string) => {
    const updated = categories.map((c) =>
      c.id === id ? { ...c, isActive: !c.isActive } : c
    );
    onUpdateCategories(updated);
    showToast({
      type: 'info',
      message: 'Category active state updated.',
    });
  };

  // Reorder Up
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const items = [...categories];
    const temp = items[index - 1];
    items[index - 1] = items[index];
    items[index] = temp;
    items.forEach((item, i) => (item.order = i + 1));
    onUpdateCategories(items);
  };

  // Reorder Down
  const handleMoveDown = (index: number) => {
    if (index === categories.length - 1) return;
    const items = [...categories];
    const temp = items[index + 1];
    items[index + 1] = items[index];
    items[index] = temp;
    items.forEach((item, i) => (item.order = i + 1));
    onUpdateCategories(items);
  };

  // Save Edit
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    const updated = categories.map((c) =>
      c.id === editingCategory.id ? editingCategory : c
    );
    onUpdateCategories(updated);
    setEditingCategory(null);
    showToast({ type: 'success', message: 'Category updated successfully.' });
  };

  // Add Category
  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const newCat: ClearanceCategory = {
      id: `cat-${Date.now()}`,
      name: newName.trim(),
      description: newDesc.trim() || 'Department clearance verification requirement',
      isMandatory: newMandatory,
      isActive: true,
      order: categories.length + 1,
    };

    onUpdateCategories([...categories, newCat]);
    setIsAddOpen(false);
    setNewName('');
    setNewDesc('');
    showToast({
      type: 'success',
      message: `Added new clearance category: ${newCat.name}`,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="No-Dues Checklist Setup"
        subtitle="Configure clearance sections, mandatory requirements, and evaluation ordering."
        actions={
          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setIsAddOpen(true)}
          >
            Add category
          </Button>
        }
      />

      <div className="p-3 bg-[#FAF8F3] border border-[#E4DFD3] rounded-[6px] text-xs text-[#6B6F6A] flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-[#1F4D3F] shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-[#1C1F1D]">Important System Rule:</span> Changing mandatory categories updates every student's overall status automatically across the portal.
        </div>
      </div>

      {/* Categories List */}
      <Card padding="none" className="overflow-hidden">
        <div className="p-4 border-b border-[#E4DFD3] bg-[#FCFBF8] flex items-center justify-between">
          <h3 className="font-serif text-sm font-medium text-[#1C1F1D]">
            Clearance Categories ({categories.length})
          </h3>
          <span className="text-xs text-[#6B6F6A]">
            {categories.filter((c) => c.isMandatory).length} Mandatory ·{' '}
            {categories.filter((c) => c.isActive).length} Active
          </span>
        </div>

        <div className="divide-y divide-[#E4DFD3]">
          {categories.map((cat, index) => (
            <div
              key={cat.id}
              className="p-4 hover:bg-[#FAF8F3] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3">
                {/* Reorder controls */}
                <div className="flex flex-col gap-1 shrink-0 mt-0.5">
                  <button
                    disabled={index === 0}
                    onClick={() => handleMoveUp(index)}
                    className="p-1 text-[#6B6F6A] hover:text-[#1C1F1D] disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                    title="Move up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    disabled={index === categories.length - 1}
                    onClick={() => handleMoveDown(index)}
                    className="p-1 text-[#6B6F6A] hover:text-[#1C1F1D] disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                    title="Move down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#1C1F1D]">
                      {cat.name}
                    </span>
                    {cat.isMandatory ? (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#1F4D3F] bg-[#EAF3ED] px-1.5 py-0.2 rounded">
                        Mandatory
                      </span>
                    ) : (
                      <span className="text-[10px] text-[#6B6F6A] bg-[#F0EEE9] px-1.5 py-0.2 rounded">
                        Optional / As Applicable
                      </span>
                    )}
                    {!cat.isActive && (
                      <span className="text-[10px] text-[#9E2A2B] bg-[#FCECEE] px-1.5 py-0.2 rounded">
                        Inactive
                      </span>
                    )}
                  </div>
                  {cat.description && (
                    <p className="text-xs text-[#6B6F6A] mt-1">{cat.description}</p>
                  )}
                </div>
              </div>

              {/* Toggles & Edit button */}
              <div className="flex items-center gap-4 shrink-0 text-xs">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={cat.isMandatory}
                    onChange={() => handleToggleMandatory(cat.id)}
                    className="rounded text-[#1F4D3F]"
                  />
                  <span className="text-[#1C1F1D] font-medium">Mandatory</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={cat.isActive}
                    onChange={() => handleToggleActive(cat.id)}
                    className="rounded text-[#1F4D3F]"
                  />
                  <span className="text-[#1C1F1D] font-medium">Active</span>
                </label>

                <button
                  onClick={() => setEditingCategory({ ...cat })}
                  className="p-1.5 text-[#6B6F6A] hover:text-[#1F4D3F] transition-colors cursor-pointer"
                  title="Edit category"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Edit Category Drawer */}
      {editingCategory && (
        <Drawer
          isOpen={!!editingCategory}
          onClose={() => setEditingCategory(null)}
          title="Edit Clearance Category"
          subtitle={editingCategory.name}
          width="md"
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setEditingCategory(null)}
              >
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSaveEdit}>
                Save Changes
              </Button>
            </div>
          }
        >
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <FormField label="Category Name" required>
              <input
                type="text"
                required
                value={editingCategory.name}
                onChange={(e) =>
                  setEditingCategory({ ...editingCategory, name: e.target.value })
                }
                className="h-9 px-3 text-xs bg-white border border-[#E4DFD3] rounded focus:border-[#1F4D3F]"
              />
            </FormField>

            <FormField label="Description">
              <textarea
                rows={3}
                value={editingCategory.description || ''}
                onChange={(e) =>
                  setEditingCategory({ ...editingCategory, description: e.target.value })
                }
                className="p-2 text-xs bg-white border border-[#E4DFD3] rounded focus:border-[#1F4D3F]"
              />
            </FormField>

            <div className="pt-2 flex flex-col gap-2">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingCategory.isMandatory}
                  onChange={(e) =>
                    setEditingCategory({ ...editingCategory, isMandatory: e.target.checked })
                  }
                  className="rounded text-[#1F4D3F]"
                />
                <span className="font-medium text-[#1C1F1D]">Mandatory for Graduation Clearance</span>
              </label>

              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingCategory.isActive}
                  onChange={(e) =>
                    setEditingCategory({ ...editingCategory, isActive: e.target.checked })
                  }
                  className="rounded text-[#1F4D3F]"
                />
                <span className="font-medium text-[#1C1F1D]">Category Currently Active</span>
              </label>
            </div>
          </form>
        </Drawer>
      )}

      {/* Add Category Drawer */}
      {isAddOpen && (
        <Drawer
          isOpen={isAddOpen}
          onClose={() => setIsAddOpen(false)}
          title="Add Clearance Category"
          subtitle="Define a new department verification requirement."
          width="md"
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsAddOpen(false)}
              >
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleAddCategory}>
                Create Category
              </Button>
            </div>
          }
        >
          <form onSubmit={handleAddCategory} className="space-y-4">
            <FormField label="Category Name" required>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Sports Equipment & Gymnasium"
                className="h-9 px-3 text-xs bg-white border border-[#E4DFD3] rounded focus:border-[#1F4D3F]"
              />
            </FormField>

            <FormField label="Description">
              <textarea
                rows={3}
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Details of books, lockers, lab tools, or fees..."
                className="p-2 text-xs bg-white border border-[#E4DFD3] rounded focus:border-[#1F4D3F]"
              />
            </FormField>

            <label className="flex items-center gap-2 text-xs cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={newMandatory}
                onChange={(e) => setNewMandatory(e.target.checked)}
                className="rounded text-[#1F4D3F]"
              />
              <span className="font-medium text-[#1C1F1D]">Mandatory for Graduation Clearance</span>
            </label>
          </form>
        </Drawer>
      )}
    </div>
  );
};
