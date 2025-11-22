
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { TimesheetData, Task, TaskCategory, AppView, Profile, ChargeableTask, TodoItem } from './types';
import { INITIAL_NON_CHARGEABLE_TASKS, NORMAL_HOURS, DAYS_OF_WEEK } from './constants';
import Header from './components/Header';
import Timesheet from './components/Timesheet';
import NavBar from './components/NavBar';
import AnalysisPage from './components/AnalysisPage';
import DetailedAnalysisPage from './components/DetailedAnalysisPage';
import TodoListPage from './components/TodoListPage';
import Modal from './components/Modal';
import LoginPage from './components/LoginPage';
import AdminTaskManagementPage from './components/AdminTaskManagementPage';
import SchemaMigrationPage from './components/SchemaMigrationPage';
import { exportTimesheetToCSV, exportAnalysisToCSV, exportAdminAnalysisToCSV, exportDetailedAnalysisToCSV } from './utils/export';
import { supabase } from './utils/supabaseClient';
import { Session, User } from '@supabase/supabase-js';

// Helper to create a new blank timesheet
const createNewTimesheet = (employeeId: string): Omit<TimesheetData, 'id' | 'created_at' | 'updated_at'> => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (startDate.getDay() + 6) % 7);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);

  return {
    employee_id: employeeId,
    period_number: '',
    start_date: startDate.toISOString().split('T')[0],
    end_date: endDate.toISOString().split('T')[0],
    tasks: [...INITIAL_NON_CHARGEABLE_TASKS.map(task => ({...task, id: uuidv4(), hours: Array(6).fill(0)}))],
    todo_list: [], // Initialize empty to-do list
    todo_status: 'draft',
    normal_hours: NORMAL_HOURS,
    status: 'draft',
  };
};

/**
 * Safely converts any error object/value into a human-readable string.
 * This function is designed to prevent "[object Object]" errors by carefully inspecting
 * the error structure before attempting to stringify it.
 */
