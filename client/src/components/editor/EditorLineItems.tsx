import React from 'react';
import { DocumentItemsTable, type LineItem } from '../DocumentItemsTable';

interface EditorLineItemsProps {
  items: LineItem[];
  handleItemChange: (id: string, field: keyof LineItem, value: string | number) => void;
  handleRemoveItem: (id: string) => void;
  handleAddItem: () => void;
}

export const EditorLineItems: React.FC<EditorLineItemsProps> = ({
  items,
  handleItemChange,
  handleRemoveItem,
  handleAddItem,
}) => {
  return (
    <div className="space-y-6">
      <DocumentItemsTable
        items={items}
        onItemChange={handleItemChange}
        onRemoveItem={handleRemoveItem}
        onAddItem={handleAddItem}
      />
    </div>
  );
};
