'use client';

import React, { useState } from 'react';
// @ts-ignore
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from 'react-beautiful-dnd';
import { Trash2, Plus } from 'lucide-react';

export interface FormField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'select' | 'checkbox';
  required: boolean;
  placeholder?: string;
  options?: string[];
}

const DEFAULT_FIELDS: FormField[] = [
  { id: 'name', name: 'name', label: '이름', type: 'text', required: true, placeholder: '이름을 입력하세요' },
  { id: 'phone', name: 'phone', label: '전화번호', type: 'tel', required: true, placeholder: '010-0000-0000' },
  { id: 'email', name: 'email', label: '이메일', type: 'email', required: false, placeholder: 'example@email.com' },
];

const AVAILABLE_FIELDS: FormField[] = [
  { id: 'gender', name: 'gender', label: '성별', type: 'select', required: false, options: ['남성', '여성'] },
  { id: 'birthDate', name: 'birthDate', label: '생년월일', type: 'text', required: false, placeholder: '1990-01-01' },
  { id: 'address', name: 'address', label: '주소', type: 'text', required: false, placeholder: '주소를 입력하세요' },
  { id: 'marketingConsent', name: 'marketingConsent', label: '마케팅 동의', type: 'checkbox', required: false },
];

interface FormBuilderProps {
  onChange?: (fields: FormField[]) => void;
  initialFields?: FormField[];
}

export default function FormBuilder({ onChange, initialFields }: FormBuilderProps) {
  const [fields, setFields] = useState<FormField[]>(initialFields || DEFAULT_FIELDS);
  const [customInput, setCustomInput] = useState('');

  const handleDragEnd = (result: any) => {
    const { source, destination } = result;
    if (!destination) return;

    const newFields = Array.from(fields);
    const [removed] = newFields.splice(source.index, 1);
    newFields.splice(destination.index, 0, removed);

    setFields(newFields);
    onChange?.(newFields);
  };

  const toggleRequired = (id: string) => {
    const newFields = fields.map(f =>
      f.id === id ? { ...f, required: !f.required } : f
    );
    setFields(newFields);
    onChange?.(newFields);
  };

  const removeField = (id: string) => {
    if (id === 'name' || id === 'phone') {
      alert('이름과 전화번호는 필수 필드입니다');
      return;
    }
    const newFields = fields.filter(f => f.id !== id);
    setFields(newFields);
    onChange?.(newFields);
  };

  const addFieldFromAvailable = (field: FormField) => {
    if (fields.find(f => f.id === field.id)) {
      alert('이미 추가된 필드입니다');
      return;
    }
    const newFields = [...fields, field];
    setFields(newFields);
    onChange?.(newFields);
  };

  const addCustomField = () => {
    if (!customInput.trim()) {
      alert('필드 이름을 입력하세요');
      return;
    }
    const id = `custom_${Date.now()}`;
    const newField: FormField = {
      id,
      name: customInput.toLowerCase().replace(/\s+/g, '_'),
      label: customInput,
      type: 'text',
      required: false,
    };
    const newFields = [...fields, newField];
    setFields(newFields);
    setCustomInput('');
    onChange?.(newFields);
  };

  return (
    <div className="space-y-6 p-4 bg-gray-50 rounded-lg">
      {/* 드래그 가능한 필드 목록 */}
      <div>
        <h3 className="text-sm font-bold mb-3">📋 폼 필드 (드래그로 순서 변경)</h3>
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="form-fields">
            {(provided, snapshot) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className={`space-y-2 p-3 rounded border-2 transition ${
                  snapshot.isDraggingOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'
                }`}
              >
                {fields.map((field, index) => (
                  <Draggable key={field.id} draggableId={field.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={`p-3 bg-white rounded border transition ${
                          snapshot.isDragging ? 'shadow-lg border-blue-400' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{field.label}</p>
                            <p className="text-sm text-gray-500">{field.type}</p>
                          </div>
                          <div className="flex gap-2 items-center">
                            {field.id !== 'name' && field.id !== 'phone' && (
                              <label className="flex items-center gap-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={field.required}
                                  onChange={() => toggleRequired(field.id)}
                                  className="w-4 h-4"
                                />
                                <span className="text-sm text-gray-600">필수</span>
                              </label>
                            )}
                            {field.required && (field.id === 'name' || field.id === 'phone') && (
                              <span className="text-sm bg-red-100 text-red-700 px-2 py-1 rounded">필수</span>
                            )}
                            {field.id !== 'name' && field.id !== 'phone' && (
                              <button
                                onClick={() => removeField(field.id)}
                                className="p-1 hover:bg-red-100 rounded text-red-600"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>

      {/* 추가 가능한 필드 */}
      <div>
        <h3 className="text-sm font-bold mb-3">➕ 필드 추가</h3>
        <div className="space-y-2">
          {AVAILABLE_FIELDS.filter(af => !fields.find(f => f.id === af.id)).map(field => (
            <button
              key={field.id}
              onClick={() => addFieldFromAvailable(field)}
              className="w-full text-left p-3 bg-white border border-gray-200 rounded hover:bg-blue-50 transition text-sm"
            >
              <div className="flex items-center gap-2">
                <Plus size={16} className="text-blue-600" />
                <span>{field.label}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 커스텀 필드 추가 */}
      <div>
        <h3 className="text-sm font-bold mb-3">✏️ 커스텀 필드</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addCustomField()}
            placeholder="필드명 입력 (예: 직급, 부서)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={addCustomField}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition"
          >
            추가
          </button>
        </div>
      </div>

      {/* 미리보기 */}
      <div>
        <h3 className="text-sm font-bold mb-3">👁️ HTML 미리보기</h3>
        <pre className="bg-gray-900 text-green-400 p-3 rounded text-sm overflow-x-auto">
          {`<form method="POST">\n${fields
            .map(f => `  <input type="${f.type}" name="${f.name}" placeholder="${f.placeholder || f.label}" ${f.required ? 'required' : ''} />`)
            .join('\n')}\n  <button type="submit">제출</button>\n</form>`}
        </pre>
      </div>
    </div>
  );
}