const getErrorMessage = (error: unknown): string => {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  try {
    const getCircularReplacer = () => {
      const seen = new WeakSet();
      return (key: string, value: any) => {
        if (typeof value === "object" && value !== null) {
          if (seen.has(value)) return "[Circular Reference]";
          seen.add(value);
        }
        return value;
      };
    };
    return JSON.stringify(error, getCircularReplacer(), 2);
  } catch {
    return 'Une erreur inattendue et non-sérialisable est survenue.';
  }
};

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
  const [view, setView] = useState<AppView>('timesheet');
  
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [allTimesheets, setAllTimesheets] = useState<TimesheetData[]>([]);
  const [availableChargeableTasks, setAvailableChargeableTasks] = useState<string[]>([]);
  const [pendingTasks, setPendingTasks] = useState<ChargeableTask[]>([]);

  const [currentEmployeeId, setCurrentEmployeeId] = useState<string>('');
  const [currentTimesheetId, setCurrentTimesheetId] = useState<string>('');
  const [modal, setModal] = useState<{type: 'newTask' | null, isOpen: boolean}>({ type: null, isOpen: false });
  const [isLoading, setIsLoading] = useState(true);
  const [schemaError, setSchemaError] = useState<any | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        setCurrentUserProfile(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    setCurrentUserProfile(null);
    setCurrentEmployeeId('');
    setCurrentTimesheetId('');
    setAllTimesheets([]);
    setEmployees([]);
  }, []);

  const handleCreateNewWeek = useCallback(async (employeeId: string, setCurrent: boolean = false) => {
    if (!employeeId) return;
    const newTsData = createNewTimesheet(employeeId);
    const { data, error } = await supabase.from('timesheets').insert([newTsData]).select().single();
    
    if (error) {
        console.error("Failed to create new week:", error);
        
        const errorStr = JSON.stringify(error);
        const isTodoListError = 
            (error.message && (error.message.includes('todo_list') || error.message.includes('todo_status'))) ||
            (error.details && (error.details.includes('todo_list') || error.details.includes('todo_status'))) ||
            errorStr.includes('todo_list') || errorStr.includes('todo_status');

        if (error.code === '42703' || isTodoListError) {
            setSchemaError({ code: 'MISSING_TODO_LIST', message: 'Columns todo_list or todo_status missing' });
        } else {
            const errMsg = getErrorMessage(error);
            alert(`Erreur lors de la création de la semaine: ${errMsg}`);
        }
        return;
    }

    if (data) {
        setAllTimesheets(prev => [...prev, data]);
        if (setCurrent) {
            setCurrentTimesheetId(data.id);
        }
        return data;
    }
  }, []);
  
  const fetchPendingTasks = useCallback(async () => {
    if (currentUserProfile?.role !== 'admin') return;
    try {
        const { data: pending, error: pendingError } = await supabase.from('chargeable_tasks').select('*').eq('status', 'pending');
        if (pendingError) throw pendingError;

        if (pending && pending.length > 0) {
            const proposerIds = [...new Set(pending.map(t => t.proposed_by).filter(Boolean))];
            if (proposerIds.length > 0) {
                const { data: proposers, error: profilesError } = await supabase
                    .from('profiles')
                    .select('id, name')
                    .in('id', proposerIds);

                if (profilesError) throw profilesError;

                const proposerMap = new Map(proposers.map(p => [p.id, p.name]));
                const tasksWithProposers = pending.map(task => ({
                    ...task,
                    profiles: { name: proposerMap.get(task.proposed_by) || 'Inconnu' }
                }));
                setPendingTasks(tasksWithProposers);
            } else {
                setPendingTasks(pending.map(p => ({...p, profiles: {name: 'Inconnu'}})));
            }
        } else {
            setPendingTasks([]);
        }
    } catch (error: any) {
        console.error("Failed to refresh pending tasks:", error);
        alert(`Erreur lors de l'actualisation des tâches en attente: ${error.message || 'Voir la console pour les détails.'}`);
    }
  }, [currentUserProfile]);

  const fetchAppData = useCallback(async (user: User) => {
    setIsLoading(true);
    setSchemaError(null);

    try {
        const { data: profile, error: profileError } = await supabase
            .from('profiles').select('*').eq('id', user.id).single();

        if (profileError || !profile) {
            console.error("Error fetching user profile:", profileError);
            sessionStorage.setItem('loginError', `Erreur de récupération de profil: ${profileError?.message || 'Profil introuvable.'}`);
            throw profileError || new Error("Profil introuvable.");
        }
        setCurrentUserProfile(profile);

        const { data: tasksData, error: tasksError } = await supabase.from('chargeable_tasks').select('name').eq('status', 'approved');
        if (tasksError) throw tasksError;
        setAvailableChargeableTasks(tasksData.map(t => t.name).sort());

        if (profile.role === 'admin') {
            const { data: allProfiles, error: profilesError } = await supabase.from('profiles').select('*');
            if (profilesError) throw profilesError;
            setEmployees(allProfiles || []);

            const { data: allSheets, error: sheetsError } = await supabase.from('timesheets').select('*');
            if (sheetsError) throw sheetsError;
            setAllTimesheets(allSheets || []);
            
            try {
                const { data: pending, error: pendingError } = await supabase.from('chargeable_tasks').select('*').eq('status', 'pending');
                if (pendingError) throw pendingError;
                
                if (pending && pending.length > 0) {
                    const proposerIds = [...new Set(pending.map(t => t.proposed_by).filter(Boolean))];
                    if (proposerIds.length > 0) {
                        const { data: proposers, error: profilesError } = await supabase
                            .from('profiles')
                            .select('id, name')
                            .in('id', proposerIds);
                        
                        if (profilesError) throw profilesError;

                        const proposerMap = new Map(proposers.map(p => [p.id, p.name]));
                        const tasksWithProposers = pending.map(task => ({
                            ...task,
                            profiles: { name: proposerMap.get(task.proposed_by) || 'Inconnu' }
                        }));
                        setPendingTasks(tasksWithProposers);
                    } else {
                         setPendingTasks(pending.map(p => ({...p, profiles: {name: 'Inconnu'}})));
                    }
                } else {
                    setPendingTasks([]);
                }
            } catch (error: any) {
                console.error("Failed to refresh pending tasks:", error);
            }
            
            setCurrentEmployeeId(profile.id);
            const adminTimesheets = (allSheets || []).filter(ts => ts.employee_id === profile.id);
            if (adminTimesheets.length > 0) {
                setCurrentTimesheetId(adminTimesheets.sort((a,b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())[0].id);
            } else {
                await handleCreateNewWeek(profile.id, true);
            }
        } else { // Employee role
            setEmployees([profile]);
            const { data: userSheets, error: sheetsError } = await supabase.from('timesheets').select('*').eq('employee_id', user.id);
            if (sheetsError) throw sheetsError;
            setAllTimesheets(userSheets || []);
            setCurrentEmployeeId(user.id);
            if (userSheets && userSheets.length > 0) {
                setCurrentTimesheetId(userSheets.sort((a,b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())[0].id);
            } else {
                await handleCreateNewWeek(user.id, true);
            }
        }
    } catch (error: any) {
        console.error("Error during app data fetch:", error);
        const errorMessage = getErrorMessage(error);
        
        const isSchemaRelatedError = 
            error.code === '42703' || // undefined_column
            errorMessage.includes("column") || 
            errorMessage.includes("does not exist") ||
            (error.code === 'PGRST200' && errorMessage.includes("Could not find a relationship"));

        if (isSchemaRelatedError){
             if (errorMessage.includes('schema cache')) {
                setSchemaError({ code: 'SCHEMA_CACHE_ERROR', message: errorMessage });
            } else if (errorMessage.includes('column "status"')) {
                setSchemaError({ ...error, code: 'STATUS_COLUMN_MISSING' });
            } else if (errorMessage.includes('todo_list') || errorMessage.includes('todo_status')) {
                setSchemaError({ code: 'MISSING_TODO_LIST', message: errorMessage });
            } else {
                setSchemaError(error);
            }
        } else {
            handleLogout();
        }
    } finally {
        setIsLoading(false);
    }
  }, [handleLogout, handleCreateNewWeek]);

  useEffect(() => {
    if (session?.user) {
      fetchAppData(session.user);
    }
  }, [session?.user?.id]);


  const updateCurrentTimesheet = useCallback(async (updater: (timesheet: TimesheetData) => TimesheetData) => {
    const originalTimesheet = allTimesheets.find(ts => ts.id === currentTimesheetId);
    if (!originalTimesheet) return;

    const updatedTimesheet = updater(originalTimesheet);
    setAllTimesheets(prev => prev.map(ts => ts.id === currentTimesheetId ? updatedTimesheet : ts));
    
    const payload: any = { 
        tasks: updatedTimesheet.tasks, 
        period_number: updatedTimesheet.period_number,
        start_date: updatedTimesheet.start_date,
        end_date: updatedTimesheet.end_date,
        status: updatedTimesheet.status,
        updated_at: new Date().toISOString()
    };
    
    if (updatedTimesheet.todo_list) {
        payload.todo_list = updatedTimesheet.todo_list;
    }
    if (updatedTimesheet.todo_status) {
        payload.todo_status = updatedTimesheet.todo_status;
    }

    const { error } = await supabase
        .from('timesheets')
        .update(payload)
        .eq('id', currentTimesheetId);
        
    if (error) {
        console.error("Failed to update timesheet:", error);
        setAllTimesheets(prev => prev.map(ts => ts.id === currentTimesheetId ? originalTimesheet : ts));
        
        const errorStr = JSON.stringify(error);
        const isTodoListError = 
            (error.message && (error.message.includes('todo_list') || error.message.includes('todo_status'))) ||
            errorStr.includes('todo_list') || errorStr.includes('todo_status');

        if (error.code === '42703' || isTodoListError) {
             setSchemaError({ code: 'MISSING_TODO_LIST', message: 'Column todo_list or todo_status missing' });
        } else {
             const errMsg = getErrorMessage(error);
             alert(`Erreur lors de la sauvegarde: ${errMsg}. Veuillez réessayer.`);
        }
    }
  }, [currentTimesheetId, allTimesheets]);
  
  // Status change for the Timesheet (Hours)
  const handleTimesheetStatusChange = useCallback(async (newStatus: TimesheetData['status']) => {
    if (!currentTimesheetId) return;

    const originalTimesheet = allTimesheets.find(ts => ts.id === currentTimesheetId);
    if (!originalTimesheet) return;

    const updatedTimesheet = { ...originalTimesheet, status: newStatus, updated_at: new Date().toISOString() };
    setAllTimesheets(prev => prev.map(ts => ts.id === currentTimesheetId ? updatedTimesheet : ts));

    try {
        const { error } = await supabase
          .from('timesheets')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', currentTimesheetId);
        
        if (error) throw error; 

    } catch (error: unknown) {
        const errorMessage = getErrorMessage(error);
        console.error("Failed to update timesheet status:", errorMessage);

        setAllTimesheets(prev => prev.map(ts => ts.id === currentTimesheetId ? originalTimesheet : ts));
        
        if (errorMessage.includes('schema cache')) {
            setSchemaError({ code: 'SCHEMA_CACHE_ERROR', message: errorMessage });
            return;
        }
        
        const isRLSError = errorMessage.includes('security policy') && errorMessage.includes('timesheets');
        const isMissingFunctionError = errorMessage.includes('function is_admin() does not exist');
        
        if (isRLSError || isMissingFunctionError) {
            setSchemaError({ code: 'TIMESHEET_RLS_MISSING', message: errorMessage });
            return;
        }
        
        alert(`Erreur lors du changement de statut :\n\n${errorMessage}\n\nVeuillez réessayer.`);
    }
}, [currentTimesheetId, allTimesheets]);

 // Status change for the Todo List - STRICTLY SEPARATED from Timesheet Status
 const handleTodoStatusChange = useCallback(async (newStatus: TimesheetData['todo_status']) => {
    if (!currentTimesheetId) return;

    const originalTimesheet = allTimesheets.find(ts => ts.id === currentTimesheetId);
    if (!originalTimesheet) return;

    // Only update todo_status, do NOT touch 'status'
    const updatedTimesheet = { ...originalTimesheet, todo_status: newStatus, updated_at: new Date().toISOString() };
    setAllTimesheets(prev => prev.map(ts => ts.id === currentTimesheetId ? updatedTimesheet : ts));

    try {
        const { error } = await supabase
          .from('timesheets')
          .update({ todo_status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', currentTimesheetId);
        
        if (error) throw error;

    } catch (error: unknown) {
        const errorMessage = getErrorMessage(error);
        console.error("Failed to update todo status:", errorMessage);
        
        setAllTimesheets(prev => prev.map(ts => ts.id === currentTimesheetId ? originalTimesheet : ts));

        // Check for missing column error specifically for todo_status
        if (errorMessage.includes('todo_status') || errorMessage.includes('column "todo_status" of relation "timesheets" does not exist')) {
             setSchemaError({ code: 'MISSING_TODO_LIST', message: 'Column todo_status missing' });
             return;
        }

        alert(`Erreur lors du changement de statut de la liste:\n\n${errorMessage}`);
    }
 }, [currentTimesheetId, allTimesheets]);

  const handleTaskHoursChange = (taskId: string, dayIndex: number, hours: number) => {
    updateCurrentTimesheet(ts => ({
      ...ts,
      tasks: ts.tasks.map(task => 
        task.id === taskId ? { ...task, hours: task.hours.map((h, i) => i === dayIndex ? hours : h) } : task
      ),
    }));
  };
  
  const handleHeaderChange = (field: keyof TimesheetData, value: string) => {
    updateCurrentTimesheet(ts => ({ ...ts, [field]: value }));
  };

  const handleUpdateTodoList = (newTodoList: TodoItem[]) => {
    updateCurrentTimesheet(ts => ({ ...ts, todo_list: newTodoList }));
  };

  const handleSaveNewTask = async (taskName: string) => {
    if (!taskName || !currentUserProfile) return;
    
    const { data: existing, error: checkError } = await supabase.from('chargeable_tasks').select('name').eq('name', taskName);
    if (checkError) {
      alert(`Erreur lors de la vérification de la tâche : ${checkError.message}`);
      return;
    }
    if (existing && existing.length > 0) {
      alert(`La tâche "${taskName}" existe déjà ou est en attente de validation.`);
      return;
    }

    const { error } = await supabase.from('chargeable_tasks').insert({ 
      name: taskName, 
      status: 'pending',
      proposed_by: currentUserProfile.id
    });

    if (error) {
        console.error("Error submitting new task:", error);
        alert(`Une erreur est survenue lors de la soumission de la tâche : ${error.message}`);
        return;
    }
    
    if (currentUserProfile.role === 'admin') {
      await fetchPendingTasks();
    }

    alert(`La tâche "${taskName}" a été soumise pour approbation.`);
    setModal({ type: null, isOpen: false });
  };
  
  const handleAddTaskToSheet = (taskName: string) => {
     updateCurrentTimesheet(ts => ({
        ...ts,
        tasks: [
            ...ts.tasks,
            { id: uuidv4(), name: taskName, category: TaskCategory.CHARGEABLE, hours: Array(6).fill(0) },
        ],
    }));
    setModal({ type: null, isOpen: false });
  }

  const handleRemoveTask = (taskId: string) => {
    updateCurrentTimesheet(ts => ({ ...ts, tasks: ts.tasks.filter(task => task.id !== taskId) }));
  };

  const handleTaskSelectionChange = (taskId: string, newName: string) => {
    updateCurrentTimesheet(ts => ({ ...ts, tasks: ts.tasks.map(task => task.id === taskId ? { ...task, name: newName } : task) }));
  };
  
  const handleEmployeeChange = (employeeId: string) => {
    if (currentUserProfile?.role !== 'admin') return;
    setCurrentEmployeeId(employeeId);
    const employeeTimesheets = allTimesheets.filter(ts => ts.employee_id === employeeId);
    if (employeeTimesheets.length > 0) {
      setCurrentTimesheetId(employeeTimesheets.sort((a,b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())[0].id);
    } else {
      handleCreateNewWeek(employeeId, true);
    }
  };

  const handleApproveTask = async (task: ChargeableTask) => {
    setPendingTasks(prev => prev.filter(t => t.id !== task.id));
    const { error } = await supabase.from('chargeable_tasks').update({ status: 'approved' }).eq('id', task.id);
    if (error) {
      console.error("Error approving task:", error);
      alert(`Erreur lors'approbation: ${error.message}`);
      setPendingTasks(prev => [...prev, task]);
    } else {
      setAvailableChargeableTasks(prev => [...prev, task.name].sort());
    }
  };

  const handleRejectTask = async (taskId: string) => {
    setPendingTasks(prev => prev.filter(t => t.id !== taskId));
    const { error } = await supabase.from('chargeable_tasks').delete().eq('id', taskId);
    if (error) {
      console.error("Error rejecting task:", error);
      alert(`Erreur lors du rejet: ${error.message}`);
    }
  };

  const currentTimesheet = useMemo(() => allTimesheets.find(ts => ts.id === currentTimesheetId), [allTimesheets, currentTimesheetId]);
  const employeeTimesheets = useMemo(() => allTimesheets.filter(ts => ts.employee_id === currentEmployeeId).sort((a,b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()), [allTimesheets, currentEmployeeId]);
  const chargeableTasks = useMemo(() => currentTimesheet?.tasks.filter(task => task.category === TaskCategory.CHARGEABLE) || [], [currentTimesheet]);
  const nonChargeableTasks = useMemo(() => currentTimesheet?.tasks.filter(task => task.category === TaskCategory.NON_CHARGEABLE) || [], [currentTimesheet]);
  const currentlyUsedTaskNames = useMemo(() => new Set(currentTimesheet?.tasks.filter(t => t.category === TaskCategory.CHARGEABLE).map(t => t.name)), [currentTimesheet]);
  const tasksAvailableToAdd = useMemo(() => availableChargeableTasks.filter(name => !currentlyUsedTaskNames.has(name)), [availableChargeableTasks, currentlyUsedTaskNames]);
  
  // SEPARATE READ-ONLY FLAGS
  // 1. Timesheet (Hours) Read-Only Logic
  const isTimesheetReadOnly = useMemo(() => currentTimesheet?.status === 'submitted' || currentTimesheet?.status === 'approved', [currentTimesheet]);
  
  // 2. To-Do List (Objectives) Read-Only Logic
  const isTodoListReadOnly = useMemo(() => currentTimesheet?.todo_status === 'submitted' || currentTimesheet?.todo_status === 'approved', [currentTimesheet]);

  const handleExportTimesheet = () => {
    if (!currentTimesheet) return;
    const employeeName = employees.find(e => e.id === currentEmployeeId)?.name || 'N/A';
    exportTimesheetToCSV(currentTimesheet, chargeableTasks, nonChargeableTasks, employeeName, DAYS_OF_WEEK);
  };
  const handleExportAnalysis = (analysisData: any) => {
    if (!currentTimesheet) return;
    const employeeName = employees.find(e => e.id === currentEmployeeId)?.name || 'N/A';
    const period = `${currentTimesheet.start_date} au ${currentTimesheet.end_date}`;
    exportAnalysisToCSV(analysisData, employeeName, period);
  };
  const handleExportAdminAnalysis = (adminAnalysisData: any) => {
    if (!currentTimesheet) return;
    const period = `${currentTimesheet.start_date} au ${currentTimesheet.end_date}`;
    exportAdminAnalysisToCSV(adminAnalysisData, period);
  };
  const handleExportDetailedAnalysis = (reportData: any[], headers: string[]) => {
    exportDetailedAnalysisToCSV(reportData, headers);
  }

  if (schemaError) {
      return <SchemaMigrationPage onRetry={() => { setSchemaError(null); fetchAppData(session!.user!); }} error={schemaError}/>;
  }
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Chargement...</div>;
  }
  if (!session || !currentUserProfile) {
    return <LoginPage />;
  }
  
  const employeesForDropdown = currentUserProfile.role === 'admin' ? employees : [];

  const renderCurrentView = () => {
    switch(view) {
        case 'timesheet':
            return <Timesheet 
              chargeableTasks={chargeableTasks}
              nonChargeableTasks={nonChargeableTasks}
              normalHours={currentTimesheet!.normal_hours}
              onTaskHoursChange={handleTaskHoursChange}
              availableChargeableTasks={availableChargeableTasks}
              onAddNewChargeableTask={() => setModal({ type: 'newTask', isOpen: true })}
              onRemoveTask={handleRemoveTask}
              onTaskSelectionChange={handleTaskSelectionChange}
              onExport={handleExportTimesheet}
              isReadOnly={isTimesheetReadOnly} // Pass only Timesheet read-only status
            />;
        case 'todo_list':
            return <TodoListPage 
                todoList={currentTimesheet?.todo_list || []}
                onUpdateTodoList={handleUpdateTodoList}
                isReadOnly={isTodoListReadOnly} // Pass only Todo List read-only status
                listStatus={currentTimesheet?.todo_status || 'draft'} // Explicitly list status
                onStatusChange={handleTodoStatusChange}
                userRole={currentUserProfile.role}
            />;
        case 'detailed_analysis':
            return currentUserProfile.role === 'admin' ? 
              <DetailedAnalysisPage
                allTimesheets={allTimesheets}
                employees={employees}
                availableChargeableTasks={availableChargeableTasks}
                onExport={handleExportDetailedAnalysis}
              /> : <p>Accès non autorisé.</p>;
        case 'analysis':
             return <AnalysisPage 
              currentUser={currentUserProfile}
              employees={employees}
              allTimesheets={allTimesheets}
              currentTimesheet={currentTimesheet!}
              onExport={handleExportAnalysis}
              onExportAdmin={handleExportAdminAnalysis}
            />;
        case 'admin_tasks':
            return currentUserProfile.role === 'admin' ? 
              <AdminTaskManagementPage 
                pendingTasks={pendingTasks}
                onApproveTask={handleApproveTask}
                onRejectTask={handleRejectTask}
                onRefresh={fetchPendingTasks}
              /> : <p>Accès non autorisé.</p>;
        default:
            return null;
    }
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 font-sans">
      <div className="bg-white shadow-lg rounded-lg overflow-hidden">
        <Header 
          currentUser={currentUserProfile}
          currentUserEmail={session.user.email || ''}
          onLogout={handleLogout}
          employees={employeesForDropdown}
          currentEmployeeId={currentEmployeeId}
          onEmployeeChange={handleEmployeeChange}
          employeeTimesheets={employeeTimesheets}
          currentTimesheetId={currentTimesheetId}
          onSwitchWeek={setCurrentTimesheetId}
          onCreateNewWeek={() => handleCreateNewWeek(currentEmployeeId, true)}
          data={currentTimesheet}
          onHeaderChange={handleHeaderChange}
          onTimesheetStatusChange={handleTimesheetStatusChange}
          isReadOnly={isTimesheetReadOnly} // Pass only Timesheet read-only status
        />
        <main className="p-6">
          {!currentTimesheet ? (
            <div className="text-center p-10 text-gray-600">
              <p>Aucune feuille de temps trouvée. Créez une nouvelle semaine pour commencer.</p>
               <button 
                onClick={() => handleCreateNewWeek(currentEmployeeId, true)} 
                className="mt-4 px-4 py-2 bg-cyan-600 text-white rounded-md hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500"
                disabled={!currentEmployeeId}
            >
                Créer une nouvelle semaine
            </button>
            </div>
          ) : (
            <>
              <NavBar 
                currentView={view} 
                setView={setView} 
                userRole={currentUserProfile.role}
                pendingTaskCount={pendingTasks.length}
              />
              {renderCurrentView()}
            </>
          )}
        </main>
      </div>
       <footer className="text-center text-sm text-gray-500 mt-8 pb-4">
        <p>&copy; {new Date().getFullYear()} Daily Task Tracker. All rights reserved.</p>
      </footer>
      
      {modal.isOpen && modal.type === 'newTask' && (
        <Modal title="Ajouter une tâche chargeable" onClose={() => setModal({ type: null, isOpen: false })}>
           <Modal.AddTaskForm
            availableTasks={tasksAvailableToAdd}
            onAddTaskToSheet={handleAddTaskToSheet}
            onSubmitNewTask={handleSaveNewTask}
          />
        </Modal>
      )}

    </div>
  );
};

export default App;
