import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  FileText, 
  Bell, 
  BellOff, 
  Send,
  MessageSquare,
  ArrowRight,
  User,
  Phone
} from 'lucide-react';
import type { BookingRecord, UserProfile } from '../types';
import { fetchBookings, respondToBooking, formatLocalDate, formatDayHeader } from '../services/plannerService';
import { 
  isPushSupported, 
  getNotificationPermissionState, 
  requestPushPermission, 
  sendLocalBrowserNotification 
} from '../services/notificationService';

interface ContractorMyWorkViewProps {
  currentUser: UserProfile;
  onSelectProject: (projectId: string) => void;
}

export const ContractorMyWorkView: React.FC<ContractorMyWorkViewProps> = ({
  currentUser,
  onSelectProject
}) => {
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Push notification state
  const [pushState, setPushState] = useState<NotificationPermission | 'unsupported'>(getNotificationPermissionState());
  const [enablingPush, setEnablingPush] = useState(false);

  // Decline / Change Modal
  const [declineBookingId, setDeclineBookingId] = useState<string | null>(null);
  const [declineReasonText, setDeclineReasonText] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  useEffect(() => {
    loadMyWorkBookings();
  }, [currentUser.uid]);

  const loadMyWorkBookings = async () => {
    try {
      setLoading(true);
      setError(null);
      const today = new Date();
      const past30Days = new Date(today);
      past30Days.setDate(past30Days.getDate() - 30);
      const future60Days = new Date(today);
      future60Days.setDate(future60Days.getDate() + 60);

      const data = await fetchBookings({
        startDate: formatLocalDate(past30Days),
        endDate: formatLocalDate(future60Days),
        userRole: currentUser.role,
        userUid: currentUser.uid
      });

      setBookings(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load My Work diary.');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (bookingId: string) => {
    try {
      setSubmittingAction(true);
      await respondToBooking(bookingId, 'Accepted', undefined, currentUser);
      sendLocalBrowserNotification("Booking Accepted", "Your response has been recorded and notified to GVD Management.");
      await loadMyWorkBookings();
    } catch (err: any) {
      alert(err.message || 'Failed to accept booking.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleDeclineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!declineBookingId) return;
    if (!declineReasonText.trim()) {
      alert("Please provide a reason for declining or requesting a schedule change.");
      return;
    }

    try {
      setSubmittingAction(true);
      await respondToBooking(declineBookingId, 'Declined', declineReasonText.trim(), currentUser);
      setDeclineBookingId(null);
      setDeclineReasonText('');
      await loadMyWorkBookings();
    } catch (err: any) {
      alert(err.message || 'Failed to submit decline response.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleEnablePush = async () => {
    setEnablingPush(true);
    const success = await requestPushPermission(currentUser.uid);
    setPushState(getNotificationPermissionState());
    setEnablingPush(false);
    if (success) {
      sendLocalBrowserNotification("GVD Connect Push Enabled", "You will receive real-time push alerts for new published site bookings.");
    }
  };

  const handleTestPush = () => {
    sendLocalBrowserNotification("GVD Connect Test Push", "This is a test notification confirming browser push delivery.");
  };

  const upcomingBookings = bookings.filter(b => b.localDate >= formatLocalDate(new Date()));
  const pastBookings = bookings.filter(b => b.localDate < formatLocalDate(new Date()));

  return (
    <div className="space-y-6 pb-24 max-w-4xl mx-auto">
      
      {/* Page Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">My Work Diary</h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Your published site bookings and job assignments
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-full text-xs font-bold">
              {upcomingBookings.length} Upcoming Shift(s)
            </span>
          </div>
        </div>

        {/* Device Web Push Subscription Banner */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-700">
              {pushState === 'granted' ? <Bell className="w-4 h-4 text-emerald-600" /> : <BellOff className="w-4 h-4 text-amber-600" />}
            </div>
            <div>
              <span className="font-bold text-slate-900 block">Browser Push Notifications</span>
              <span className="text-slate-500 text-[11px]">
                {pushState === 'granted' ? 'Active — Real-time booking alerts enabled' : 
                 pushState === 'denied' ? 'Permission Blocked in Browser Settings' : 
                 'Enable push alerts to receive instant booking notifications'}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-end sm:self-center">
            {pushState === 'granted' ? (
              <button
                onClick={handleTestPush}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg font-semibold text-xs transition"
              >
                Test Alert
              </button>
            ) : pushState !== 'unsupported' ? (
              <button
                onClick={handleEnablePush}
                disabled={enablingPush}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-xs shadow transition disabled:opacity-50"
              >
                {enablingPush ? 'Enabling...' : 'Enable Push Notifications'}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Bookings List */}
      {loading ? (
        <div className="py-12 bg-white rounded-xl shadow-sm border border-slate-200 text-center space-y-2">
          <Clock className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-700">Loading your work diary...</p>
        </div>
      ) : error ? (
        <div className="p-5 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      ) : upcomingBookings.length === 0 ? (
        <div className="py-12 bg-white rounded-xl shadow-sm border border-slate-200 text-center space-y-3 px-4">
          <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">No Upcoming Work Scheduled</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            You have no published work bookings scheduled for the upcoming period. Your GVD manager will publish new shifts here when scheduled.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-slate-900 px-1">Upcoming Work Schedule</h2>

          {upcomingBookings.map(b => (
            <div key={b.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4 hover:border-indigo-300 transition">
              
              {/* Card Top */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded text-xs">
                      {b.projectReference}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      Date: <strong className="text-slate-900">{formatDayHeader(b.localDate)}</strong> ({b.localDate})
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-1">{b.projectTitle}</h3>
                </div>

                <div>
                  {b.acknowledgement === 'Accepted' ? (
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs rounded-full flex items-center space-x-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Accepted</span>
                    </span>
                  ) : b.acknowledgement === 'Declined' ? (
                    <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 font-bold text-xs rounded-full flex items-center space-x-1">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                      <span>Declined — Needs Review</span>
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 font-bold text-xs rounded-full flex items-center space-x-1 animate-pulse">
                      <span>Pending Acceptance</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Site Address & Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <span className="text-slate-500 font-semibold block">Site Address:</span>
                  <p className="text-slate-800 font-medium flex items-start space-x-1">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <span>{b.siteAddress}, <strong>{b.postcode}</strong></span>
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-500 font-semibold block">Shift Slot & Hours:</span>
                  <p className="text-slate-800 font-bold text-sm">
                    {b.slot} {b.startTime && b.endTime ? `(${b.startTime} - ${b.endTime})` : ''}
                  </p>
                </div>
              </div>

              {/* Instructions */}
              {b.instructions && (
                <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1">
                  <span className="font-bold text-slate-700 block">Work Instructions:</span>
                  <p className="text-slate-600">{b.instructions}</p>
                </div>
              )}

              {/* Card Footer Actions */}
              <div className="pt-3 border-t flex flex-col sm:flex-row items-center justify-between gap-3">
                <button
                  onClick={() => onSelectProject(b.projectId)}
                  className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition"
                >
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span>Open Job Workspace (Drawings & Safety)</span>
                </button>

                <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                  {b.acknowledgement !== 'Accepted' ? (
                    <>
                      <button
                        onClick={() => setDeclineBookingId(b.id)}
                        disabled={submittingAction}
                        className="px-4 py-2 bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-700 border border-slate-200 rounded-lg text-xs font-semibold transition"
                      >
                        Decline
                      </button>
                      <button
                        onClick={() => handleAccept(b.id)}
                        disabled={submittingAction}
                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow transition disabled:opacity-50"
                      >
                        Accept Work
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setDeclineBookingId(b.id)}
                      className="text-xs text-slate-500 hover:text-amber-700 underline font-medium"
                    >
                      Request Change / Can No Longer Attend
                    </button>
                  )}
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* Decline / Request Change Modal */}
      {declineBookingId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-base">Decline or Request Schedule Change</h3>
              <button onClick={() => setDeclineBookingId(null)} className="text-slate-400 hover:text-white p-1">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDeclineSubmit} className="p-5 space-y-4 text-xs">
              <p className="text-slate-600">
                Please state the reason you cannot attend or need to request a schedule adjustment. Your GVD manager will be notified immediately.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason <span className="text-red-500">*</span></label>
                <textarea
                  rows={3}
                  value={declineReasonText}
                  onChange={(e) => setDeclineReasonText(e.target.value)}
                  placeholder="e.g. Existing site commitment on this date..."
                  required
                  className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="pt-3 border-t flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setDeclineBookingId(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold shadow disabled:opacity-50"
                >
                  Submit Reason
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
