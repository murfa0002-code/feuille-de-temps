
import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { TodoItem, TimesheetData } from '../types';
import { DAYS_OF_WEEK } from '../constants';
import TrashIcon from './icons/TrashIcon';

interface TodoListPageProps {
    todoList: TodoItem[];
    onUpdateTodoList: (newTodoList: TodoItem[]) => void;
    isReadOnly: boolean;
    listStatus: 'draft' | 'submitted' | 'approved';
    onStatusChange?: (newStatus: 'draft' | 'submitted' | 'approved') => void;
    userRole?: 'admin' | 'employee';
}

const TodoListPage: React.FC<TodoListPageProps> = ({ 
    todoList, 
    onUpdateTodoList, 
    isReadOnly, 
    listStatus,
    onStatusChange,
    userRole 
}) => {
    // State to hold input values for each day independently
    const [newTasksByDay, setNewTasksByDay] = useState<{ [key: number]: string }>({});

    const handleInputChange = (dayIndex: number, value: string) => {
        setNewTasksByDay(prev => ({ ...prev, [dayIndex]: value }));
    };

    const handleAddItem = (e: React.FormEvent, dayIndex: number) => {
        e.preventDefault();
        const text = newTasksByDay[dayIndex];
        if (!text || !text.trim()) return;

        const newItem: TodoItem = {
            id: uuidv4(),
            text: text.trim(),
            completed: false,
            dayIndex: dayIndex,
            updated_at: new Date().toISOString()
        };

        onUpdateTodoList([...todoList, newItem]);
        setNewTasksByDay(prev => ({ ...prev, [dayIndex]: '' }));
    };

    const handleToggleItem = (id: string) => {
        if (isReadOnly) return;
        const updatedList = todoList.map(item => 
            item.id === id ? { ...item, completed: !item.completed, updated_at: new Date().toISOString() } : item
        );
        onUpdateTodoList(updatedList);
    };

    const handleDeleteItem = (id: string) => {
        if (isReadOnly) return;
        const updatedList = todoList.filter(item => item.id !== id);
        onUpdateTodoList(updatedList);
    };

    const totalTasks = todoList.length;
    const completedTasks = todoList.filter(t => t.completed).length;
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const getStatusBadge = () => {
        switch (listStatus) {
            case 'submitted':
                return <span className="px-2 py-1 text-xs font-semibold text-yellow-800 bg-yellow-200 rounded-full">En attente</span>;
            case 'approved':
                return <span className="px-2 py-1 text-xs font-semibold text-green-800 bg-green-200 rounded-full">Validée</span>;
            case 'draft':
            default:
                return <span className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-200 rounded-full">Brouillon</span>;
        }
    };

    const getActionButtons = () => {
        if (!onStatusChange || !userRole) return null;

        if (userRole === 'admin') {
             if (listStatus === 'submitted') {
                return (
                    <button 
                        onClick={() => onStatusChange('approved')} 
                        className="px-3 py-1.5 text-sm font-semibold text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                        Approuver les objectifs
                    </button>
                );
            }
            if (listStatus === 'approved') {
                return (
                    <button 
                        onClick={() => onStatusChange('draft')} 
                        className="px-3 py-1.5 text-sm font-semibold text-gray-800 bg-yellow-400 rounded-md hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400"
                    >
                        Dévalider les objectifs
                    </button>
                );
            }
        } else { // Employee view
             if (listStatus === 'draft') {
                return (
                    <button 
                        onClick={() => onStatusChange('submitted')}
                        className="px-3 py-1.5 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        Soumettre les objectifs
                    </button>
                );
            }
        }
        return null;
    }

    return (
        <section aria-labelledby="todo-title" className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                <div>
                     <div className="flex items-center gap-3">
                        <h2 id="todo-title" className="text-2xl font-bold text-gray-800">
                            Planning Hebdomadaire & Objectifs
                        </h2>
                        <span className="text-sm font-semibold text-gray-600">Statut (Objectifs) :</span>
                        {getStatusBadge()}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">Détaillez vos tâches jour par jour.</p>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-4">
                    {getActionButtons()}

                    <div className="flex items-center gap-4 bg-white p-3 rounded-lg shadow-sm border border-gray-200">
                        <div className="text-right">
                            <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Avancement Global</span>
                            <span className="block text-lg font-bold text-cyan-700">{completedTasks} / {totalTasks} tâches</span>
                        </div>
                        <div className="relative w-16 h-16">
                            <svg className="w-full h-full" viewBox="0 0 36 36">
                                <path
                                    className="text-gray-200"
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                />
                                <path
                                    className="text-cyan-600 transition-all duration-1000 ease-out"
                                    strokeDasharray={`${progress}, 100`}
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700">
                                {progress}%
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Information Banner */}
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6 rounded-md">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <p className="text-sm text-blue-700">
                            Renseignez les objectifs spécifiques pour chaque jour. Cette liste est liée à votre feuille de temps et sera validée par l'administrateur.
                        </p>
                    </div>
                </div>
            </div>

            {/* Daily Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {DAYS_OF_WEEK.map((dayName, index) => {
                    // Filter tasks for this specific day
                    const dayTasks = todoList.filter(t => (t.dayIndex !== undefined ? t.dayIndex === index : index === 0));
                    
                    return (
                        <div key={dayName} className="bg-white rounded-lg shadow-md border border-gray-200 flex flex-col h-full">
                            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg flex justify-between items-center">
                                <h3 className="font-bold text-gray-700">{dayName}</h3>
                                <span className="bg-gray-200 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">
                                    {dayTasks.filter(t => t.completed).length}/{dayTasks.length}
                                </span>
                            </div>
                            
                            <div className="p-4 flex-1 flex flex-col">
                                <ul className="space-y-3 flex-1 mb-4">
                                    {dayTasks.length === 0 && (
                                        <li className="text-center text-sm text-gray-400 py-4 italic">
                                            Aucune tâche
                                        </li>
                                    )}
                                    {dayTasks.map((item) => (
                                        <li key={item.id} className="group flex items-start gap-2">
                                            <div className="flex items-center h-5 mt-0.5">
                                                <input
                                                    id={`todo-${item.id}`}
                                                    type="checkbox"
                                                    checked={item.completed}
                                                    onChange={() => handleToggleItem(item.id)}
                                                    disabled={isReadOnly}
                                                    className="focus:ring-cyan-500 h-4 w-4 text-cyan-600 border-gray-300 rounded cursor-pointer disabled:cursor-not-allowed"
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <label 
                                                    htmlFor={`todo-${item.id}`} 
                                                    className={`block text-sm leading-tight cursor-pointer select-none break-words ${item.completed ? 'text-gray-400 line-through' : 'text-gray-800'}`}
                                                >
                                                    {item.text}
                                                </label>
                                            </div>
                                            {!isReadOnly && (
                                                <button
                                                    onClick={() => handleDeleteItem(item.id)}
                                                    className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Supprimer"
                                                >
                                                    <TrashIcon className="h-4 w-4" />
                                                </button>
                                            )}
                                        </li>
                                    ))}
                                </ul>

                                {/* Add Input per Day */}
                                {!isReadOnly && (
                                    <form onSubmit={(e) => handleAddItem(e, index)} className="mt-auto pt-2 border-t border-gray-100">
                                        <div className="flex rounded-md shadow-sm">
                                            <input
                                                type="text"
                                                value={newTasksByDay[index] || ''}
                                                onChange={(e) => handleInputChange(index, e.target.value)}
                                                placeholder="Ajouter..."
                                                className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-l-md text-sm border-gray-300 focus:ring-cyan-500 focus:border-cyan-500 border"
                                            />
                                            <button
                                                type="submit"
                                                disabled={!newTasksByDay[index]?.trim()}
                                                className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 rounded-r-md bg-cyan-50 text-cyan-700 hover:bg-cyan-100 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
};

export default TodoListPage;
