import React, { useState, useEffect } from 'react';
import { 
  FolderKanban, 
  Search, 
  Filter, 
  Plus, 
  Building, 
  MapPin, 
  Calendar, 
  User, 
  ChevronRight, 
  LayoutGrid, 
  List as ListIcon, 
  Archive, 
  Sparkles,
  ShieldAlert,
  Clock,
  ArrowRight
} from 'lucide-react';
import type { ProjectRecord, UserProfile, OperationalProjectStatus } from '../types';
import { fetchProjects } from '../services/projectService';
import { CreateProjectModal } from '../components/projects/CreateProjectModal';

interface ProjectDirectoryViewProps {
  currentUser: UserProfile;
  onSelectProject: (projectId: string) => void;
}

export const ProjectDirectoryView: React.FC<ProjectDirectoryViewProps> = ({
  currentUser,
  onSelectProject
}) => {
  const isContractor = currentUser.role === 'IndividualContractor' || currentUser.role === 'ContractorCompany';
  const isAdmin = currentUser.role === 'Owner' || currentUser.role === 'Admin';

  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [showArchived, setShowArchived] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadProjectsData();
  }, [statusFilter, typeFilter, showArchived]);

  const loadProjectsData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchProjects(currentUser, {
        searchQuery,
        status: statusFilter,
        projectType: typeFilter,
        isArchived: showArchived
      });
      setProjects(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load project directory.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadProjectsData();
  };

  const getStatusBadge = (status: OperationalProjectStatus) => {
    switch (status) {
      case 'Draft':
        return <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold border border-slate-200">Draft</span>;
      case 'Planned':
        return <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold border border-blue-200">Planned</span>;
      case 'In Progress':
        return <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-semibold border border-amber-200 flex items-center space-x-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span><span>In Progress</span></span>;
      case 'Site Complete':
        return <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold border border-emerald-200">Site Complete</span>;
      case 'Cancelled':
        return <span className="px-2.5 py-1 bg-red-50 text-red-700 rounded-full text-xs font-semibold border border-red-200">Cancelled</span>;
      default:
        return <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* Page Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600">
                <FolderKanban className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                  {isContractor ? 'My Jobs' : 'Projects Directory'}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  {isContractor 
                    ? 'Workspaces and project information assigned to your company or trade'
                    : 'Central project records, site workspaces, documents and commercial values'
                  }
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3 self-end sm:self-center">
            {/* View Mode Switcher (Desktop) */}
            <div className="hidden md:flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-md text-xs font-medium transition ${viewMode === 'cards' ? 'bg-white shadow text-indigo-600' : 'text-slate-600 hover:text-slate-900'}`}
                title="Card View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md text-xs font-medium transition ${viewMode === 'table' ? 'bg-white shadow text-indigo-600' : 'text-slate-600 hover:text-slate-900'}`}
                title="Table View"
              >
                <ListIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Create Project Button (Owner/Admin Only) */}
            {isAdmin && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center space-x-2 shadow-md transition"
              >
                <Plus className="w-4 h-4" />
                <span>Create Project</span>
              </button>
            )}
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          
          {/* Search Box */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Reference, Address, Postcode, or Client..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
            />
          </form>

          {/* Desktop Filter Options */}
          <div className="hidden md:flex items-center space-x-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="All">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Planned">Planned</option>
              <option value="In Progress">In Progress</option>
              <option value="Site Complete">Site Complete</option>
              <option value="Cancelled">Cancelled</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="All">All Project Types</option>
              <option value="Residential Refurbishment">Residential Refurbishment</option>
              <option value="Commercial Fitout">Commercial Fitout</option>
              <option value="Electrical Upgrade">Electrical Upgrade</option>
              <option value="Maintenance Work">Maintenance Work</option>
            </select>

            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowArchived(!showArchived)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold border transition flex items-center space-x-1.5 ${
                  showArchived ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Archive className="w-3.5 h-3.5" />
                <span>{showArchived ? 'Showing Archived' : 'Archived Projects'}</span>
              </button>
            )}
          </div>

          {/* Mobile Filter Toggle Button */}
          <div className="flex md:hidden items-center justify-between gap-2">
            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className="flex-1 py-2 px-3 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 border border-slate-200"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filters {statusFilter !== 'All' || typeFilter !== 'All' ? '(Active)' : ''}</span>
            </button>

            {isAdmin && (
              <button
                onClick={() => setShowArchived(!showArchived)}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border flex items-center space-x-1 ${
                  showArchived ? 'bg-amber-50 text-amber-900 border-amber-300' : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <Archive className="w-3.5 h-3.5" />
                <span>{showArchived ? 'Archived' : 'Active'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Filter Options Expandable */}
        {showMobileFilters && (
          <div className="md:hidden mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Status Filter</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs"
              >
                <option value="All">All Statuses</option>
                <option value="Draft">Draft</option>
                <option value="Planned">Planned</option>
                <option value="In Progress">In Progress</option>
                <option value="Site Complete">Site Complete</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Project Type</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs"
              >
                <option value="All">All Project Types</option>
                <option value="Residential Refurbishment">Residential Refurbishment</option>
                <option value="Commercial Fitout">Commercial Fitout</option>
                <option value="Electrical Upgrade">Electrical Upgrade</option>
                <option value="Maintenance Work">Maintenance Work</option>
              </select>
            </div>
          </div>
        )}

      </div>

      {/* Directory Content List */}
      {loading ? (
        <div className="py-12 bg-white rounded-xl shadow-sm border border-slate-200 text-center space-y-3">
          <Clock className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-600">Loading projects directory...</p>
        </div>
      ) : error ? (
        <div className="p-5 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-3 text-red-800 text-sm">
          <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <strong className="block font-semibold">Error Loading Projects</strong>
            <p className="mt-0.5 text-xs">{error}</p>
          </div>
        </div>
      ) : projects.length === 0 ? (
        <div className="py-12 px-4 bg-white rounded-xl shadow-sm border border-slate-200 text-center space-y-4">
          <div className="p-4 bg-slate-100 rounded-full w-16 h-16 mx-auto flex items-center justify-center text-slate-400">
            <FolderKanban className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">No Projects Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              {isContractor
                ? "You are not currently assigned to any active project workspaces. Contact your GVD Manager for access."
                : "No projects match your current search query or filter settings."
              }
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition"
            >
              Create First Project
            </button>
          )}
        </div>
      ) : viewMode === 'cards' || window.innerWidth < 768 ? (
        /* CARD VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <div
              key={p.id}
              onClick={() => onSelectProject(p.id)}
              className="bg-white rounded-xl shadow-sm border border-slate-200 hover:border-indigo-300 hover:shadow-md transition cursor-pointer overflow-hidden flex flex-col justify-between group"
            >
              <div className="p-5 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-md tracking-wide">
                      {p.reference}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition mt-1.5 line-clamp-1">
                      {p.title}
                    </h3>
                  </div>
                  <div>{getStatusBadge(p.status)}</div>
                </div>

                {/* Site Address */}
                <div className="flex items-start space-x-2 text-xs text-slate-600">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{p.siteAddress}, <strong>{p.postcode}</strong></span>
                </div>

                {/* Metadata */}
                <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs text-slate-500">
                  <div className="flex items-center space-x-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{p.responsibleManagerName}</span>
                  </div>
                  <div className="flex items-center space-x-1.5 justify-end">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{p.targetStartDate ? `Start: ${p.targetStartDate}` : 'Dates Unconfirmed'}</span>
                  </div>
                </div>

                {/* Client info (GVD Staff only) */}
                {!isContractor && p.siteInfo?.clientName && (
                  <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg flex items-center justify-between">
                    <span>Client: <strong className="text-slate-700">{p.siteInfo.clientName}</strong></span>
                    {p.siteInfo.clientOrg && <span className="text-slate-400">({p.siteInfo.clientOrg})</span>}
                  </div>
                )}
              </div>

              {/* Card Footer Action */}
              <div className="bg-slate-50 border-t border-slate-100 px-5 py-3 flex items-center justify-between text-xs text-indigo-600 font-semibold group-hover:bg-indigo-50/50 transition">
                <span>Open Project Workspace</span>
                <ChevronRight className="w-4 h-4 text-indigo-600 group-hover:translate-x-1 transition" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* TABLE VIEW (Desktop) */
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-xs uppercase font-bold border-b border-slate-200">
                <th className="py-3 px-4">Reference</th>
                <th className="py-3 px-4">Project Title & Address</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Manager</th>
                <th className="py-3 px-4">Target Start</th>
                {!isContractor && <th className="py-3 px-4">Client</th>}
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {projects.map((p) => (
                <tr 
                  key={p.id}
                  onClick={() => onSelectProject(p.id)}
                  className="hover:bg-slate-50/80 cursor-pointer transition"
                >
                  <td className="py-3.5 px-4 font-bold text-indigo-600 whitespace-nowrap">
                    {p.reference}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-900">{p.title}</div>
                    <div className="text-xs text-slate-500">{p.siteAddress}, {p.postcode}</div>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {getStatusBadge(p.status)}
                  </td>
                  <td className="py-3.5 px-4 text-slate-700 text-xs font-medium whitespace-nowrap">
                    {p.responsibleManagerName}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 text-xs whitespace-nowrap">
                    {p.targetStartDate || 'Unconfirmed'}
                  </td>
                  {!isContractor && (
                    <td className="py-3.5 px-4 text-slate-600 text-xs whitespace-nowrap">
                      {p.siteInfo?.clientName || 'N/A'}
                    </td>
                  )}
                  <td className="py-3.5 px-4 text-right">
                    <button className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center space-x-1">
                      <span>Open</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <CreateProjectModal
          currentUser={currentUser}
          onClose={() => setShowCreateModal(false)}
          onSuccess={(newProjectId) => {
            setShowCreateModal(false);
            onSelectProject(newProjectId);
          }}
        />
      )}

    </div>
  );
};
