import React, { useState } from 'react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult
} from '@hello-pangea/dnd';
import {
  Kanban as KanbanIcon,
  LayoutGrid,
  List,
  Calendar,
  Search,
  Filter,
  ArrowUpDown,
  Plus,
  Layers,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Task, User, TaskStatus, Project } from '../../types';
import { KanbanCard } from './KanbanCard';

interface KanbanBoardProps {
  tasks: Task[];
  users: User[];
  projects: Project[];
  onUpdateTaskStatus: (taskId: string, newStatus: TaskStatus) => void;
  onOpenTaskDetail: (task: Task) => void;
  onOpenCreateTask: (initialStatus?: TaskStatus) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  users,
  projects,
  onUpdateTaskStatus,
  onOpenTaskDetail,
  onOpenCreateTask,
  onToggleSubtask
}) => {
  const [activeTab, setActiveTab] = useState<'board' | 'list' | 'calendar'>('board');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>('all');
  const [calendarDate, setCalendarDate] = useState(new Date());

  // Columns per screenshot: Todo, Inprogress, Review, Completed
  const columns: { id: TaskStatus; label: string; dotColor: string }[] = [
    { id: 'Todo', label: 'À faire', dotColor: 'bg-purple-500' },
    { id: 'In Progress', label: 'En cours', dotColor: 'bg-amber-500' },
    { id: 'In Review', label: 'En révision', dotColor: 'bg-brand-500' },
    { id: 'Completed', label: 'Terminé', dotColor: 'bg-emerald-500' }
  ];

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProject = selectedProjectId === 'all' || t.projectId === selectedProjectId;
    const matchesAssignee =
      selectedAssigneeId === 'all' || t.assigneeIds.includes(selectedAssigneeId);

    return matchesSearch && matchesProject && matchesAssignee;
  });

  const tasksByDate = React.useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const t of filteredTasks) {
      if (!t.dueDate) continue;
      const d = t.dueDate.split('T')[0];
      if (!map[d]) map[d] = [];
      map[d].push(t);
    }
    return map;
  }, [filteredTasks]);

  // Drag and drop handler
  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;

    const newStatus = destination.droppableId as TaskStatus;
    onUpdateTaskStatus(draggableId, newStatus);
  };

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden">
      {/* Top Controls Sub-Header matching screenshot */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-stone-200/80 mb-6 shrink-0">
        {/* Navigation View Tabs */}
        <div className="flex items-center space-x-1 bg-stone-100/80 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('board')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'board'
                ? 'bg-white text-brand shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Tableau</span>
          </button>

          <button
            onClick={() => setActiveTab('list')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'list'
                ? 'bg-white text-brand shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>Liste</span>
          </button>

          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'calendar'
                ? 'bg-white text-brand shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Calendrier</span>
          </button>
        </div>

        {/* Right Action Tools & Search */}
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher une tâche..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-stone-200 rounded-xl pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-brand-500 shadow-sm"
            />
          </div>

          {/* Project Selector Filter */}
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="bg-white border border-stone-200 rounded-xl px-3 py-1.5 text-xs font-medium text-stone-700 focus:outline-none focus:border-brand-500 shadow-sm"
          >
            <option value="all">Tous les projets</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* Add Task Primary Blue Button matching screenshot */}
          <button
            onClick={() => onOpenCreateTask('Todo')}
            className="flex items-center space-x-2 px-4 py-2 bg-brand hover:bg-brand-dark text-white font-semibold text-xs rounded-xl shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Créer une tâche</span>
          </button>
        </div>
      </div>

      {/* Main Kanban / View Content */}
      {activeTab === 'board' ? (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 flex-1 overflow-y-auto pb-8 pr-1 no-scrollbar">
            {columns.map((col) => {
              const colTasks = filteredTasks.filter((t) => t.status === col.id);

              return (
                <div key={col.id} className="flex flex-col h-full bg-stone-50/50 rounded-xl p-3 border border-stone-200/60">
                  {/* Column Header matching screenshot */}
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center space-x-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`} />
                      <span className="font-bold text-sm text-stone-900 tracking-tight">{col.label}</span>
                      <span className="text-xs font-semibold text-stone-500 bg-white border border-stone-200 px-2 py-0.5 rounded-full shadow-sm">
                        {colTasks.length}
                      </span>
                    </div>

                    <button
                      onClick={() => onOpenCreateTask(col.id)}
                      className="text-stone-400 hover:text-stone-700 p-1 rounded-md hover:bg-white transition-colors"
                      title={`Add task to ${col.label}`}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Droppable Column Card Area */}
                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 rounded-xl transition-colors ${
                          snapshot.isDraggingOver ? 'bg-brand-50/60 border border-dashed border-brand-light' : ''
                        }`}
                      >
                        {colTasks.map((task, index) => (
                          <Draggable key={task.id} draggableId={task.id} index={index}>
                            {(draggableProvided, draggableSnapshot) => (
                              <div
                                ref={draggableProvided.innerRef}
                                {...draggableProvided.draggableProps}
                                {...draggableProvided.dragHandleProps}
                                className={draggableSnapshot.isDragging ? 'opacity-90 scale-[1.02] shadow-xl' : ''}
                              >
                                <KanbanCard
                                  task={task}
                                  users={users}
                                  onOpenDetail={onOpenTaskDetail}
                                  onToggleSubtask={onToggleSubtask}
                                />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}

                        {colTasks.length === 0 && (
                          <div className="h-32 border-2 border-dashed border-stone-200 rounded-xl flex flex-col items-center justify-center text-stone-400 text-xs font-medium my-2">
                            <span>Aucune tâche dans {col.label}</span>
                            <button
                              onClick={() => onOpenCreateTask(col.id)}
                              className="mt-2 text-brand hover:underline text-[11px]"
                            >
                              + Ajouter une tâche
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      ) : activeTab === 'list' ? (
        /* List View */
        <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden flex-1 overflow-auto">
          <div className="min-w-[700px]">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Titre de la Tâche</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Difficulté</th>
                <th className="px-4 py-3">Priorité</th>
                <th className="px-4 py-3">Assignés</th>
                <th className="px-4 py-3">Échéance</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-medium">
              {filteredTasks.map((task) => (
                <tr
                  key={task.id}
                  onClick={() => onOpenTaskDetail(task)}
                  className="hover:bg-stone-50/80 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3.5 text-stone-900 font-semibold">{task.title}</td>
                  <td className="px-4 py-3.5">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-brand-50 text-brand-dark border border-brand-100">
                      {task.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700">
                      {task.difficulty}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-stone-700">{task.priority}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center -space-x-1.5">
                      {users
                        .filter((u) => task.assigneeIds.includes(u.id))
                        .map((u) => (
                          u.avatar ? (
                            <img
                              key={u.id}
                              src={u.avatar}
                              alt={u.firstName}
                              className="w-5 h-5 rounded-full border border-white object-cover"
                            />
                          ) : (
                            <div
                              key={u.id}
                              className="w-5 h-5 rounded-full bg-brand flex items-center justify-center text-white text-[8px] font-semibold border border-white"
                            >
                              {u.firstName.charAt(0)}{u.lastName.charAt(0)}
                            </div>
                          )
                        ))}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-stone-500">{task.dueDate}</td>
                  <td className="px-4 py-3.5 text-right">
                    <button className="text-brand hover:text-brand-dark font-semibold">Voir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      ) : (
        /* Calendar View */
        <div className="bg-white rounded-xl border border-stone-200 p-4 sm:p-6 flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <h3 className="text-sm font-bold text-stone-900">
              {calendarDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))}
                className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-600"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCalendarDate(new Date())}
                className="text-xs font-semibold text-brand hover:underline"
              >
                Aujourd'hui
              </button>
              <button
                onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))}
                className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-600"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="overflow-auto flex-1 -mx-4 sm:-mx-6 px-4 sm:px-6">
            <div className="min-w-[700px]">
              <div className="grid grid-cols-7 gap-1 mb-2 text-center">
                {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
                  <div key={d} className="text-[10px] font-semibold text-stone-500 uppercase">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1 min-h-[420px]">
            {(() => {
              const year = calendarDate.getFullYear();
              const month = calendarDate.getMonth();
              const first = new Date(year, month, 1);
              const offset = (first.getDay() + 6) % 7;
              const start = new Date(year, month, 1 - offset);
              const days: Date[] = [];
              for (let i = 0; i < 42; i++) {
                days.push(new Date(start));
                start.setDate(start.getDate() + 1);
              }
              return days.map((d, i) => {
                const iso = d.toISOString().split('T')[0];
                const dayTasks = tasksByDate[iso] || [];
                const isCurrentMonth = d.getMonth() === month;
                const isToday = iso === new Date().toISOString().split('T')[0];
                return (
                  <div
                    key={i}
                    className={`min-h-[80px] border rounded-lg p-1.5 flex flex-col gap-1 transition-colors ${
                      isCurrentMonth ? 'bg-white border-stone-100' : 'bg-stone-50 border-stone-100/50'
                    } ${isToday ? 'ring-1 ring-brand' : ''}`}
                  >
                    <span className={`text-[10px] font-medium ${isCurrentMonth ? 'text-stone-700' : 'text-stone-400'}`}>
                      {d.getDate()}
                    </span>
                    <div className="flex flex-col gap-1 overflow-hidden">
                      {dayTasks.slice(0, 3).map((t) => (
                        <button
                          key={t.id}
                          onClick={() => onOpenTaskDetail(t)}
                          className="text-[9px] text-left truncate bg-brand-50 text-brand rounded px-1.5 py-0.5 hover:bg-brand-100"
                          title={t.title}
                        >
                          {t.title}
                        </button>
                      ))}
                      {dayTasks.length > 3 && (
                        <span className="text-[9px] text-stone-500 pl-1">+{dayTasks.length - 3}</span>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
          </div>
          </div>
        </div>
      )}
    </div>
  );
};
