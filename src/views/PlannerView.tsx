import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Copy, 
  CalendarX, 
  Search, 
  User, 
  Building, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  FileText,
  Filter,
  MoreVertical,
  Check,
  X,
  LayoutGrid,
  Users
} from 'lucide-react';
import type { 
  BookingRecord, 
  UserProfile, 
  ProjectRecord, 
  UnavailabilityRecord 
} from '../types';
import { 
  fetchBookings, 
  getMondayOfDate, 
  getWeekDays, 
  formatLocalDate, 
  formatDayHeader,
  cancelBookingRecord,
  updateBookingRecord,
  fetchUnavailability
} from '../services/plannerService';
import { fetchProjects } from '../services/projectService';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { BookingModal } from '../components/planner/BookingModal';
import { CopyWeekModal } from '../components/planner/CopyWeekModal';
import { UnavailabilityModal } from '../components/planner/UnavailabilityModal';

interface PlannerViewProps {
  currentUser: UserProfile;
  onSelectProject?: (projectId: string) => void;
}

export const PlannerView: React.FC<PlannerViewProps> = ({
  currentUser,
  onSelectProject
}) => {
  const [plannerMode, setPlannerMode] = useState<'by_project' | 'by_person'>('by_project');
  const [currentMonday, setCurrentMonday] = useState<string>(getMondayOfDate(new Date()));
  const [selectedDayDate, setSelectedDayDate] = useState<string>(formatLocalDate(new Date()));

  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [people, setPeople] = useState<UserProfile[]>([]);
  const [unavailabilities, setUnavailabilities] = useState<UnavailabilityRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [tradeFilter, setTradeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Modals
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingModalDefaults, setBookingModalDefaults] = useState<{ projectId?: string; personId?: string; date?: string }>({});
  const [showCopyWeekModal, setShowCopyWeekModal] = useState(false);
  const [showUnavailabilityModal, setShowUnavailabilityModal] = useState(false);

  // Selected booking for action drawer
  const [selectedBooking, setSelectedBooking] = useState<BookingRecord | null>(null);

  const weekDays = getWeekDays(currentMonday);

  useEffect(() => {
    loadPlannerData();
  }, [currentMonday, tradeFilter, statusFilter]);

  const loadPlannerData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch bookings for full week range
      const startDate = weekDays[0];
      const endDate = weekDays[6];

      const [bookingsData, projsData, unavailData] = await Promise.all([
        fetchBookings({
          startDate,
          endDate,
          userRole: currentUser.role,
          userUid: currentUser.uid
        }),
        fetchProjects(currentUser, { isArchived: false }),
        fetchUnavailability()
      ]);

      setBookings(bookingsData);
      setProjects(projsData.filter(p => ['Draft', 'Planned', 'In Progress'].includes(p.status)));
      setUnavailabilities(unavailData);

      // Fetch approved planning eligible users
      const usersSnap = await getDocs(query(
        collection(db, 'users'),
        where('status', '==', 'approved'),
        where('planningEligible', '==', true)
      ));

      const loadedPeople: UserProfile[] = [];
      usersSnap.forEach(d => loadedPeople.push({ uid: d.id, ...d.data() } as UserProfile));
      setPeople(loadedPeople);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load planner.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrevWeek = () => {
    const prevMon = new Date(currentMonday);
    prevMon.setDate(prevMon.getDate() - 7);
    const newMonStr = formatLocalDate(prevMon);
    setCurrentMonday(newMonStr);
    setSelectedDayDate(newMonStr);
  };

  const handleNextWeek = () => {
    const nextMon = new Date(currentMonday);
    nextMon.setDate(nextMon.getDate() + 7);
    const newMonStr = formatLocalDate(nextMon);
    setCurrentMonday(newMonStr);
    setSelectedDayDate(newMonStr);
  };

  const handleToday = () => {
    const todayStr = formatLocalDate(new Date());
    setCurrentMonday(getMondayOfDate(todayStr));
    setSelectedDayDate(todayStr);
  };

  const handleCancelBooking = async (booking: BookingRecord) => {
    const reason = prompt("Reason for cancelling this work booking:");
    if (!reason) return;

    try {
      await cancelBookingRecord(booking.id, reason, currentUser);
      setSelectedBooking(null);
      await loadPlannerData();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel booking.');
    }
  };

  const handlePublishBooking = async (booking: BookingRecord) => {
    try {
      await updateBookingRecord(booking.id, 'single', { status: 'Published' }, currentUser);
      setSelectedBooking(null);
      await loadPlannerData();
    } catch (err: any) {
      alert(err.message || 'Failed to publish booking.');
    }
  };

  // Helper badge status
  const getBookingBadge = (b: BookingRecord) => {
    if (b.status === 'Cancelled') {
      return <span className="px-1.5 py-0.5 bg-red-100 text-red-800 font-bold rounded text-[10px] flex items-center space-x-1"><XCircle className="w-3 h-3 text-red-600" /><span>Cancelled</span></span>;
    }
    if (b.status === 'Draft') {
      return <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 font-bold rounded text-[10px]">Draft</span>;
    }
    if (b.acknowledgement === 'Accepted') {
      return <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded text-[10px] flex items-center space-x-1"><CheckCircle2 className="w-3 h-3 text-emerald-600" /><span>Accepted</span></span>;
    }
    if (b.acknowledgement === 'Declined') {
      return <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 font-bold rounded text-[10px] flex items-center space-x-1"><AlertCircle className="w-3 h-3 text-amber-600" /><span>Declined</span></span>;
    }
    return <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 font-bold rounded text-[10px]">Published</span>;
  };

  // Filtered dataset
  const filteredBookings = bookings.filter(b => {
    if (searchQuery.trim()) {
      const term = searchQuery.toLowerCase();
      const match = b.personName.toLowerCase().includes(term) || 
                    b.projectReference.toLowerCase().includes(term) ||
                    b.siteAddress.toLowerCase().includes(term) ||
                    b.personTrade.toLowerCase().includes(term);
      if (!match) return false;
    }
    if (tradeFilter !== 'All' && b.personTrade !== tradeFilter) return false;
    if (statusFilter !== 'All' && b.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6 pb-24">
      
      {/* Top Planner Control Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                  {plannerMode === 'by_project' ? 'Planner (By Project)' : 'Labour Sheet (By Person)'}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Two views of the same underlying live booking records
                </p>
              </div>
            </div>
          </div>

          {/* Action Triggers */}
          <div className="flex items-center space-x-2 self-start md:self-center flex-wrap gap-y-2">
            <button
              onClick={() => { setBookingModalDefaults({}); setShowBookingModal(true); }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow transition"
            >
              <Plus className="w-4 h-4" />
              <span>Book Person</span>
            </button>

            <button
              onClick={() => setShowCopyWeekModal(true)}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-1 transition"
            >
              <Copy className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Copy Week</span>
            </button>

            <button
              onClick={() => setShowUnavailabilityModal(true)}
              className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-semibold flex items-center space-x-1 border border-amber-200 transition"
            >
              <CalendarX className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden sm:inline">Absence</span>
            </button>
          </div>
        </div>

        {/* View Switcher & Date Navigation */}
        <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Mode Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setPlannerMode('by_project')}
              className={`px-4 py-1.5 rounded-md transition flex items-center space-x-1.5 ${
                plannerMode === 'by_project' ? 'bg-white shadow text-indigo-600' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building className="w-4 h-4" />
              <span>By Project</span>
            </button>
            <button
              onClick={() => setPlannerMode('by_person')}
              className={`px-4 py-1.5 rounded-md transition flex items-center space-x-1.5 ${
                plannerMode === 'by_person' ? 'bg-white shadow text-indigo-600' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>By Person (Labour Sheet)</span>
            </button>
          </div>

          {/* Week Date Selector Controls */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleToday}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition"
            >
              Today
            </button>

            <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 rounded-lg p-1 text-xs">
              <button onClick={handlePrevWeek} className="p-1 hover:bg-white rounded transition" title="Previous Week">
                <ChevronLeft className="w-4 h-4 text-slate-600" />
              </button>
              <span className="font-bold text-slate-800 px-2">
                {formatDayHeader(weekDays[0])} — {formatDayHeader(weekDays[6])}
              </span>
              <button onClick={handleNextWeek} className="p-1 hover:bg-white rounded transition" title="Next Week">
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid or Agenda Container */}
      {loading ? (
        <div className="py-16 text-center text-xs text-slate-500 space-y-2 bg-white rounded-xl border border-slate-200 shadow-sm">
          <Clock className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
          <p className="font-semibold text-slate-700">Loading live planning schedule...</p>
        </div>
      ) : error ? (
        <div className="p-5 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      ) : (
        <>
          {/* DESKTOP WEEK GRID (>=768px) */}
          <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-900 text-white text-xs uppercase tracking-wider font-bold">
                  <th className="py-3 px-4 w-64 border-r border-slate-800">
                    {plannerMode === 'by_project' ? 'Project / Address' : 'Operative Person'}
                  </th>
                  {weekDays.map(dateStr => (
                    <th key={dateStr} className={`py-3 px-3 text-center border-r border-slate-800 ${dateStr === formatLocalDate(new Date()) ? 'bg-indigo-900 text-indigo-200' : ''}`}>
                      <div className="font-bold">{formatDayHeader(dateStr)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                
                {plannerMode === 'by_project' ? (
                  /* BY PROJECT ROWS */
                  projects.map(proj => (
                    <tr key={proj.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3 px-4 font-bold text-slate-900 bg-slate-50/70 border-r border-slate-200">
                        <div 
                          onClick={() => onSelectProject && onSelectProject(proj.id)}
                          className="hover:text-indigo-600 cursor-pointer"
                        >
                          <span className="text-indigo-600 block text-[11px] font-bold">{proj.reference}</span>
                          <span className="text-sm font-bold line-clamp-1">{proj.title}</span>
                          <span className="text-[11px] text-slate-500 font-normal block truncate">{proj.siteAddress}</span>
                        </div>
                      </td>

                      {weekDays.map(dateStr => {
                        const dayBookings = filteredBookings.filter(b => b.projectId === proj.id && b.localDate === dateStr);
                        return (
                          <td key={dateStr} className="py-2 px-2 border-r border-slate-200 vertical-align-top">
                            <div className="space-y-1.5 min-h-[50px]">
                              {dayBookings.map(b => (
                                <div 
                                  key={b.id}
                                  onClick={() => setSelectedBooking(b)}
                                  className={`p-2 rounded-lg border text-xs cursor-pointer shadow-sm hover:shadow transition ${
                                    b.status === 'Cancelled' ? 'bg-red-50 border-red-200 opacity-60' :
                                    b.status === 'Draft' ? 'bg-slate-100 border-slate-300 border-dashed' :
                                    b.acknowledgement === 'Accepted' ? 'bg-emerald-50 border-emerald-300 text-emerald-950' :
                                    b.acknowledgement === 'Declined' ? 'bg-amber-50 border-amber-300 text-amber-950' :
                                    'bg-indigo-50 border-indigo-200 text-indigo-950'
                                  }`}
                                >
                                  <div className="font-bold truncate">{b.personName}</div>
                                  <div className="text-[10px] text-slate-600 flex items-center justify-between">
                                    <span>{b.slot}</span>
                                    {getBookingBadge(b)}
                                  </div>
                                </div>
                              ))}

                              {/* Quick add trigger */}
                              <button
                                onClick={() => {
                                  setBookingModalDefaults({ projectId: proj.id, date: dateStr });
                                  setShowBookingModal(true);
                                }}
                                className="w-full py-1 text-[10px] font-semibold text-slate-400 hover:text-indigo-600 border border-dashed border-slate-200 hover:border-indigo-300 rounded transition opacity-0 hover:opacity-100"
                              >
                                + Book
                              </button>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                ) : (
                  /* BY PERSON (LABOUR SHEET) ROWS */
                  people.map(person => (
                    <tr key={person.uid} className="hover:bg-slate-50/50 transition">
                      <td className="py-3 px-4 font-bold text-slate-900 bg-slate-50/70 border-r border-slate-200">
                        <div className="font-bold text-sm text-slate-900">{person.fullName}</div>
                        <span className="text-[11px] text-indigo-600 font-semibold block">{person.primaryTrade || person.role}</span>
                        {person.companyName && <span className="text-[10px] text-slate-400 font-normal block">{person.companyName}</span>}
                      </td>

                      {weekDays.map(dateStr => {
                        const dayBookings = filteredBookings.filter(b => b.personId === person.uid && b.localDate === dateStr);
                        const userUnavail = unavailabilities.find(u => u.personId === person.uid && dateStr >= u.startDate && dateStr <= u.endDate && u.status === 'Approved');

                        return (
                          <td key={dateStr} className="py-2 px-2 border-r border-slate-200 vertical-align-top">
                            <div className="space-y-1.5 min-h-[50px]">
                              {userUnavail ? (
                                <div className="p-2 bg-amber-50 border border-amber-200 rounded text-amber-900 text-[11px] font-bold text-center">
                                  Unavailable ({userUnavail.category})
                                </div>
                              ) : (
                                dayBookings.map(b => (
                                  <div 
                                    key={b.id}
                                    onClick={() => setSelectedBooking(b)}
                                    className={`p-2 rounded-lg border text-xs cursor-pointer shadow-sm hover:shadow transition ${
                                      b.status === 'Cancelled' ? 'bg-red-50 border-red-200 opacity-60' :
                                      b.status === 'Draft' ? 'bg-slate-100 border-slate-300 border-dashed' :
                                      b.acknowledgement === 'Accepted' ? 'bg-emerald-50 border-emerald-300 text-emerald-950' :
                                      b.acknowledgement === 'Declined' ? 'bg-amber-50 border-amber-300 text-amber-950' :
                                      'bg-indigo-50 border-indigo-200 text-indigo-950'
                                    }`}
                                  >
                                    <div className="font-bold text-indigo-700 truncate">{b.projectReference}</div>
                                    <div className="text-[11px] font-semibold text-slate-800 truncate">{b.projectTitle}</div>
                                    <div className="text-[10px] text-slate-500 mt-0.5 flex items-center justify-between">
                                      <span>{b.slot}</span>
                                      {getBookingBadge(b)}
                                    </div>
                                  </div>
                                ))
                              )}

                              {/* Quick add trigger */}
                              {!userUnavail && (
                                <button
                                  onClick={() => {
                                    setBookingModalDefaults({ personId: person.uid, date: dateStr });
                                    setShowBookingModal(true);
                                  }}
                                  className="w-full py-1 text-[10px] font-semibold text-slate-400 hover:text-indigo-600 border border-dashed border-slate-200 hover:border-indigo-300 rounded transition opacity-0 hover:opacity-100"
                                >
                                  + Book
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}

              </tbody>
            </table>
          </div>

          {/* MOBILE DAY AGENDA (<768px) */}
          <div className="md:hidden space-y-4">
            
            {/* Mobile Day Selector Bar */}
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between overflow-x-auto space-x-1.5">
              {weekDays.map(dStr => {
                const isSel = selectedDayDate === dStr;
                return (
                  <button
                    key={dStr}
                    onClick={() => setSelectedDayDate(dStr)}
                    className={`py-2 px-3 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                      isSel ? 'bg-indigo-600 text-white shadow' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {formatDayHeader(dStr)}
                  </button>
                );
              })}
            </div>

            {/* Selected Day Agenda Cards */}
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-slate-900 px-1 flex items-center justify-between">
                <span>Agenda for {formatDayHeader(selectedDayDate)}</span>
                <span className="text-xs text-indigo-600 font-semibold">
                  {filteredBookings.filter(b => b.localDate === selectedDayDate).length} Bookings
                </span>
              </h2>

              {filteredBookings.filter(b => b.localDate === selectedDayDate).length === 0 ? (
                <div className="py-8 bg-white rounded-xl border border-slate-200 text-center text-xs text-slate-500 italic">
                  No bookings scheduled for this date.
                </div>
              ) : (
                filteredBookings.filter(b => b.localDate === selectedDayDate).map(b => (
                  <div 
                    key={b.id}
                    onClick={() => setSelectedBooking(b)}
                    className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-2 cursor-pointer hover:border-indigo-300 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{b.projectReference}</span>
                        <h3 className="font-bold text-slate-900 text-sm mt-1">{b.projectTitle}</h3>
                        <p className="text-xs text-slate-500">{b.siteAddress}</p>
                      </div>
                      <div>{getBookingBadge(b)}</div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-700">
                      <div>Operative: <strong>{b.personName}</strong> ({b.personTrade})</div>
                      <div className="font-bold text-indigo-900">{b.slot}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Booking Action Modal Drawer */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">{selectedBooking.projectReference} — Booking Detail</h3>
                <p className="text-xs text-slate-300">{selectedBooking.localDate} ({selectedBooking.slot})</p>
              </div>
              <button onClick={() => setSelectedBooking(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="space-y-1">
                <span className="text-slate-500 block">Operative Assigned:</span>
                <strong className="text-sm font-bold text-slate-900">{selectedBooking.personName}</strong> ({selectedBooking.personTrade})
              </div>

              <div className="space-y-1">
                <span className="text-slate-500 block">Site Address:</span>
                <p className="font-semibold text-slate-800">{selectedBooking.siteAddress}, {selectedBooking.postcode}</p>
              </div>

              {selectedBooking.instructions && (
                <div className="p-3 bg-slate-50 rounded-lg space-y-1">
                  <span className="font-bold text-slate-700 block">Work Instructions:</span>
                  <p className="text-slate-600">{selectedBooking.instructions}</p>
                </div>
              )}

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span>Status & Acknowledgement:</span>
                <div>{getBookingBadge(selectedBooking)}</div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t flex items-center justify-end space-x-2">
                {selectedBooking.status === 'Draft' && (
                  <button
                    onClick={() => handlePublishBooking(selectedBooking)}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded font-semibold text-xs"
                  >
                    Publish Booking
                  </button>
                )}
                {selectedBooking.status !== 'Cancelled' && (
                  <button
                    onClick={() => handleCancelBooking(selectedBooking)}
                    className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded font-semibold text-xs border border-red-200"
                  >
                    Cancel Booking
                  </button>
                )}
                <button
                  onClick={() => setSelectedBooking(null)}
                  className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded font-semibold text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showBookingModal && (
        <BookingModal
          initialProjectId={bookingModalDefaults.projectId}
          initialPersonId={bookingModalDefaults.personId}
          initialDate={bookingModalDefaults.date}
          currentUser={currentUser}
          onClose={() => setShowBookingModal(false)}
          onSuccess={() => {
            setShowBookingModal(false);
            loadPlannerData();
          }}
        />
      )}

      {showCopyWeekModal && (
        <CopyWeekModal
          sourceMonday={currentMonday}
          currentUser={currentUser}
          onClose={() => setShowCopyWeekModal(false)}
          onSuccess={(count) => {
            setShowCopyWeekModal(false);
            alert(`Successfully copied ${count} booking(s) to destination week as drafts.`);
            loadPlannerData();
          }}
        />
      )}

      {showUnavailabilityModal && (
        <UnavailabilityModal
          currentUser={currentUser}
          onClose={() => setShowUnavailabilityModal(false)}
          onSuccess={() => {
            setShowUnavailabilityModal(false);
            loadPlannerData();
          }}
        />
      )}

    </div>
  );
};
